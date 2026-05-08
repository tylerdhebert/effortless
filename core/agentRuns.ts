import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { getAgentProfile, getDefaultAgentProfile } from './agentProfiles'
import { writeTaskRunContext } from './contextPacks'
import { getEffort } from './efforts'
import { getRepo } from './repos'
import { ensureTaskWorktree, getTask, updateTaskStatus } from './tasks'
import type {
  AgentProfile,
  AgentRun,
  AgentRunPurpose,
  AgentRunStatus,
  PrepareTaskRunInput,
  RunEnvironment,
  Task,
} from './types'

type AgentRunRow = {
  id: number
  short_ref: string
  effort_id: number
  task_id: number | null
  plan_id: number | null
  review_id: number | null
  profile_id: number
  purpose: AgentRunPurpose
  label: string
  status: AgentRunStatus
  environment: RunEnvironment
  cwd: string
  command: string
  context_path: string
  bootstrap_path: string
  transcript_path: string
  exit_code: number | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type PreparedTaskRun = {
  run: AgentRun
  task: Task
  profile: AgentProfile
  env: Record<string, string>
}

export function listAgentRuns(db: AppDatabase, effortId?: number | null): AgentRun[] {
  const query = effortId == null
    ? `SELECT * FROM agent_runs ORDER BY datetime(created_at) DESC, id DESC`
    : `SELECT * FROM agent_runs WHERE effort_id = ? ORDER BY datetime(created_at) DESC, id DESC`
  const statement = db.prepare<AgentRunRow>(query)
  return (effortId == null ? statement.all() : statement.all(effortId)).map(mapAgentRun)
}

export function listTaskRuns(db: AppDatabase, taskId: number): AgentRun[] {
  return db
    .prepare<AgentRunRow>(`SELECT * FROM agent_runs WHERE task_id = ? ORDER BY datetime(created_at) DESC, id DESC`)
    .all(taskId)
    .map(mapAgentRun)
}

export function getAgentRun(db: AppDatabase, runId: number): AgentRun {
  const row = db.prepare<AgentRunRow>(`SELECT * FROM agent_runs WHERE id = ?`).get(runId)
  if (!row) {
    throw new Error(`Agent run ${runId} was not found`)
  }
  return mapAgentRun(row)
}

export async function prepareTaskRun(db: AppDatabase, input: PrepareTaskRunInput): Promise<PreparedTaskRun> {
  const profile = input.profileId ? getAgentProfile(db, input.profileId) : getDefaultAgentProfile(db)
  let task = getTask(db, input.taskId)
  if (task.repoId) {
    task = await ensureTaskWorktree(db, task.id)
  }
  const effort = getEffort(db, task.effortId)
  const cwd = resolveTaskRunCwd(db, task, profile)
  const now = new Date().toISOString()
  const purpose = input.purpose ?? 'implementation'
  const label = input.label?.trim() || `${purpose}-${Date.now()}`

  const result = db.prepare(`
    INSERT INTO agent_runs (
      short_ref, effort_id, task_id, plan_id, review_id, profile_id, purpose, label, status,
      environment, cwd, command, context_path, bootstrap_path, transcript_path, exit_code, error,
      started_at, completed_at, created_at, updated_at
    )
    VALUES (NULL, ?, ?, NULL, NULL, ?, ?, ?, 'prepared', ?, ?, '', '', '', '', NULL, NULL, NULL, NULL, ?, ?)
  `).run(
    effort.id,
    task.id,
    profile.id,
    purpose,
    label,
    profile.environment,
    cwd,
    now,
    now,
  )

  const id = Number(result.lastInsertRowid)
  const shortRef = `run-${id}`
  db.prepare(`UPDATE agent_runs SET short_ref = ? WHERE id = ?`).run(shortRef, id)
  let run = getAgentRun(db, id)
  let paths: Awaited<ReturnType<typeof writeTaskRunContext>>
  let command: string
  try {
    paths = await writeTaskRunContext(db, run, task, profile)
    command = expandCommand(profile.commandTemplate, {
      context_path: paths.contextPath,
      bootstrap_path: paths.bootstrapPath,
      effort_ref: effort.shortRef,
      task_ref: task.shortRef,
      plan_ref: '',
      review_ref: '',
      worktree_path: task.worktreePath ?? '',
      repo_path: task.repoId ? getRepo(db, task.repoId).path : '',
    })
  } catch (error) {
    markAgentRunFailed(db, id, error instanceof Error ? error.message : String(error))
    throw error
  }

  db.prepare(`
    UPDATE agent_runs
    SET command = ?,
        context_path = ?,
        bootstrap_path = ?,
        transcript_path = ?,
        updated_at = ?
    WHERE id = ?
  `).run(command, paths.contextPath, paths.bootstrapPath, paths.transcriptPath, new Date().toISOString(), id)

  bumpAppState(db)

  task = getTask(db, task.id)
  run = getAgentRun(db, id)

  return {
    run,
    task,
    profile,
    env: buildRunEnvironment(run, effort.shortRef, task, profile),
  }
}

export function markAgentRunStarted(db: AppDatabase, runId: number): AgentRun {
  const now = new Date().toISOString()
  const run = getAgentRun(db, runId)
  db.prepare(`
    UPDATE agent_runs
    SET status = 'running',
        started_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, now, runId)
  if (run.taskId) {
    updateTaskStatus(db, run.taskId, 'in-flight')
  }
  bumpAppState(db)
  return getAgentRun(db, runId)
}

export function markAgentRunExited(db: AppDatabase, runId: number, exitCode: number): AgentRun {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE agent_runs
    SET status = 'exited',
        exit_code = ?,
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(exitCode, now, now, runId)
  bumpAppState(db)
  return getAgentRun(db, runId)
}

export function markAgentRunFailed(db: AppDatabase, runId: number, error: string): AgentRun {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE agent_runs
    SET status = 'failed',
        error = ?,
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(error, now, now, runId)
  bumpAppState(db)
  return getAgentRun(db, runId)
}

export function markAgentRunCancelled(db: AppDatabase, runId: number): AgentRun {
  const now = new Date().toISOString()
  db.prepare(`
    UPDATE agent_runs
    SET status = 'cancelled',
        completed_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now, now, runId)
  bumpAppState(db)
  return getAgentRun(db, runId)
}

export function buildAgentRunEnvironment(db: AppDatabase, runId: number): Record<string, string> {
  const run = getAgentRun(db, runId)
  const profile = getAgentProfile(db, run.profileId)
  const effort = getEffort(db, run.effortId)
  const task = run.taskId ? getTask(db, run.taskId) : null

  return {
    ...profile.env,
    EFFORTLESS_RUN_ID: run.shortRef,
    EFFORTLESS_RUN_LABEL: run.label,
    EFFORTLESS_EFFORT: effort.shortRef,
    ...(task ? { EFFORTLESS_TASK: task.shortRef } : {}),
    EFFORTLESS_CONTEXT: run.contextPath,
    EFFORTLESS_BOOTSTRAP: run.bootstrapPath,
  }
}

function resolveTaskRunCwd(db: AppDatabase, task: Task, profile: AgentProfile): string {
  if (profile.defaultCwdKind === 'custom') {
    if (!profile.customCwd) throw new Error('Agent profile custom cwd is empty')
    return profile.customCwd
  }

  if (profile.defaultCwdKind === 'repo_root') {
    if (!task.repoId) throw new Error('Task needs a repo for repo-root runs')
    return getRepo(db, task.repoId).path
  }

  if (!task.worktreePath) {
    throw new Error('Task worktree was not prepared')
  }
  return task.worktreePath
}

function expandCommand(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Unknown command variable: ${key}`)
    }
    return vars[key]
  })
}

function buildRunEnvironment(
  run: AgentRun,
  effortRef: string,
  task: Task,
  profile: AgentProfile,
): Record<string, string> {
  return {
    ...profile.env,
    EFFORTLESS_RUN_ID: run.shortRef,
    EFFORTLESS_RUN_LABEL: run.label,
    EFFORTLESS_EFFORT: effortRef,
    EFFORTLESS_TASK: task.shortRef,
    EFFORTLESS_CONTEXT: run.contextPath,
    EFFORTLESS_BOOTSTRAP: run.bootstrapPath,
  }
}

function mapAgentRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    shortRef: row.short_ref,
    effortId: row.effort_id,
    taskId: row.task_id,
    planId: row.plan_id,
    reviewId: row.review_id,
    profileId: row.profile_id,
    purpose: row.purpose,
    label: row.label,
    status: row.status,
    environment: row.environment,
    cwd: row.cwd,
    command: row.command,
    contextPath: row.context_path,
    bootstrapPath: row.bootstrap_path,
    transcriptPath: row.transcript_path,
    exitCode: row.exit_code,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
