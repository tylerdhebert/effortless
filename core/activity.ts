import type { AppDatabase } from './db'
import type { ActivityEvent } from './types'

type ActivityEventRow = {
  id: number
  effort_id: number
  task_id: number | null
  run_id: number | null
  author: 'user' | 'agent'
  kind: string
  body: string
  metadata_json: string | null
  created_at: string
}

export function listActivityEvents(
  db: AppDatabase,
  input: { effortId?: number; taskId?: number; runId?: number },
): ActivityEvent[] {
  if (input.taskId != null) {
    return db
      .prepare<ActivityEventRow>(`SELECT * FROM activity_events WHERE task_id = ? ORDER BY id ASC`)
      .all(input.taskId)
      .map(mapActivityEvent)
  }

  if (input.runId != null) {
    return db
      .prepare<ActivityEventRow>(`SELECT * FROM activity_events WHERE run_id = ? ORDER BY id ASC`)
      .all(input.runId)
      .map(mapActivityEvent)
  }

  if (input.effortId != null) {
    return db
      .prepare<ActivityEventRow>(`SELECT * FROM activity_events WHERE effort_id = ? ORDER BY id ASC`)
      .all(input.effortId)
      .map(mapActivityEvent)
  }

  return []
}

export function addActivityEvent(
  db: AppDatabase,
  input: {
    effortId?: number
    taskId?: number | null
    runId?: number | null
    author: 'user' | 'agent'
    kind: string
    body: string
    metadata?: Record<string, unknown> | null
  },
): ActivityEvent {
  const effortId = input.effortId
  if (!effortId) {
    throw new Error('Activity event needs an effort')
  }

  const result = db.prepare(`
    INSERT INTO activity_events (effort_id, task_id, run_id, author, kind, body, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    effortId,
    input.taskId ?? null,
    input.runId ?? null,
    input.author,
    input.kind,
    input.body.trim(),
    input.metadata ? JSON.stringify(input.metadata) : null,
    new Date().toISOString(),
  )

  return getActivityEvent(db, Number(result.lastInsertRowid))
}

function getActivityEvent(db: AppDatabase, id: number): ActivityEvent {
  const row = db.prepare<ActivityEventRow>(`SELECT * FROM activity_events WHERE id = ?`).get(id)
  if (!row) {
    throw new Error(`Activity event ${id} was not found`)
  }
  return mapActivityEvent(row)
}

function mapActivityEvent(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    effortId: row.effort_id,
    taskId: row.task_id,
    runId: row.run_id,
    author: row.author,
    kind: row.kind,
    body: row.body,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
  }
}

function parseMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}
