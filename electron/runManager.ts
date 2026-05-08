import * as pty from 'node-pty'
import { appendFile } from 'node:fs/promises'
import type { AppDatabase } from '../core/db'
import {
  buildAgentRunEnvironment,
  getAgentRun,
  markAgentRunExited,
  markAgentRunFailed,
  markAgentRunStarted,
  markAgentRunCancelled,
} from '../core/agentRuns'

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
    const launch = resolveShellLaunch(run.command)

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
        void appendFile(run.transcriptPath, body)
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

function resolveShellLaunch(command: string): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      file: 'powershell.exe',
      args: ['-NoLogo', '-NoExit', '-Command', command],
    }
  }

  return {
    file: process.env.SHELL ?? 'bash',
    args: ['-lc', command],
  }
}
