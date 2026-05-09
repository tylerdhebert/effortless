import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { addActivityEvent, listActivityEvents } from './activity'
import { checkConflicts, getCommits, getDiff, getHeadCommit, mergeBranch, worktreeCreate, worktreeRemove } from './git'
import { getRepo } from './repos'
import type {
  ActivityEvent,
  ApproveTaskInput,
  CheckpointTaskInput,
  ClaimTaskInput,
  CreateTaskInput,
  RequestTaskChangesInput,
  Task,
  TaskCommitView,
  TaskConflictView,
  TaskDiffView,
  UpdateTaskDetailsInput,
} from './types'
import type { DiffType } from './types'

type TaskRow = {
  id: number
  effort_id: number
  short_ref: string
  title: string
  description: string
  status: Task['status']
  repo_id: number | null
  branch_name: string | null
  base_branch: string | null
  worktree_path: string | null
  handoff_summary: string | null
  artifact: string | null
  created_at: string
  updated_at: string
}

export function listTasks(db: AppDatabase, effortId: number): Task[] {
  return db.prepare<TaskRow>(`SELECT * FROM tasks WHERE effort_id = ? ORDER BY id ASC`).all(effortId).map(mapTask)
}

export function listAllTasks(db: AppDatabase): Task[] {
  return db.prepare<TaskRow>(`SELECT * FROM tasks ORDER BY id ASC`).all().map(mapTask)
}

export function createTask(db: AppDatabase, input: CreateTaskInput): Task {
  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO tasks (
      effort_id, title, description, status, repo_id, branch_name, base_branch, created_at, updated_at
    )
    VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)
  `).run(
    input.effortId,
    input.title.trim(),
    input.description.trim(),
    input.repoId ?? null,
    input.branchName?.trim() || null,
    input.baseBranch?.trim() || null,
    now,
    now,
  )

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE tasks SET short_ref = ? WHERE id = ?`).run(`task-${id}`, id)
  bumpAppState(db)
  return getTask(db, id)
}

