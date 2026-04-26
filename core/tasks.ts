import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { getHeadCommit, worktreeCreate } from './git'
import { getRepo } from './repos'
import type {
  ApproveTaskInput,
  CheckpointTaskInput,
  ClaimTaskInput,
  CreateTaskInput,
  RequestTaskChangesInput,
  Task,
  TaskComment,
  TaskCommentKind,
  UpdateTaskDetailsInput,
} from './types'

type TaskRow = {
  id: number
  effort_id: number
  short_ref: string
  title: string
  description: string
  status: Task['status']
  owner_agent_id: string | null
  repo_id: number | null
  branch_name: string | null
  base_branch: string | null
  worktree_path: string | null
  requires_review: number
  review_requires_review: number
  handoff_summary: string | null
  artifact: string | null
  created_at: string
  updated_at: string
}

type TaskCommentRow = {
  id: number
  task_id: number
  author: 'user' | 'agent'
  agent_id: string | null
  kind: TaskCommentKind
  body: string
  commit_hash: string | null
  created_at: string
}

export function listTasks(db: AppDatabase, effortId: number): Task[] {
  return db
    .prepare<TaskRow>(`SELECT * FROM tasks WHERE effort_id = ? ORDER BY id ASC`)
    .all(effortId)
    .map(mapTask)
}

export function createTask(db: AppDatabase, input: CreateTaskInput): Task {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO tasks (
        effort_id, title, description, status, repo_id, branch_name, base_branch, requires_review, review_requires_review, created_at, updated_at
      )
      VALUES (?, ?, ?, 'open', ?, ?, ?, 1, 1, ?, ?)
    `,
    )
    .run(
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
  const shortRef = `task-${id}`
  db.prepare(`UPDATE tasks SET short_ref = ? WHERE id = ?`).run(shortRef, id)
  bumpAppState(db)

  return getTask(db, id)
}

export function updateTaskDetails(db: AppDatabase, input: UpdateTaskDetailsInput): Task {
  const current = getTask(db, input.taskId)
  const nextRepoId = input.repoId === undefined ? current.repoId : input.repoId
  const nextBranchName =
    input.branchName === undefined ? current.branchName : input.branchName?.trim() || null
  const nextBaseBranch =
    input.baseBranch === undefined ? current.baseBranch : input.baseBranch?.trim() || null
  const repoChanged = nextRepoId !== current.repoId
  const branchChanged = nextBranchName !== current.branchName
  const baseBranchChanged = nextBaseBranch !== current.baseBranch

  db.prepare(
    `
    UPDATE tasks
    SET repo_id = ?,
        branch_name = ?,
        base_branch = ?,
        worktree_path = ?,
        handoff_summary = ?,
        artifact = ?,
        updated_at = ?
    WHERE id = ?
  `,
  ).run(
    nextRepoId,
    nextBranchName,
    nextBaseBranch,
    repoChanged || branchChanged || baseBranchChanged ? null : current.worktreePath,
    input.handoffSummary === undefined
      ? current.handoffSummary
      : input.handoffSummary?.trim() || null,
    input.artifact === undefined ? current.artifact : input.artifact?.trim() || null,
    new Date().toISOString(),
    input.taskId,
  )

  bumpAppState(db)
  return getTask(db, input.taskId)
}

export function getTask(db: AppDatabase, id: number): Task {
  const row = db.prepare<TaskRow>(`SELECT * FROM tasks WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Task ${id} was not found`)
  }

  return mapTask(row)
}

export function getTaskByRef(db: AppDatabase, taskRef: string): Task {
  const normalized = taskRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<TaskRow>(`SELECT * FROM tasks WHERE id = ?`).get(numericId)
    : db.prepare<TaskRow>(`SELECT * FROM tasks WHERE short_ref = ?`).get(normalized)

  if (!row) {
    throw new Error(`Task ${taskRef} was not found`)
  }

  return mapTask(row)
}

export function listTaskComments(db: AppDatabase, taskId: number): TaskComment[] {
  return db
    .prepare<TaskCommentRow>(`SELECT * FROM task_comments WHERE task_id = ? ORDER BY id ASC`)
    .all(taskId)
    .map(mapTaskComment)
}

export async function claimTask(db: AppDatabase, input: ClaimTaskInput): Promise<Task> {
  const now = new Date().toISOString()
  let task = getTask(db, input.taskId)

  if (task.repoId) {
    task = await ensureTaskWorktree(db, task.id)
  }

  db.prepare(
    `
    UPDATE tasks
    SET owner_agent_id = ?,
        status = 'in-flight',
        updated_at = ?
    WHERE id = ?
  `,
  ).run(input.agentId.trim(), now, input.taskId)
  addTaskComment(db, input.taskId, 'agent', input.agentId, 'comment', `claimed by ${input.agentId}`)
  bumpAppState(db)

  return getTask(db, input.taskId)
}

export function checkpointTask(db: AppDatabase, input: CheckpointTaskInput): TaskComment {
  const comment = addTaskComment(
    db,
    input.taskId,
    'agent',
    input.agentId,
    'checkpoint',
    input.body.trim(),
  )
  touchTask(db, input.taskId)
  bumpAppState(db)

  return comment
}

export function markTaskReady(db: AppDatabase, taskId: number): Task {
  const task = getTask(db, taskId)
  const nextStatus = task.requiresReview ? 'reviewing' : 'accepted'
  updateTaskStatus(db, taskId, nextStatus)
  addTaskComment(
    db,
    taskId,
    'agent',
    task.ownerAgentId,
    'checkpoint',
    task.requiresReview ? 'ready for human review' : 'ready and accepted',
  )
  bumpAppState(db)

  return getTask(db, taskId)
}

export async function approveTask(db: AppDatabase, input: ApproveTaskInput): Promise<Task> {
  const task = getTask(db, input.taskId)
  const commitHash =
    input.commitHash ?? (task.worktreePath ? await getHeadCommit(task.worktreePath) : null)
  updateTaskStatus(db, input.taskId, 'accepted')
  addTaskComment(db, input.taskId, 'user', null, 'approval', 'lgtm', commitHash)
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

  if (!task.repoId) {
    throw new Error('Task does not have a repo')
  }

  const repo = getRepo(db, task.repoId)
  const branchName = task.branchName ?? `task/${task.shortRef}`
  const baseBranch = task.baseBranch ?? repo.baseBranch
  const resolvedWorktreePath = await worktreeCreate(repo.path, branchName, baseBranch)

  db.prepare(
    `
    UPDATE tasks
    SET branch_name = ?,
        base_branch = ?,
        worktree_path = ?,
        updated_at = ?
    WHERE id = ?
  `,
  ).run(branchName, baseBranch, resolvedWorktreePath, new Date().toISOString(), taskId)

  bumpAppState(db)
  return getTask(db, taskId)
}

export function updateTaskStatus(db: AppDatabase, taskId: number, status: Task['status']): void {
  db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`).run(
    status,
    new Date().toISOString(),
    taskId,
  )
}

