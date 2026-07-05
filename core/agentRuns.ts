import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { randomUUID } from 'node:crypto'
import { getAgentProfile, getDefaultAgentProfile } from './agentProfiles'
import {
  getAgentProviderConfig,
  parseAgentProvider,
  resolveProviderCommandTemplate,
} from './agentProviders'
import { writeEffortRunContext, writeTaskRunContext } from './contextPacks'
import { getEffort } from './efforts'
import { getRepo } from './repos'
import { listRepos } from './repos'
import { ensureTaskWorktree, getTask, listTasks, updateTaskStatus } from './tasks'
import type {
  AgentProfile,
  AgentProvider,
  AgentRun,
  AgentRunPurpose,
  AgentRunStatus,
  PrepareTaskRunInput,
  PrepareEffortRunInput,
  PrepareForkRunInput,
  PrepareResumeRunInput,
  RunEnvironment,
  Task,
} from './types'

type AgentRunRow = {
  id: number
  short_ref: string
  effort_id: number
  task_id: number | null
  profile_id: number
  provider: AgentProvider
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
  provider: AgentProvider
  env: Record<string, string>
}

export type PreparedEffortRun = {
  run: AgentRun
  profile: AgentProfile
  provider: AgentProvider
  env: Record<string, string>
}

export type PreparedResumeRun = {
  run: AgentRun
  profile: AgentProfile
  provider: AgentProvider
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

export function listRunningAgentRuns(db: AppDatabase): AgentRun[] {
  return db
    .prepare<AgentRunRow>(`SELECT * FROM agent_runs WHERE status = 'running' ORDER BY id DESC`)
    .all()
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
  let task = getTask(db, input.taskId)
  if (task.repoId) {
    task = await ensureTaskWorktree(db, task.id)
  }
  const effort = getEffort(db, task.effortId)
  const profile =
    input.profileId != null
      ? getAgentProfile(db, input.profileId)
      : effort.defaultProfileId != null
        ? getAgentProfile(db, effort.defaultProfileId)
        : getDefaultAgentProfile(db)
  const provider = parseAgentProvider(input.provider ?? effort.defaultProvider)
  const providerConfig = getAgentProviderConfig(provider)
  const cwd = resolveTaskRunCwd(db, task, profile)
  const now = new Date().toISOString()
  const providerSessionId = providerConfig.preseedSessionId ? randomUUID() : null
  const purpose = input.purpose ?? 'extra'
  const label = input.label?.trim() || `${purpose}-${Date.now()}`

  const result = insertPreparedAgentRun(db, {
    effortId: effort.id,
    taskId: task.id,
    profileId: profile.id,
    provider,
    purpose,
    label,
    environment: profile.environment,
    cwd,
    terminalTabKey: resolveTaskRunTerminalTabKey(purpose, task.shortRef),
    providerSessionId,
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
    command = expandCommand(resolveStartCommand(provider, profile), {
      provider_session_id: shellQuote(providerSessionId ?? '', profile.environment),
      prompt: shellQuote(paths.prompt, profile.environment),
      effort_ref: effort.shortRef,
      task_ref: task.shortRef,
      plan_ref: '',
      review_ref: '',
      worktree_path: commandPath(task.worktreePath ?? '', profile.environment),
      repo_path: commandPath(task.repoId ? getRepo(db, task.repoId).path : '', profile.environment),
    })
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
    provider,
    env: buildRunEnvironment(run, effort.shortRef, task, profile),
  }
}

export async function prepareEffortRun(db: AppDatabase, input: PrepareEffortRunInput): Promise<PreparedEffortRun> {
  const effort = getEffort(db, input.effortId)
  const profile =
    input.profileId != null
      ? getAgentProfile(db, input.profileId)
      : effort.defaultProfileId != null
        ? getAgentProfile(db, effort.defaultProfileId)
        : getDefaultAgentProfile(db)
  const provider = parseAgentProvider(input.provider ?? effort.defaultProvider)
  const providerConfig = getAgentProviderConfig(provider)
  const cwd = resolveEffortRunCwd(db, effort.id, profile)
  const now = new Date().toISOString()
  const providerSessionId = providerConfig.preseedSessionId ? randomUUID() : null
  const purpose = input.purpose ?? 'main'
  const label = input.label?.trim() || `main-${Date.now()}`

  const result = insertPreparedAgentRun(db, {
    effortId: effort.id,
    taskId: null,
    profileId: profile.id,
    provider,
    purpose,
    label,
    environment: profile.environment,
    cwd,
    terminalTabKey: 'main',
    providerSessionId,
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
    command = expandCommand(resolveStartCommand(provider, profile), {
      provider_session_id: shellQuote(providerSessionId ?? '', profile.environment),
      prompt: shellQuote(paths.prompt, profile.environment),
      effort_ref: effort.shortRef,
      task_ref: '',
      plan_ref: '',
      review_ref: '',
      worktree_path: '',
      repo_path: commandPath(cwd, profile.environment),
    })
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
    provider,
    env: buildAgentRunEnvironment(db, run.id),
  }
}

export async function prepareResumeRun(db: AppDatabase, input: PrepareResumeRunInput): Promise<PreparedResumeRun> {
  const sourceRun = getAgentRun(db, input.runId)
  if (!sourceRun.providerSessionId) {
    throw new Error(`Run ${sourceRun.shortRef} does not have a provider session id`)
  }

  const profile = getAgentProfile(db, sourceRun.profileId)
  const commandTemplate = resolveProviderCommandTemplate(
    getAgentProviderConfig(sourceRun.provider),
    'resume',
    profile.environment,
  )
  if (!commandTemplate) throw new Error(`${sourceRun.provider} does not support resume`)

  const now = new Date().toISOString()
  const label = `resume-${sourceRun.shortRef}-${Date.now()}`
  const result = insertPreparedAgentRun(db, {
    effortId: sourceRun.effortId,
    taskId: sourceRun.taskId,
    profileId: profile.id,
    provider: sourceRun.provider,
    purpose: sourceRun.purpose,
    label,
    environment: sourceRun.environment,
    cwd: sourceRun.cwd,
    terminalTabKey: sourceRun.terminalTabKey ?? 'main',
    providerSessionId: sourceRun.providerSessionId,
    now,
  })

  const id = Number(result.lastInsertRowid)
  const shortRef = `run-${id}`
  const command = expandCommand(commandTemplate, {
    provider_session_id: shellQuote(sourceRun.providerSessionId, profile.environment),
    prompt: '',
    effort_ref: '',
    task_ref: '',
    plan_ref: '',
    review_ref: '',
    worktree_path: '',
    repo_path: commandPath(sourceRun.cwd, profile.environment),
  })
  db.prepare(`
    UPDATE agent_runs
    SET short_ref = ?,
        command = ?,
        provider_session_id = ?,
        updated_at = ?
    WHERE id = ?
  `).run(shortRef, command, sourceRun.providerSessionId, new Date().toISOString(), id)

  bumpAppState(db)

  return {
    run: getAgentRun(db, id),
    profile,
    provider: sourceRun.provider,
    env: buildAgentRunEnvironment(db, id),
  }
}

export async function prepareForkRun(db: AppDatabase, input: PrepareForkRunInput): Promise<PreparedResumeRun> {
  const sourceRun = getAgentRun(db, input.sourceRunId)
  if (!sourceRun.providerSessionId) {
    throw new Error(`Run ${sourceRun.shortRef} does not have a provider session id`)
  }

  const profile = getAgentProfile(db, sourceRun.profileId)
  const commandTemplate = resolveProviderCommandTemplate(
    getAgentProviderConfig(sourceRun.provider),
    'fork',
    profile.environment,
  )
  if (!commandTemplate) {
    throw new Error(`${sourceRun.provider} does not support fork`)
  }

  const effort = getEffort(db, sourceRun.effortId)
  const task = input.taskId ? getTask(db, input.taskId) : sourceRun.taskId ? getTask(db, sourceRun.taskId) : null
  const now = new Date().toISOString()
  const label = input.label?.trim() || `fork-${sourceRun.shortRef}-${Date.now()}`
  const result = insertPreparedAgentRun(db, {
    effortId: sourceRun.effortId,
    taskId: task?.id ?? null,
    profileId: profile.id,
    provider: sourceRun.provider,
    purpose: 'fork',
    label,
    environment: sourceRun.environment,
    cwd: sourceRun.cwd,
    terminalTabKey: 'pending',
    providerSessionId: sourceRun.providerSessionId,
    now,
  })

  const id = Number(result.lastInsertRowid)
  const shortRef = `run-${id}`
  const command = expandCommand(commandTemplate, {
    provider_session_id: shellQuote(sourceRun.providerSessionId, profile.environment),
    prompt: shellQuote(input.prompt, profile.environment),
    effort_ref: effort.shortRef,
    task_ref: task?.shortRef ?? '',
    plan_ref: '',
    review_ref: '',
    worktree_path: commandPath(task?.worktreePath ?? '', profile.environment),
    repo_path: commandPath(task?.repoId ? getRepo(db, task.repoId).path : sourceRun.cwd, profile.environment),
  })

  db.prepare(`
    UPDATE agent_runs
    SET short_ref = ?,
        command = ?,
        provider_session_id = ?,
        terminal_tab_key = ?,
        updated_at = ?
    WHERE id = ?
  `).run(shortRef, command, sourceRun.providerSessionId, `fork-${shortRef}`, new Date().toISOString(), id)

  bumpAppState(db)

  return {
    run: getAgentRun(db, id),
    profile,
    provider: sourceRun.provider,
    env: buildAgentRunEnvironment(db, id),
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

const ORPHANED_RUN_REASON =
  'Run was marked running before app startup, but no live PTY session was restored.'

export function markAgentRunOrphaned(db: AppDatabase, runId: number, reason = ORPHANED_RUN_REASON): AgentRun {
  const now = new Date().toISOString()
  const result = db.prepare(`
    UPDATE agent_runs
    SET status = 'orphaned',
        error = ?,
        completed_at = COALESCE(completed_at, ?),
        updated_at = ?
    WHERE id = ?
      AND status = 'running'
  `).run(reason, now, now, runId)
  if (result.changes > 0) {
    bumpAppState(db)
  }
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

export function setAgentRunProviderSessionId(
  db: AppDatabase,
  runId: number,
  sessionId: string,
): AgentRun {
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE agent_runs SET provider_session_id = ?, updated_at = ? WHERE id = ?',
  ).run(sessionId, now, runId)
  bumpAppState(db)
  return getAgentRun(db, runId)
}

export function resolveRelevantEffortRun(db: AppDatabase, effortId: number): AgentRun {
  const queries = [
    `SELECT * FROM agent_runs WHERE effort_id = ? AND status = 'running' AND purpose = 'main' ORDER BY started_at DESC LIMIT 1`,
    `SELECT * FROM agent_runs WHERE effort_id = ? AND status = 'prepared' AND purpose = 'main' ORDER BY created_at DESC LIMIT 1`,
    `SELECT * FROM agent_runs WHERE effort_id = ? AND status = 'running' ORDER BY started_at DESC LIMIT 1`,
    `SELECT * FROM agent_runs WHERE effort_id = ? AND status = 'prepared' ORDER BY created_at DESC LIMIT 1`,
    `SELECT * FROM agent_runs WHERE effort_id = ? ORDER BY created_at DESC LIMIT 1`,
  ]

  for (const query of queries) {
    const row = db.prepare<AgentRunRow>(query).get(effortId)
    if (row) return mapAgentRun(row)
  }

  throw new Error('No runs found for this effort.')
}

export function resolveResumableEffortRun(db: AppDatabase, effortId: number): AgentRun {
  const row = db.prepare<AgentRunRow>(
    `SELECT * FROM agent_runs WHERE effort_id = ? AND provider_session_id IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
  ).get(effortId)
  if (!row) {
    throw new Error('No run with a provider session id found for this effort.')
  }
  return mapAgentRun(row)
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
    EFFORTLESS_RUN_CREATED_AT: run.createdAt,
    EFFORTLESS_PROVIDER: run.provider,
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

function resolveTaskRunTerminalTabKey(_purpose: AgentRunPurpose, taskRef: string): string {
  return `task-${taskRef}`
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
    provider: AgentProvider
    purpose: AgentRunPurpose
    label: string
    environment: RunEnvironment
    cwd: string
    terminalTabKey: string
    providerSessionId: string | null
    now: string
  },
) {
  return db.prepare(`
    INSERT INTO agent_runs (
      short_ref, effort_id, task_id, profile_id, provider, purpose, label, status,
      environment, cwd, command, provider_session_id,
      terminal_tab_key, exit_code, error,
      started_at, completed_at, created_at, updated_at
    )
    VALUES (NULL, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?, '', ?, ?, NULL, NULL, NULL, NULL, ?, ?)
  `).run(
    input.effortId,
    input.taskId,
    input.profileId,
    input.provider,
    input.purpose,
    input.label,
    input.environment,
    input.cwd,
    input.providerSessionId,
    input.terminalTabKey,
    input.now,
    input.now,
  )
}

function resolveStartCommand(provider: AgentProvider, profile: AgentProfile): string {
  return resolveProviderCommandTemplate(
    getAgentProviderConfig(provider),
    'start',
    profile.environment,
  )!
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
    EFFORTLESS_RUN_CREATED_AT: run.createdAt,
    EFFORTLESS_PROVIDER: run.provider,
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
    provider: parseAgentProvider(row.provider),
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