export function updateTaskDetails(db: AppDatabase, input: UpdateTaskDetailsInput): Task {
  const current = getTask(db, input.taskId)
  const nextRepoId = input.repoId === undefined ? current.repoId : input.repoId
  const nextBranchName = input.branchName === undefined ? current.branchName : input.branchName?.trim() || null
  const nextBaseBranch = input.baseBranch === undefined ? current.baseBranch : input.baseBranch?.trim() || null
  const repoChanged = nextRepoId !== current.repoId
  const branchChanged = nextBranchName !== current.branchName
  const baseBranchChanged = nextBaseBranch !== current.baseBranch

  db.prepare(`
    UPDATE tasks
    SET repo_id = ?,
        branch_name = ?,
        base_branch = ?,
        worktree_path = ?,
        handoff_summary = ?,
        artifact = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    nextRepoId,
    nextBranchName,
    nextBaseBranch,
    repoChanged || branchChanged || baseBranchChanged ? null : current.worktreePath,
    input.handoffSummary === undefined ? current.handoffSummary : input.handoffSummary?.trim() || null,
    input.artifact === undefined ? current.artifact : input.artifact?.trim() || null,
    new Date().toISOString(),
    input.taskId,
  )

  bumpAppState(db)
  return getTask(db, input.taskId)
}

export function getTask(db: AppDatabase, id: number): Task {
  const row = db.prepare<TaskRow>(`SELECT * FROM tasks WHERE id = ?`).get(id)
  if (!row) throw new Error(`Task ${id} was not found`)
  return mapTask(row)
}

export function getTaskByRef(db: AppDatabase, taskRef: string): Task {
  const normalized = taskRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<TaskRow>(`SELECT * FROM tasks WHERE id = ?`).get(numericId)
    : db.prepare<TaskRow>(`SELECT * FROM tasks WHERE short_ref = ?`).get(normalized)
  if (!row) throw new Error(`Task ${taskRef} was not found`)
  return mapTask(row)
}

export function listTaskComments(db: AppDatabase, taskId: number): ActivityEvent[] {
  return listActivityEvents(db, { taskId })
}

export async function claimTask(db: AppDatabase, input: ClaimTaskInput): Promise<Task> {
  let task = getTask(db, input.taskId)
  if (task.repoId) {
    task = await ensureTaskWorktree(db, task.id)
  }
  updateTaskStatus(db, input.taskId, 'in-flight')
  addTaskComment(db, input.taskId, 'agent', input.agentId, 'comment', `claimed by ${input.agentId}`)
  bumpAppState(db)
  return getTask(db, input.taskId)
}

export function checkpointTask(db: AppDatabase, input: CheckpointTaskInput): ActivityEvent {
  const event = addTaskComment(db, input.taskId, 'agent', input.agentId, 'checkpoint', input.body.trim())
  touchTask(db, input.taskId)
  bumpAppState(db)
  return event
}

export async function markTaskReady(db: AppDatabase, taskId: number): Promise<Task> {
  updateTaskStatus(db, taskId, 'reviewing')
  addTaskComment(db, taskId, 'agent', null, 'checkpoint', 'ready for review')
  bumpAppState(db)
  return getTask(db, taskId)
}

export async function approveTask(db: AppDatabase, input: ApproveTaskInput): Promise<Task> {
  const task = getTask(db, input.taskId)
  const commitHash = input.commitHash ?? (task.worktreePath ? await getHeadCommit(task.worktreePath) : null)
  addTaskComment(db, input.taskId, 'user', null, 'approval', 'lgtm', commitHash ? { commitHash } : null)
  await acceptTask(db, input.taskId)
  bumpAppState(db)
  return getTask(db, input.taskId)
}

export function requestTaskChanges(db: AppDatabase, input: RequestTaskChangesInput): Task {
  updateTaskStatus(db, input.taskId, 'changes-requested')
  addTaskComment(db, input.taskId, 'user', null, 'comment', input.body.trim())
  bumpAppState(db)
  return getTask(db, input.taskId)
}

export async function ensureTaskWorktree(db: AppDatabase, taskId: number): Promise<Task> {
  const task = getTask(db, taskId)
  if (!task.repoId) throw new Error('Task does not have a repo')

  const repo = getRepo(db, task.repoId)
  const branchName = task.branchName ?? `task/${task.shortRef}`
  const baseBranch = task.baseBranch ?? repo.baseBranch
  const resolvedWorktreePath = await worktreeCreate(repo.path, branchName, baseBranch)

  db.prepare(`
    UPDATE tasks
    SET branch_name = ?,
        base_branch = ?,
        worktree_path = ?,
        updated_at = ?
    WHERE id = ?
  `).run(branchName, baseBranch, resolvedWorktreePath, new Date().toISOString(), taskId)

  bumpAppState(db)
  return getTask(db, taskId)
}

export async function getTaskDiffView(db: AppDatabase, taskId: number, type: DiffType): Promise<TaskDiffView> {
  const context = resolveTaskRepoContext(db, taskId)
  const output = await getDiff(context.repo.path, context.branchName, context.baseBranch, type)
  return { taskId, type, output: output.trimEnd() }
}

export async function getTaskCommitView(db: AppDatabase, taskId: number): Promise<TaskCommitView> {
  const context = resolveTaskRepoContext(db, taskId)
  const output = await getCommits(context.repo.path, context.branchName, context.baseBranch)
  return { taskId, output: output.trimEnd() }
}

export async function getTaskConflictView(db: AppDatabase, taskId: number): Promise<TaskConflictView> {
  const context = resolveTaskRepoContext(db, taskId)
  const result = await checkConflicts(context.repo.path, context.branchName, context.baseBranch)
  return {
    taskId,
    hasConflicts: result.hasConflicts,
    files: result.hasConflicts ? result.files : [],
    details: result.hasConflicts ? result.details.trimEnd() : null,
  }
}

export async function acceptTask(db: AppDatabase, taskId: number): Promise<Task> {
  const task = getTask(db, taskId)
  if (task.repoId && task.branchName && task.baseBranch) {
    const repo = getRepo(db, task.repoId)
    const conflicts = await checkConflicts(repo.path, task.branchName, task.baseBranch)
    if (conflicts.hasConflicts) {
      updateTaskStatus(db, taskId, 'conflicted')
      addTaskComment(
        db,
        taskId,
        'user',
        null,
        'comment',
        `Conflict detected against ${task.baseBranch}.`,
      )
      bumpAppState(db)
      return getTask(db, taskId)
    }
  }

  updateTaskStatus(db, taskId, 'accepted')
  bumpAppState(db)
  return getTask(db, taskId)
}

export async function mergeTask(db: AppDatabase, taskId: number): Promise<Task> {
  const task = getTask(db, taskId)
  if (task.status !== 'accepted') throw new Error('Task must be accepted before merge')
  if (!task.repoId || !task.branchName || !task.baseBranch) {
    throw new Error('Task needs repo, branch, and base branch before merge')
  }

  const repo = getRepo(db, task.repoId)
  const conflicts = await checkConflicts(repo.path, task.branchName, task.baseBranch)
  if (conflicts.hasConflicts) {
    updateTaskStatus(db, taskId, 'conflicted')
    addTaskComment(
      db,
      taskId,
      'user',
      null,
      'comment',
      `Conflict detected against ${task.baseBranch}.`,
    )
    bumpAppState(db)
    return getTask(db, taskId)
  }

  await mergeBranch(repo.path, task.branchName, task.baseBranch)
  await worktreeRemove(repo.path, task.branchName)
  updateTaskStatus(db, taskId, 'merged')
  addTaskComment(db, taskId, 'user', null, 'approval', `merged ${task.branchName} into ${task.baseBranch}`)
  bumpAppState(db)
  return getTask(db, taskId)
}

export function updateTaskStatus(db: AppDatabase, taskId: number, status: Task['status']): void {
  db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(status, new Date().toISOString(), taskId)
}

function touchTask(db: AppDatabase, taskId: number): void {
  db.prepare(`UPDATE tasks SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), taskId)
}

function resolveTaskRepoContext(
  db: AppDatabase,
  taskId: number,
): { task: Task; repo: ReturnType<typeof getRepo>; branchName: string; baseBranch: string } {
  const task = getTask(db, taskId)
  if (!task.repoId) throw new Error('Task does not have a repo')
  if (!task.branchName || !task.baseBranch) {
    throw new Error('Task needs branch and base branch before loading implementation context')
  }
  return {
    task,
    repo: getRepo(db, task.repoId),
    branchName: task.branchName,
    baseBranch: task.baseBranch,
  }
}

export function addTaskComment(
  db: AppDatabase,
  taskId: number,
  author: 'user' | 'agent',
  agentId: string | null,
  kind: string,
  body: string,
  metadata: Record<string, unknown> | null = null,
): ActivityEvent {
  const task = getTask(db, taskId)
  return addActivityEvent(db, {
    effortId: task.effortId,
    taskId,
    author,
    kind,
    body,
    metadata: agentId ? { ...(metadata ?? {}), agentId } : metadata,
  })
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    effortId: row.effort_id,
    shortRef: row.short_ref,
    title: row.title,
    description: row.description,
    status: row.status,
    repoId: row.repo_id,
    branchName: row.branch_name,
    baseBranch: row.base_branch,
    worktreePath: row.worktree_path,
    handoffSummary: row.handoff_summary,
    artifact: row.artifact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
