import type { AppDatabase } from './db'
import type { InputChoice, InputRequestType } from './types'

export type AttentionInput = {
  id: number
  shortRef: string
  effortId: number
  effortRef: string
  taskId: number | null
  taskRef: string | null
  prompt: string
  type: InputRequestType
  choices: InputChoice[] | null
  requestedAt: string
}

export type AttentionVerdict = {
  taskId: number
  taskRef: string
  effortId: number
  effortRef: string
  title: string
  reviewSummary: string | null
}

export type AttentionSnapshot = {
  inputs: AttentionInput[]
  verdicts: AttentionVerdict[]
}

export function listAttention(db: AppDatabase): AttentionSnapshot {
  const inputRows = db
    .prepare<{
      id: number
      short_ref: string
      effort_id: number
      effort_ref: string
      task_id: number | null
      task_ref: string | null
      type: InputRequestType
      prompt: string
      choices_json: string | null
      requested_at: string
    }>(`
      SELECT
        input_requests.id,
        input_requests.short_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_ref,
        input_requests.task_id,
        tasks.short_ref AS task_ref,
        input_requests.type,
        input_requests.prompt,
        input_requests.choices_json,
        input_requests.requested_at
      FROM input_requests
      JOIN efforts ON efforts.id = input_requests.effort_id
      LEFT JOIN tasks ON tasks.id = input_requests.task_id
      WHERE input_requests.status = 'pending'
      ORDER BY input_requests.requested_at DESC, input_requests.id DESC
    `)
    .all()

  const verdictRows = db
    .prepare<{
      task_id: number
      task_ref: string
      effort_id: number
      effort_ref: string
      title: string
      review_summary: string | null
    }>(`
      SELECT
        tasks.id AS task_id,
        tasks.short_ref AS task_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_ref,
        tasks.title,
        (
          SELECT reviews.summary
          FROM reviews
          WHERE reviews.task_id = tasks.id
          ORDER BY reviews.id DESC
          LIMIT 1
        ) AS review_summary
      FROM tasks
      JOIN efforts ON efforts.id = tasks.effort_id
      WHERE tasks.status = 'reviewing'
      ORDER BY tasks.updated_at DESC, tasks.id DESC
    `)
    .all()

  return {
    inputs: inputRows.map((row) => ({
      id: row.id,
      shortRef: row.short_ref,
      effortId: row.effort_id,
      effortRef: row.effort_ref,
      taskId: row.task_id,
      taskRef: row.task_ref,
      prompt: row.prompt,
      type: row.type,
      choices: row.choices_json ? JSON.parse(row.choices_json) as InputChoice[] : null,
      requestedAt: row.requested_at,
    })),
    verdicts: verdictRows.map((row) => ({
      taskId: row.task_id,
      taskRef: row.task_ref,
      effortId: row.effort_id,
      effortRef: row.effort_ref,
      title: row.title,
      reviewSummary: row.review_summary,
    })),
  }
}
