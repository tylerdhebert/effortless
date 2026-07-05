import { openDatabase } from '../../core/db'
import { getEffortByRef } from '../../core/efforts'
import { getAgentRun } from '../../core/agentRuns'
import { getTaskByRef } from '../../core/tasks'
import type { AgentRun } from '../../core/types'
import type { AppDatabase } from '../../core/db'
import { option } from './args'

export let db: AppDatabase = undefined as unknown as AppDatabase

export type CliRunStarter = (runId: number) => Promise<void>

let runStarter: CliRunStarter | null = null

export function setCliRunStarter(starter: CliRunStarter | null): void {
  runStarter = starter
}

export async function startPreparedRun(runId: number): Promise<void> {
  if (!runStarter) {
    throw new Error(
      'efl run start requires the effortless desktop app running (it hosts the terminal). ' +
        'start effortless, then retry — or use the UI start button.',
    )
  }
  await runStarter(runId)
}

export function setCliDatabase(database: AppDatabase): void {
  db = database
}

export function ensureCliDatabase(): AppDatabase {
  if (!db) {
    db = openDatabase()
  }

  return db
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function resolveTask(database: AppDatabase, taskRef: string) {
  return getTaskByRef(database, taskRef)
}

export function resolveRunRef(database: AppDatabase, runRef?: string | null): AgentRun {
  const ref = runRef ?? option('--run') ?? process.env.EFFORTLESS_RUN_ID
  if (!ref) {
    throw new Error('run command requires --run or EFFORTLESS_RUN_ID')
  }
  const numericId = ref.trim().match(/^\d+$/) ? Number(ref.trim()) : null
  if (numericId) return getAgentRun(database, numericId)

  const match = /^run-(\d+)$/.exec(ref.trim())
  if (!match) {
    throw new Error(`Run ${ref} was not found`)
  }
  return getAgentRun(database, Number(match[1]))
}

export function resolveInputTarget(database: AppDatabase): {
  effortId?: number | null
  taskId?: number | null
} {
  const effortRef = option('--effort')
  const taskRef = option('--task') ?? process.env.EFFORTLESS_TASK ?? null

  if (taskRef) {
    const task = getTaskByRef(database, taskRef)
    return { taskId: task.id }
  }

  if (effortRef) {
    const effort = getEffortByRef(database, effortRef)
    return { effortId: effort.id }
  }

  throw new Error('input request needs --effort or --task')
}
