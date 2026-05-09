import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { acceptTask, addTaskComment, getTask, updateTaskStatus } from './tasks'
import type { ApplyReviewInput, RequestReviewChangesInput, Review, ReviewVerdict, SubmitReviewInput } from './types'

type ReviewRow = {
  id: number
  task_id: number
  short_ref: string
  verdict: ReviewVerdict
  body: string
  summary: string | null
  created_at: string
}

export function listReviews(db: AppDatabase, taskId: number): Review[] {
  return db.prepare<ReviewRow>(`SELECT * FROM reviews WHERE task_id = ? ORDER BY id DESC`).all(taskId).map(mapReview)
}

export async function submitReview(db: AppDatabase, input: SubmitReviewInput): Promise<Review> {
  const task = getTask(db, input.taskId)
  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO reviews (task_id, verdict, body, summary, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.taskId, input.verdict, input.body.trim(), input.summary?.trim() || null, now)

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE reviews SET short_ref = ? WHERE id = ?`).run(`rev-${id}`, id)
  addTaskComment(db, task.id, 'agent', null, 'review', `review submitted: ${input.verdict}`)
  if (task.status !== 'reviewing') updateTaskStatus(db, task.id, 'reviewing')
  bumpAppState(db)
  return getReview(db, id)
}

export async function applyReview(db: AppDatabase, input: ApplyReviewInput): Promise<Review> {
  const review = getReview(db, input.reviewId)
  if (review.verdict === 'approve') {
    addTaskComment(db, review.taskId, 'user', null, 'approval', 'lgtm')
    await acceptTask(db, review.taskId)
  } else {
    updateTaskStatus(db, review.taskId, 'changes-requested')
    addTaskComment(db, review.taskId, 'user', null, 'comment', review.body)
  }
  bumpAppState(db)
  return review
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
  if (!row) throw new Error(`Review ${reviewRef} was not found`)
  return mapReview(row)
}

function getReview(db: AppDatabase, id: number): Review {
  const row = db.prepare<ReviewRow>(`SELECT * FROM reviews WHERE id = ?`).get(id)
  if (!row) throw new Error(`Review ${id} was not found`)
  return mapReview(row)
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    taskId: row.task_id,
    shortRef: row.short_ref,
    verdict: row.verdict,
    body: row.body,
    summary: row.summary,
    createdAt: row.created_at,
  }
}
