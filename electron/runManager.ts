import { spawn as spawnChildProcess } from 'node:child_process'
import * as pty from 'node-pty'
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getRunPaths } from '../core/contextPacks'
import type { AppDatabase } from '../core/db'
import {
  buildAgentRunEnvironment,
  getAgentRun,
  listRunningAgentRuns,
  markAgentRunExited,
  markAgentRunFailed,
  markAgentRunOrphaned,
  markAgentRunStarted,
  markAgentRunCancelled,
} from '../core/agentRuns'
import { getAgentProfile } from '../core/agentProfiles'
import type { LiveAgentRunSession } from '../core/types'

type RunSession = {
  attachmentId: string
  runId: number
  terminal: pty.IPty
  cols: number
  rows: number
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
  private readonly providerRunIds = new Set<number>()
  private readonly completedRunIds = new Set<number>()
  private readonly stoppingRunIds = new Set<number>()

  constructor(
    private readonly db: AppDatabase,
    private readonly emit: TerminalEventSink,
  ) {}

  async start(runId: number, size: { cols: number; rows: number }): Promise<void> {
    if (this.sessions.has(runId)) {
      throw new Error(`Run ${runId} is already active`)
    }

    const run = getAgentRun(this.db, runId)
    if (this.providerRunIds.has(runId)) {
      throw new Error(`Run ${run.shortRef} is already running`)
    }
    const profile = getAgentProfile(this.db, run.profileId)

    try {
      await assertRunCwdAccessible(run, profile.wslDistro)
      const env = {
        ...process.env,
        ...buildAgentRunEnvironment(this.db, runId),
      } as NodeJS.ProcessEnv
      const launch = resolveShellLaunch(run, profile.wslDistro, env)
      const terminal = pty.spawn(launch.file, launch.args, {
        name: 'xterm-256color',
        cols: size.cols,
        rows: size.rows,
        cwd: resolveHostLaunchCwd(run),
        env,
      })

      this.sessions.set(runId, {
        attachmentId: createAttachmentId(),
        runId,
        terminal,
        cols: size.cols,
        rows: size.rows,
      })
      this.providerRunIds.add(runId)
      this.completedRunIds.delete(runId)
      markAgentRunStarted(this.db, runId)

      terminal.onData((body) => {
        const exitCode = parseProviderExitSentinel(body, runId)
        if (exitCode != null && !this.completedRunIds.has(runId)) {
          const visibleBody = stripProviderExitSentinel(body, runId)
          if (visibleBody) {
            this.emit({ kind: 'data', runId, body: visibleBody })
          }
          this.providerRunIds.delete(runId)
          this.completedRunIds.add(runId)
          markAgentRunExited(this.db, runId, exitCode)
          this.emit({ kind: 'exit', runId, exitCode })
          return
        }
        this.emit({ kind: 'data', runId, body })
      })

      terminal.onExit(({ exitCode }) => {
        this.sessions.delete(runId)
        let shouldEmitExit = true
        if (this.stoppingRunIds.has(runId)) {
          this.stoppingRunIds.delete(runId)
          this.providerRunIds.delete(runId)
          this.completedRunIds.add(runId)
          markAgentRunCancelled(this.db, runId)
        } else if (!this.completedRunIds.has(runId)) {
          this.providerRunIds.delete(runId)
          this.completedRunIds.add(runId)
          markAgentRunExited(this.db, runId, exitCode)
        } else {
          shouldEmitExit = false
        }
        if (shouldEmitExit) {
          this.emit({ kind: 'exit', runId, exitCode })
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      markAgentRunFailed(this.db, runId, message)
      this.emit({ kind: 'error', runId, body: message })
      throw error
    }
  }

  write(runId: number, data: string): void {
    const session = this.sessions.get(runId)
    if (!session) return
    session.terminal.write(data)
  }

  resize(runId: number, size: { cols: number; rows: number }): void {
    const session = this.sessions.get(runId)
    if (!session) return
    session.terminal.resize(size.cols, size.rows)
    session.cols = size.cols
    session.rows = size.rows
  }

  activeRunIds(): number[] {
    return [...this.sessions.keys()]
  }

  activeProviderRunIds(): number[] {
    return [...this.providerRunIds]
  }

  liveSessions(): LiveAgentRunSession[] {
    const snapshots: LiveAgentRunSession[] = []
    for (const session of this.sessions.values()) {
      const run = getAgentRun(this.db, session.runId)
      snapshots.push({
        attachmentId: session.attachmentId,
        runId: run.id,
        effortId: run.effortId,
        taskId: run.taskId,
        profileId: run.profileId,
        provider: run.provider,
        purpose: run.purpose,
        terminalTabKey: run.terminalTabKey,
        cwd: run.cwd,
        providerSessionId: run.providerSessionId,
        providerLive: this.providerRunIds.has(session.runId),
        cols: session.cols,
        rows: session.rows,
      })
    }
    return snapshots
  }

  reconcilePersistedRunsOnStartup(): void {
    const runningRuns = listRunningAgentRuns(this.db)
    for (const run of runningRuns) {
      if (this.sessions.has(run.id)) continue
      markAgentRunOrphaned(this.db, run.id)
    }
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
      if (!this.completedRunIds.has(session.runId)) {
        this.providerRunIds.delete(session.runId)
        this.completedRunIds.add(session.runId)
        markAgentRunCancelled(this.db, session.runId)
      }
      session.terminal.kill()
    }
    this.sessions.clear()
  }
}

let nextAttachmentId = 1

function resolveShellLaunch(
  run: { id: number; shortRef: string; command: string; cwd: string; environment: string },
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
      `code=$?`,
      `printf '\\n${providerExitSentinel(run.id)}:%s\\n' "$code"`,
      `exec bash -i`,
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
    const command = [
      run.command,
      '$effortlessExitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }',
      `Write-Output "${providerExitSentinel(run.id)}:$effortlessExitCode"`,
    ].join('; ')
    return {
      file: 'powershell.exe',
      args: ['-NoLogo', '-NoExit', '-Command', command],
    }
  }

  const command = [
    run.command,
    'code=$?',
    `printf '\\n${providerExitSentinel(run.id)}:%s\\n' "$code"`,
    'exec "${SHELL:-bash}" -i',
  ].join('\n')
  return {
    file: process.env.SHELL ?? 'bash',
    args: ['-lc', command],
  }
}

async function assertRunCwdAccessible(
  run: { shortRef: string; cwd: string; environment: string },
  wslDistro: string | null,
): Promise<void> {
  const message = `Run ${run.shortRef} could not start because cwd is not an accessible directory: ${run.cwd}`

  if (process.platform === 'win32' && run.environment === 'wsl' && isWslPath(run.cwd)) {
    await assertWslDirectoryAccessible(toWslPath(run.cwd), wslDistro, message)
    return
  }

  try {
    if (!existsSync(run.cwd) || !statSync(run.cwd).isDirectory()) {
      throw new Error(message)
    }
  } catch {
    throw new Error(message)
  }
}

function isWslPath(filePath: string): boolean {
  if (filePath.startsWith('/')) return true
  return /^[/\\]{2}wsl\$/i.test(filePath)
}

function resolveHostLaunchCwd(run: { cwd: string; environment: string }): string {
  if (process.platform === 'win32' && run.environment === 'wsl' && isWslPath(run.cwd)) {
    return process.cwd()
  }
  return run.cwd
}

function assertWslDirectoryAccessible(
  cwd: string,
  wslDistro: string | null,
  message: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const child = spawnChildProcess(
      'wsl.exe',
      [
        ...(wslDistro ? ['-d', wslDistro] : []),
        'bash',
        '-lc',
        `test -d ${posixShellQuote(cwd)}`,
      ],
      { stdio: 'ignore' },
    )

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error(message))
    }, 5000)

    child.once('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(message))
    })

    child.once('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(message))
    })
  })
}

function createAttachmentId(): string {
  const attachmentId = `attach-${nextAttachmentId}`
  nextAttachmentId += 1
  return attachmentId
}

function providerExitSentinel(runId: number): string {
  return `__EFFORTLESS_PROVIDER_EXIT__:${runId}`
}

function parseProviderExitSentinel(body: string, runId: number): number | null {
  const escaped = providerExitSentinel(runId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = body.match(new RegExp(`${escaped}:(\\d+)`))
  return match ? Number(match[1]) : null
}

function stripProviderExitSentinel(body: string, runId: number): string {
  const escaped = providerExitSentinel(runId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return body.replace(new RegExp(`\\r?\\n?${escaped}:\\d+\\r?\\n?`, 'g'), '')
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
  const wslShareMatch = /^\/\/wsl\$\/[^/]+(\/.*)?$/i.exec(normalized)
  if (wslShareMatch) {
    return wslShareMatch[1] || '/'
  }
  const driveMatch = /^([A-Za-z]):\/(.*)$/.exec(normalized)
  if (!driveMatch) return normalized
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
}
