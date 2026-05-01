import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreateEffortInput, Effort } from './types'

type EffortRow = {
  id: number
  short_ref: string
  title: string
  description: string
  template: Effort['template']
  accepted_plan_id: number | null
  plan_requires_review: number
  needs_tasks: number
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

function templateDefaults(template: Effort['template']): { planRequiresReview: number; needsTasks: number } {
  switch (template) {
    case 'bugfix':
      return { planRequiresReview: 0, needsTasks: 1 }
    case 'delivery':
      return { planRequiresReview: 1, needsTasks: 1 }
    case 'investigation':
      return { planRequiresReview: 1, needsTasks: 0 }
    case 'discussion':
      return { planRequiresReview: 0, needsTasks: 0 }
  }
}

export function createEffort(db: AppDatabase, input: CreateEffortInput): Effort {
  const defaults = templateDefaults(input.template)
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO efforts (
        title, description, template, accepted_plan_id, plan_requires_review, needs_tasks, status, created_at, updated_at
      )
      VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?)
    `,
    )
    .run(input.title.trim(), input.description.trim(), input.template, defaults.planRequiresReview, defaults.needsTasks, now, now)

  const id = Number(result.lastInsertRowid)
  const shortRef = `eff-${id}`
  db.prepare(`UPDATE efforts SET short_ref = ? WHERE id = ?`).run(shortRef, id)

  bumpAppState(db)

  return getEffort(db, id)
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

export function updateEffortPlanRequiresReview(db: AppDatabase, effortId: number, planRequiresReview: boolean): Effort {
  db.prepare(`UPDATE efforts SET plan_requires_review = ?, updated_at = ? WHERE id = ?`).run(
    planRequiresReview ? 1 : 0,
    new Date().toISOString(),
    effortId,
  )
  bumpAppState(db)
  return getEffort(db, effortId)
}

function mapEffort(row: EffortRow): Effort {
  return {
    id: row.id,
    shortRef: row.short_ref,
    title: row.title,
    description: row.description,
    template: row.template,
    acceptedPlanId: row.accepted_plan_id,
    planRequiresReview: Boolean(row.plan_requires_review),
    needsTasks: Boolean(row.needs_tasks),
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
