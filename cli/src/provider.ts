import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  getAgentProviderConfig,
  parseAgentProvider,
  resolveProviderCommandTemplate,
} from '../../core/agentProviders'
import type { AgentProvider, AgentRun } from '../../core/types'

export type Provider = AgentProvider

export function resolveProvider(label?: string | null): Provider {
  return parseAgentProvider(label)
}

export function resolveSessionId(
  run: AgentRun,
  explicitId?: string | null,
  providerOverride?: Provider | null,
): string {
  if (explicitId) return explicitId
  if (!providerOverride && run.providerSessionId) return run.providerSessionId

  const provider = providerOverride ?? run.provider
  if (provider === 'codex') return resolveFromEnv(provider, 'CODEX_THREAD_ID')
  if (provider === 'opencode') return resolveOpenCodeSession(run)
  if (provider === 'claude') return resolveClaudeSession(run)
  if (provider === 'cursor') return resolveCursorSession(run)
  if (provider === 'copilot') return resolveCopilotSession(run)

  throw new Error(`No ${provider} session id found. Pass --id to set it manually.`)
}

export function getResumeCommand(run: AgentRun): string | null {
  if (!run.providerSessionId) return null
  const template = resolveProviderCommandTemplate(
    getAgentProviderConfig(run.provider),
    'resume',
    run.environment,
  )
  return template
    ? expandCommand(template, { provider_session_id: shellQuote(run.providerSessionId, run.environment) })
    : null
}

function resolveFromEnv(provider: Provider, envVar: string): string {
  const value = process.env[envVar]
  if (value) return value
  throw new Error(`No ${provider} session id found. Pass --id or run this command inside ${provider}.`)
}

function resolveOpenCodeSession(run: AgentRun): string {
  const output = execFileSync(
    'opencode',
    ['session', 'list', '--format', 'json', '--max-count', '80'],
    { cwd: run.cwd, encoding: 'utf8' },
  )
  const parsed = JSON.parse(output) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('OpenCode session list did not return an array.')
  }

  const anchor = Date.parse(run.createdAt)
  const runCwd = normalizePath(run.cwd)
  const candidates = parsed
    .map((entry) => parseOpenCodeSession(entry))
    .filter((entry): entry is OpenCodeSession => Boolean(entry))
    .filter((entry) => normalizePath(entry.directory) === runCwd)
    .sort((a, b) => Math.abs(a.created - anchor) - Math.abs(b.created - anchor))

  if (candidates[0]) return candidates[0].id
  throw new Error('No OpenCode session matched this run cwd. Pass --id to set it manually.')
}

function resolveClaudeSession(run: AgentRun): string {
  const historyPath = path.join(os.homedir(), '.claude', 'history.jsonl')
  const lines = readTextLines(historyPath)
  const anchor = Date.parse(run.createdAt)
  const runCwd = normalizePath(run.cwd)
  const candidates = lines
    .map(parseJsonLine)
    .map((entry) => parseClaudeHistoryEntry(entry))
    .filter((entry): entry is ClaudeHistoryEntry => Boolean(entry))
    .filter((entry) => normalizePath(entry.project) === runCwd)
    .sort((a, b) => Math.abs(a.timestamp - anchor) - Math.abs(b.timestamp - anchor))

  if (candidates[0]) return candidates[0].sessionId
  throw new Error('No Claude Code session matched this run cwd. Pass --id to set it manually.')
}

function resolveCursorSession(run: AgentRun): string {
  const transcriptsRoot = path.join(
    os.homedir(),
    '.cursor',
    'projects',
    cursorProjectSlug(run.cwd),
    'agent-transcripts',
  )
  const candidate = nearestDirectoryName(transcriptsRoot, run.createdAt, isUuid)
  if (candidate) return candidate
  throw new Error('No Cursor session transcript matched this run cwd. Pass --id to set it manually.')
}

function resolveCopilotSession(run: AgentRun): string {
  const home = process.env.COPILOT_HOME || path.join(os.homedir(), '.copilot')
  const candidate = nearestDirectoryName(path.join(home, 'session-state'), run.createdAt)
  if (candidate) return candidate
  throw new Error('No Copilot session state matched this run. Pass --id or run /session inside Copilot.')
}

type OpenCodeSession = {
  id: string
  created: number
  directory: string
}

function parseOpenCodeSession(value: unknown): OpenCodeSession | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string') return null
  const created = parseTimestamp(entry.created)
  if (created == null) return null
  if (typeof entry.directory !== 'string') return null
  return { id: entry.id, created, directory: entry.directory }
}

type ClaudeHistoryEntry = {
  sessionId: string
  timestamp: number
  project: string
}

function parseClaudeHistoryEntry(value: unknown): ClaudeHistoryEntry | null {
  if (!value || typeof value !== 'object') return null
  const entry = value as Record<string, unknown>
  if (typeof entry.sessionId !== 'string') return null
  const timestamp = parseTimestamp(entry.timestamp)
  if (timestamp == null) return null
  if (typeof entry.project !== 'string') return null
  return { sessionId: entry.sessionId, timestamp, project: entry.project }
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value === 'number') {
    return value < 10_000_000_000 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function nearestDirectoryName(
  root: string,
  isoAnchor: string,
  filter: (name: string) => boolean = () => true,
): string | null {
  if (!fs.existsSync(root)) return null
  const anchor = Date.parse(isoAnchor)
  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && filter(entry.name))
    .map((entry) => {
      const fullPath = path.join(root, entry.name)
      const stats = fs.statSync(fullPath)
      return {
        name: entry.name,
        distance: Math.abs(stats.mtimeMs - anchor),
      }
    })
    .sort((a, b) => a.distance - b.distance)

  return entries[0]?.name ?? null
}

function cursorProjectSlug(cwd: string): string {
  const resolved = path.resolve(cwd)
  const normalized = resolved.replace(/^[A-Za-z]:/, (drive) => drive[0].toLowerCase())
  return normalized.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function readTextLines(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return []
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean)
}

function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line) as unknown
  } catch {
    return null
  }
}

function normalizePath(value: string): string {
  return path.resolve(value).replace(/\\/g, '/').toLowerCase()
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function expandCommand(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_match, key: string) => vars[key] ?? '')
}

function shellQuote(value: string, environment: 'windows' | 'wsl'): string {
  if (process.platform === 'win32' && environment !== 'wsl') {
    return `'${value.replace(/'/g, "''")}'`
  }

  return `'${value.replace(/'/g, "'\\''")}'`
}
