import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { getAgentProfile, getDefaultAgentProfile } from './agentProfiles'
import { writeEffortRunContext, writeTaskRunContext } from './contextPacks'
import { getEffort } from './efforts'
import { getRepo } from './repos'
import { listRepos } from './repos'
import { ensureTaskWorktree, getTask, listTasks, updateTaskStatus } from './tasks'
import type {
  AgentProfile,
  AgentRun,
  AgentRunPurpose,
  AgentRunStatus,
  PrepareTaskRunInput,
  PrepareEffortRunInput,
  RunEnvironment,
  Task,
} from './types'

type AgentRunRow = {
  id: number
  short_ref: string
  effort_id: number
  task_id: number | null
  profile_id: number
  purpose: AgentRunPurpose
  label: string
  status: AgentRunStatus
  environment: RunEnvironment
  cwd: string
  command: string
  provider_session_id: string | null
  terminal_tab_key: string | null
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

export type PreparedEffortRun = {
  run: AgentRun
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

  const result = insertPreparedAgentRun(db, {
    effortId: effort.id,
    taskId: task.id,
    profileId: profile.id,
    purpose,
    label,
    environment: profile.environment,
    cwd,
    terminalTabKey: purpose === 'main' ? 'main' : `${purpose}-${task.shortRef}`,
    now,
  })

  const id = Number(result.lastInsertRowid)
  const shortRef = `run-${id}`
  db.prepare(`UPDATE agent_runs SET short_ref = ? WHERE id = ?`).run(shortRef, id)
  let run = getAgentRun(db, id)
  let paths: Awaited<ReturnType<typeof writeTaskRunContext>>
  let command: string
  try {
    paths = await writeTaskRunContext(db, run, task, profile)
    command = expandCommand(profile.commandTemplate, {
      prompt: shellQuote(paths.prompt, profile.environment),
      effort_ref: effort.shortRef,
      task_ref: task.shortRef,
      plan_ref: '',
      review_ref: '',
      worktree_path: commandPath(task.worktreePath ?? '', profile.environment),
      repo_path: commandPath(task.repoId ? getRepo(db, task.repoId).path : '', profile.environment),
    })
    if (command === profile.commandTemplate.trim() && !profile.commandTemplate.includes('{')) {
      command = `${command} ${shellQuote(paths.prompt, profile.environment)}`
    }
  } catch (error) {
    markAgentRunFailed(db, id, error instanceof Error ? error.message : String(error))
    throw error
  }

  db.prepare(`
    UPDATE agent_runs
    SET command = ?,
        updated_at = ?
    WHERE id = ?
  `).run(command, new Date().toISOString(), id)

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

export async function prepareEffortRun(db: AppDatabase, input: PrepareEffortRunInput): Promise<PreparedEffortRun> {
  const profile = input.profileId ? getAgentProfile(db, input.profileId) : getDefaultAgentProfile(db)
  const effort = getEffort(db, input.effortId)
  const cwd = resolveEffortRunCwd(db, effort.id, profile)
  const now = new Date().toISOString()
  const purpose = input.purpose ?? 'main'
  const label = input.label?.trim() || `main-${Date.now()}`

  const result = insertPreparedAgentRun(db, {
    effortId: effort.id,
    taskId: null,
    profileId: profile.id,
    purpose,
    label,
    environment: profile.environment,
    cwd,
    terminalTabKey: 'main',
    now,
  })

  const id = Number(result.lastInsertRowid)
  const shortRef = `run-${id}`
  db.prepare(`UPDATE agent_runs SET short_ref = ? WHERE id = ?`).run(shortRef, id)
  let run = getAgentRun(db, id)
  let paths: Awaited<ReturnType<typeof writeEffortRunContext>>
  let command: string
  try {
    paths = await writeEffortRunContext(db, run, profile)
    command = expandCommand(profile.commandTemplate, {
      prompt: shellQuote(paths.prompt, profile.environment),
      effort_ref: effort.shortRef,
      task_ref: '',
      plan_ref: '',
      review_ref: '',
      worktree_path: '',
      repo_path: commandPath(cwd, profile.environment),
    })
    if (command === profile.commandTemplate.trim() && !profile.commandTemplate.includes('{')) {
      command = `${command} ${shellQuote(paths.prompt, profile.environment)}`
    }
  } catch (error) {
    markAgentRunFailed(db, id, error instanceof Error ? error.message : String(error))
    throw error
  }

  db.prepare(`
    UPDATE agent_runs
    SET command = ?,
        updated_at = ?
    WHERE id = ?
  `).run(command, new Date().toISOString(), id)

  bumpAppState(db)
  run = getAgentRun(db, id)

  return {
    run,
    profile,
    env: buildAgentRunEnvironment(db, run.id),
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

function resolveEffortRunCwd(db: AppDatabase, effortId: number, profile: AgentProfile): string {
  if (profile.defaultCwdKind === 'custom') {
    if (!profile.customCwd) throw new Error('Agent profile custom cwd is empty')
    return profile.customCwd
  }

  const tasks = listTasks(db, effortId)
  const repoTask = tasks.find((task) => task.repoId)
  if (profile.defaultCwdKind === 'task_worktree' && repoTask?.worktreePath) {
    return repoTask.worktreePath
  }
  if (repoTask?.repoId) {
    return getRepo(db, repoTask.repoId).path
  }
  const repo = listRepos(db)[0]
  if (repo) {
    return repo.path
  }
  return process.cwd()
}

function expandCommand(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Unknown command variable: ${key}`)
    }
    return vars[key]
  })
}

function insertPreparedAgentRun(
  db: AppDatabase,
  input: {
    effortId: number
    taskId: number | null
    profileId: number
    purpose: AgentRunPurpose
    label: string
    environment: RunEnvironment
    cwd: string
    terminalTabKey: string
    now: string
  },
) {
  return db.prepare(`
    INSERT INTO agent_runs (
      short_ref, effort_id, task_id, profile_id, purpose, label, status,
      environment, cwd, command, provider_session_id,
      terminal_tab_key, exit_code, error,
      started_at, completed_at, created_at, updated_at
    )
    VALUES (NULL, ?, ?, ?, ?, ?, 'prepared', ?, ?, '', NULL, ?, NULL, NULL, NULL, NULL, ?, ?)
  `).run(
    input.effortId,
    input.taskId,
    input.profileId,
    input.purpose,
    input.label,
    input.environment,
    input.cwd,
    input.terminalTabKey,
    input.now,
    input.now,
  )
}

function shellQuote(value: string, environment: RunEnvironment): string {
  if (process.platform === 'win32' && environment !== 'wsl') {
    return `'${value.replace(/'/g, "''")}'`
  }

  return `'${value.replace(/'/g, "'\\''")}'`
}

function commandPath(filePath: string, environment: RunEnvironment): string {
  if (!filePath || environment !== 'wsl') return filePath
  const normalized = filePath.replace(/\\/g, '/')
  const driveMatch = /^([A-Za-z]):\/(.*)$/.exec(normalized)
  if (!driveMatch) return normalized
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
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
  }
}

function mapAgentRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    shortRef: row.short_ref,
    effortId: row.effort_id,
    taskId: row.task_id,
    profileId: row.profile_id,
    purpose: row.purpose,
    label: row.label,
    status: row.status,
    environment: row.environment,
    cwd: row.cwd,
    command: row.command,
    providerSessionId: row.provider_session_id,
    terminalTabKey: row.terminal_tab_key,
    exitCode: row.exit_code,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
