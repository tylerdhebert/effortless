import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreatePlanInput, Plan, RequestPlanChangesInput } from './types'
import { addActivityEvent, listActivityEvents } from './activity'

type PlanRow = {
  id: number
  effort_id: number
  short_ref: string
  body: string
  summary: string | null
  created_at: string
  accepted: number
}

export function listPlans(db: AppDatabase, effortId: number): Plan[] {
  return db.prepare<PlanRow>(`
    SELECT plans.*, CASE WHEN efforts.accepted_plan_id = plans.id THEN 1 ELSE 0 END AS accepted
    FROM plans
    JOIN efforts ON efforts.id = plans.effort_id
    WHERE plans.effort_id = ?
    ORDER BY plans.id DESC
  `).all(effortId).map(mapPlan)
}

export function createPlan(db: AppDatabase, input: CreatePlanInput): Plan {
  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO plans (effort_id, body, summary, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(input.effortId, input.body.trim(), input.summary?.trim() || null, now, now)

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE plans SET short_ref = ? WHERE id = ?`).run(`plan-${id}`, id)
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(now, input.effortId)
  addActivityEvent(db, {
    effortId: input.effortId,
    author: 'agent',
    kind: 'plan-created',
    body: input.summary?.trim() || 'plan created',
    metadata: { planId: id },
  })
  bumpAppState(db)
  return getPlan(db, id)
}

export function acceptPlan(db: AppDatabase, planId: number): Plan {
  const plan = getPlan(db, planId)
  const now = new Date().toISOString()
  db.prepare(`UPDATE efforts SET accepted_plan_id = ?, updated_at = ? WHERE id = ?`).run(planId, now, plan.effortId)
  addActivityEvent(db, {
    effortId: plan.effortId,
    author: 'user',
    kind: 'plan-accepted',
    body: 'accepted',
    metadata: { planId },
  })
  bumpAppState(db)
  return getPlan(db, planId)
}

export function listPlanComments(db: AppDatabase, planId: number) {
  const plan = getPlan(db, planId)
  return listActivityEvents(db, { effortId: plan.effortId })
    .filter((event) => event.metadata?.planId === planId)
}

export function getPlanByRef(db: AppDatabase, planRef: string): Plan {
  const normalized = planRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId ? getPlanRowById(db, numericId) : getPlanRowByShortRef(db, normalized)
  if (!row) throw new Error(`Plan ${planRef} was not found`)
  return mapPlan(row)
}

export function markPlanReady(db: AppDatabase, planId: number): Plan {
  return acceptPlan(db, planId)
}

export function requestPlanChanges(db: AppDatabase, input: RequestPlanChangesInput): Plan {
  const plan = getPlan(db, input.planId)
  addActivityEvent(db, {
    effortId: plan.effortId,
    author: 'user',
    kind: 'plan-feedback',
    body: input.body.trim(),
    metadata: { planId: input.planId },
  })
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), plan.effortId)
  bumpAppState(db)
  return plan
}

function getPlan(db: AppDatabase, id: number): Plan {
  const row = getPlanRowById(db, id)
  if (!row) throw new Error(`Plan ${id} was not found`)
  return mapPlan(row)
}

function getPlanRowById(db: AppDatabase, id: number): PlanRow | undefined {
  return db.prepare<PlanRow>(`
    SELECT plans.*, CASE WHEN efforts.accepted_plan_id = plans.id THEN 1 ELSE 0 END AS accepted
    FROM plans
    JOIN efforts ON efforts.id = plans.effort_id
    WHERE plans.id = ?
  `).get(id)
}

function getPlanRowByShortRef(db: AppDatabase, shortRef: string): PlanRow | undefined {
  return db.prepare<PlanRow>(`
    SELECT plans.*, CASE WHEN efforts.accepted_plan_id = plans.id THEN 1 ELSE 0 END AS accepted
    FROM plans
    JOIN efforts ON efforts.id = plans.effort_id
    WHERE plans.short_ref = ?
  `).get(shortRef)
}

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    effortId: row.effort_id,
    shortRef: row.short_ref,
    body: row.body,
    summary: row.summary,
    createdAt: row.created_at,
    accepted: Boolean(row.accepted),
  }
}
