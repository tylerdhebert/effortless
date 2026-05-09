import * as pty from 'node-pty'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getRunPaths } from '../core/contextPacks'
import type { AppDatabase } from '../core/db'
import {
  buildAgentRunEnvironment,
  getAgentRun,
  markAgentRunExited,
  markAgentRunFailed,
  markAgentRunStarted,
  markAgentRunCancelled,
} from '../core/agentRuns'
import { getAgentProfile } from '../core/agentProfiles'

type RunSession = {
  runId: number
  terminal: pty.IPty
}

type TerminalEventSink = (event: {
  kind: 'data' | 'exit' | 'error'
  runId: number
  body?: string
  exitCode?: number
}) => void

export function getPtyRuntimeStatus(): { available: boolean; platform: NodeJS.Platform } {
  return {
    available: typeof pty.spawn === 'function',
    platform: process.platform,
  }
}

export class RunManager {
  private readonly sessions = new Map<number, RunSession>()
  private readonly stoppingRunIds = new Set<number>()

  constructor(
    private readonly db: AppDatabase,
    private readonly emit: TerminalEventSink,
  ) {}

  start(runId: number, size: { cols: number; rows: number }): void {
    if (this.sessions.has(runId)) {
      throw new Error(`Run ${runId} is already active`)
    }

    const run = getAgentRun(this.db, runId)
    if (run.status === 'running') {
      throw new Error(`Run ${run.shortRef} is already running`)
    }

    const env = {
      ...process.env,
      ...buildAgentRunEnvironment(this.db, runId),
    } as NodeJS.ProcessEnv
    const profile = getAgentProfile(this.db, run.profileId)
    const launch = resolveShellLaunch(run, profile.wslDistro, env)

    try {
      const terminal = pty.spawn(launch.file, launch.args, {
        name: 'xterm-256color',
        cols: size.cols,
        rows: size.rows,
        cwd: run.cwd,
        env,
      })

      this.sessions.set(runId, { runId, terminal })
      markAgentRunStarted(this.db, runId)

      terminal.onData((body) => {
        this.emit({ kind: 'data', runId, body })
      })

      terminal.onExit(({ exitCode }) => {
        this.sessions.delete(runId)
        if (this.stoppingRunIds.has(runId)) {
          this.stoppingRunIds.delete(runId)
          markAgentRunCancelled(this.db, runId)
        } else {
          markAgentRunExited(this.db, runId, exitCode)
        }
        this.emit({ kind: 'exit', runId, exitCode })
      })
    } catch (error) {
      markAgentRunFailed(this.db, runId, error instanceof Error ? error.message : String(error))
      this.emit({ kind: 'error', runId, body: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  write(runId: number, data: string): void {
    const session = this.sessions.get(runId)
    if (!session) {
      throw new Error(`Run ${runId} is not active`)
    }
    session.terminal.write(data)
  }

  resize(runId: number, size: { cols: number; rows: number }): void {
    const session = this.sessions.get(runId)
    if (!session) return
    session.terminal.resize(size.cols, size.rows)
  }

  stop(runId: number): void {
    const session = this.sessions.get(runId)
    if (!session) return
    this.stoppingRunIds.add(runId)
    session.terminal.kill()
  }

  stopAll(): void {
    for (const session of this.sessions.values()) {
      this.stoppingRunIds.add(session.runId)
      session.terminal.kill()
    }
  }
}

function resolveShellLaunch(
  run: { shortRef: string; command: string; cwd: string; environment: string },
  wslDistro: string | null,
  env: NodeJS.ProcessEnv,
): { file: string; args: string[] } {
  if (process.platform === 'win32' && run.environment === 'wsl') {
    const runBinPath = ensureWslRunBin(run)
    const exports = Object.entries(env)
      .filter(([name]) => name.startsWith('EFFORTLESS_'))
      .map(([name, value]) => `export ${name}=${posixShellQuote(value ?? '')}`)
    const bashScript = [
      ...exports,
      `export PATH=${posixShellQuote(toWslPath(runBinPath))}:$PATH`,
      `cd ${posixShellQuote(toWslPath(run.cwd))}`,
      run.command,
    ].join('\n')

    return {
      file: 'wsl.exe',
      args: [
        ...(wslDistro ? ['-d', wslDistro] : []),
        'bash',
        '-lc',
        bashScript,
      ],
    }
  }

  if (process.platform === 'win32') {
    return {
      file: 'powershell.exe',
      args: ['-NoLogo', '-Command', run.command],
    }
  }

  return {
    file: process.env.SHELL ?? 'bash',
    args: ['-lc', run.command],
  }
}

function ensureWslRunBin(run: { shortRef: string }): string {
  const appRoot = process.env.APP_ROOT ?? process.cwd()
  const eflCommand = path.join(appRoot, 'efl.cmd')
  const runBinPath = path.join(getRunPaths(run.shortRef).runDir, 'bin')
  mkdirSync(runBinPath, { recursive: true })
  const wrapperPath = path.join(runBinPath, 'efl')
  const wrapper = [
    '#!/usr/bin/env bash',
    `exec ${posixShellQuote(toWslPath(eflCommand))} "$@"`,
    '',
  ].join('\n')
  writeFileSync(wrapperPath, wrapper)
  chmodSync(wrapperPath, 0o755)
  return runBinPath
}

function posixShellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function toWslPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const driveMatch = /^([A-Za-z]):\/(.*)$/.exec(normalized)
  if (!driveMatch) return normalized
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
}
