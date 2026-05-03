import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { getHeadCommit } from './git'
import { acceptTask, addTaskComment, getTask, updateTaskStatus } from './tasks'
import type { ApplyReviewInput, RequestReviewChangesInput, Review, ReviewVerdict, SubmitReviewInput } from './types'

type ReviewRow = {
  id: number
  task_id: number
  short_ref: string
  verdict: ReviewVerdict
  body: string
  summary: string | null
  author_agent_id: string | null
  created_at: string
  applied_at: string | null
}

export function listReviews(db: AppDatabase, taskId: number): Review[] {
  return db
    .prepare<ReviewRow>(`SELECT * FROM reviews WHERE task_id = ? ORDER BY id DESC`)
    .all(taskId)
    .map(mapReview)
}

export async function submitReview(db: AppDatabase, input: SubmitReviewInput): Promise<Review> {
  const task = getTask(db, input.taskId)
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO reviews (task_id, verdict, body, summary, author_agent_id, created_at, applied_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `,
    )
    .run(
      input.taskId,
      input.verdict,
      input.body.trim(),
      input.summary?.trim() || null,
      input.authorAgentId?.trim() || null,
      now,
    )

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE reviews SET short_ref = ? WHERE id = ?`).run(`rev-${id}`, id)
  addTaskComment(
    db,
    task.id,
    'agent',
    input.authorAgentId?.trim() || null,
    'comment',
    `review submitted: ${input.verdict}`,
  )

  const review = getReview(db, id)

  if (!task.reviewRequiresReview) {
    await applyReviewVerdict(db, review, null)
    bumpAppState(db)
    return getReview(db, id)
  }

  if (task.status !== 'reviewing') {
    updateTaskStatus(db, task.id, 'reviewing')
  }

  bumpAppState(db)
  return review
}

export async function applyReview(db: AppDatabase, input: ApplyReviewInput): Promise<Review> {
  const review = getReview(db, input.reviewId)
  await applyReviewVerdict(db, review, input.commitHash ?? null)
  bumpAppState(db)
  return getReview(db, input.reviewId)
}

export function requestReviewChanges(db: AppDatabase, input: RequestReviewChangesInput): Review {
  const review = getReview(db, input.reviewId)
  addTaskComment(db, review.taskId, 'user', null, 'comment', input.body.trim())
  db.prepare(`UPDATE tasks SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), review.taskId)
  bumpAppState(db)
  return review
}

export function getReviewByRef(db: AppDatabase, reviewRef: string): Review {
  const normalized = reviewRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<ReviewRow>(`SELECT * FROM reviews WHERE id = ?`).get(numericId)
    : db.prepare<ReviewRow>(`SELECT * FROM reviews WHERE short_ref = ?`).get(normalized)

  if (!row) {
    throw new Error(`Review ${reviewRef} was not found`)
  }

  return mapReview(row)
}

function getReview(db: AppDatabase, id: number): Review {
  const row = db.prepare<ReviewRow>(`SELECT * FROM reviews WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Review ${id} was not found`)
  }

  return mapReview(row)
}

async function applyReviewVerdict(
  db: AppDatabase,
  review: Review,
  commitHash: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  const task = getTask(db, review.taskId)
  const resolvedCommitHash =
    commitHash ?? (review.verdict === 'approve' && task.worktreePath ? await getHeadCommit(task.worktreePath) : null)

  db.prepare(`UPDATE reviews SET applied_at = ? WHERE id = ?`).run(now, review.id)

  if (review.verdict === 'approve') {
    addTaskComment(db, review.taskId, 'user', null, 'approval', 'lgtm', resolvedCommitHash)
    await acceptTask(db, review.taskId)
    return
  }

  updateTaskStatus(db, review.taskId, 'changes-requested')
  addTaskComment(db, review.taskId, 'user', null, 'comment', review.body)
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    taskId: row.task_id,
    shortRef: row.short_ref,
    verdict: row.verdict,
    body: row.body,
    summary: row.summary,
    authorAgentId: row.author_agent_id,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
  }
}