function touchTask(db: AppDatabase, taskId: number): void {
  db.prepare(`UPDATE tasks SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), taskId)
}

export function addTaskComment(
  db: AppDatabase,
  taskId: number,
  author: TaskComment['author'],
  agentId: string | null,
  kind: TaskCommentKind,
  body: string,
  commitHash: string | null = null,
): TaskComment {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO task_comments (task_id, author, agent_id, kind, body, commit_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(taskId, author, agentId, kind, body, commitHash, now)

  return getTaskComment(db, Number(result.lastInsertRowid))
}

function getTaskComment(db: AppDatabase, id: number): TaskComment {
  const row = db.prepare<TaskCommentRow>(`SELECT * FROM task_comments WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Task comment ${id} was not found`)
  }

  return mapTaskComment(row)
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    effortId: row.effort_id,
    shortRef: row.short_ref,
    title: row.title,
    description: row.description,
    status: row.status,
    ownerAgentId: row.owner_agent_id,
    repoId: row.repo_id,
    branchName: row.branch_name,
    baseBranch: row.base_branch,
    worktreePath: row.worktree_path,
    requiresReview: Boolean(row.requires_review),
    reviewRequiresReview: Boolean(row.review_requires_review),
    handoffSummary: row.handoff_summary,
    artifact: row.artifact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTaskComment(row: TaskCommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    author: row.author,
    agentId: row.agent_id,
    kind: row.kind,
    body: row.body,
    commitHash: row.commit_hash,
    createdAt: row.created_at,
  }
}