import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreateEffortInput, Effort, EffortTemplate } from './types'

const EFFORT_TEMPLATES: EffortTemplate[] = ['bugfix', 'delivery', 'investigation']

type EffortRow = {
  id: number
  short_ref: string
  title: string
  description: string
  template: Effort['template']
  accepted_plan_id: number | null
  status: Effort['status']
  summary: string | null
  created_at: string
  updated_at: string
}

export function listEfforts(db: AppDatabase): Effort[] {
  return db
    .prepare<EffortRow>(
      `SELECT * FROM efforts ORDER BY datetime(updated_at) DESC, id DESC`,
    )
    .all()
    .map(mapEffort)
}

export function createEffort(db: AppDatabase, input: CreateEffortInput): Effort {
  const template = parseEffortTemplate(input.template)
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO efforts (
        title, description, template, accepted_plan_id, status, created_at, updated_at
      )
      VALUES (?, ?, ?, NULL, 'active', ?, ?)
    `,
    )
    .run(input.title.trim(), input.description.trim(), template, now, now)

  const id = Number(result.lastInsertRowid)
  const shortRef = `eff-${id}`
  db.prepare(`UPDATE efforts SET short_ref = ? WHERE id = ?`).run(shortRef, id)

  bumpAppState(db)

  return getEffort(db, id)
}

export function parseEffortTemplate(value: string): EffortTemplate {
  if (EFFORT_TEMPLATES.includes(value as EffortTemplate)) {
    return value as EffortTemplate
  }
  throw new Error(`template must be one of: ${EFFORT_TEMPLATES.join(', ')}`)
}

export function getEffort(db: AppDatabase, id: number): Effort {
  const row = db.prepare<EffortRow>(`SELECT * FROM efforts WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Effort ${id} was not found`)
  }

  return mapEffort(row)
}

export function getEffortByRef(db: AppDatabase, effortRef: string): Effort {
  const normalized = effortRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<EffortRow>(`SELECT * FROM efforts WHERE id = ?`).get(numericId)
    : db.prepare<EffortRow>(`SELECT * FROM efforts WHERE short_ref = ?`).get(normalized)

  if (!row) {
    throw new Error(`Effort ${effortRef} was not found`)
  }

  return mapEffort(row)
}

export function updateEffortStatus(db: AppDatabase, effortId: number, status: Effort['status']): Effort {
  db.prepare(`UPDATE efforts SET status = ?, updated_at = ? WHERE id = ?`).run(
    status,
    new Date().toISOString(),
    effortId,
  )
  bumpAppState(db)
  return getEffort(db, effortId)
}

export function updateEffortSummary(db: AppDatabase, effortId: number, summary: string): Effort {
  db.prepare(`UPDATE efforts SET summary = ?, updated_at = ? WHERE id = ?`).run(
    summary.trim(),
    new Date().toISOString(),
    effortId,
  )
  bumpAppState(db)
  return getEffort(db, effortId)
}

export function deleteEffort(db: AppDatabase, effortId: number): void {
  const existing = db.prepare<{ id: number }>(`SELECT id FROM efforts WHERE id = ?`).get(effortId)
  if (!existing) {
    throw new Error(`Effort ${effortId} was not found`)
  }

  const taskIds = db.prepare<{ id: number }>(`SELECT id FROM tasks WHERE effort_id = ?`).all(effortId).map((row) => row.id)
  const planIds = db.prepare<{ id: number }>(`SELECT id FROM plans WHERE effort_id = ?`).all(effortId).map((row) => row.id)
  const reviewIds =
    taskIds.length > 0
      ? db
          .prepare<{ id: number }>(
            `SELECT id FROM reviews WHERE task_id IN (${taskIds.map(() => '?').join(', ')})`,
          )
          .all(...taskIds)
          .map((row) => row.id)
      : []

  const deleteReferencesByIds = (surface: 'effort' | 'plan' | 'task' | 'review', ids: number[]) => {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(', ')
    db.prepare(
      `DELETE FROM "references" WHERE owner_type = ? AND owner_id IN (${placeholders})`,
    ).run(surface, ...ids)
    db.prepare(
      `DELETE FROM "references" WHERE target_type = ? AND target_id IN (${placeholders})`,
    ).run(surface, ...ids)
  }

  deleteReferencesByIds('review', reviewIds)
  deleteReferencesByIds('task', taskIds)
  deleteReferencesByIds('plan', planIds)
  deleteReferencesByIds('effort', [effortId])

  db.prepare(`DELETE FROM efforts WHERE id = ?`).run(effortId)
  bumpAppState(db)
}

function mapEffort(row: EffortRow): Effort {
  return {
    id: row.id,
    shortRef: row.short_ref,
    title: row.title,
    description: row.description,
    template: row.template,
    acceptedPlanId: row.accepted_plan_id,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
