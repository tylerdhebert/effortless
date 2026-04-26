import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreatePlanInput, Plan, PlanComment, PlanCommentKind, RequestPlanChangesInput } from './types'
import { getEffort } from './efforts'

type PlanRow = {
  id: number
  effort_id: number
  short_ref: string
  body: string
  summary: string | null
  author_agent_id: string | null
  created_at: string
  ready_at: string | null
  accepted_at: string | null
  accepted: number
  latest_feedback_body: string | null
  latest_feedback_at: string | null
}

type PlanCommentRow = {
  id: number
  plan_id: number
  author: 'user' | 'agent'
  agent_id: string | null
  kind: PlanCommentKind
  body: string
  created_at: string
}

export function listPlans(db: AppDatabase, effortId: number): Plan[] {
  return db
    .prepare<PlanRow>(
      `
      SELECT
        plans.*,
        CASE WHEN efforts.accepted_plan_id = plans.id THEN 1 ELSE 0 END AS accepted,
        (
          SELECT plan_comments.body
          FROM plan_comments
          WHERE plan_comments.plan_id = plans.id
            AND plan_comments.author = 'user'
            AND plan_comments.kind = 'comment'
          ORDER BY plan_comments.id DESC
          LIMIT 1
        ) AS latest_feedback_body,
        (
          SELECT plan_comments.created_at
          FROM plan_comments
          WHERE plan_comments.plan_id = plans.id
            AND plan_comments.author = 'user'
            AND plan_comments.kind = 'comment'
          ORDER BY plan_comments.id DESC
          LIMIT 1
        ) AS latest_feedback_at
      FROM plans
      JOIN efforts ON efforts.id = plans.effort_id
      WHERE plans.effort_id = ?
      ORDER BY plans.id DESC
    `,
    )
    .all(effortId)
    .map(mapPlan)
}

export function createPlan(db: AppDatabase, input: CreatePlanInput): Plan {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO plans (effort_id, body, summary, author_agent_id, created_at, ready_at, accepted_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL)
    `,
    )
    .run(
      input.effortId,
      input.body.trim(),
      input.summary?.trim() || null,
      input.authorAgentId?.trim() || null,
      now,
    )

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE plans SET short_ref = ? WHERE id = ?`).run(`plan-${id}`, id)
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(now, input.effortId)
  bumpAppState(db)

  return getPlan(db, id)
}

export function acceptPlan(db: AppDatabase, planId: number): Plan {
  const plan = getPlan(db, planId)
  const now = new Date().toISOString()
  db.prepare(`UPDATE efforts SET accepted_plan_id = ?, updated_at = ? WHERE id = ?`).run(planId, now, plan.effortId)
  db.prepare(`UPDATE plans SET accepted_at = ? WHERE id = ?`).run(now, planId)
  addPlanComment(db, planId, 'user', null, 'approval', 'accepted')
  bumpAppState(db)

  return getPlan(db, planId)
}

export function listPlanComments(db: AppDatabase, planId: number): PlanComment[] {
  return db
    .prepare<PlanCommentRow>(`SELECT * FROM plan_comments WHERE plan_id = ? ORDER BY id ASC`)
    .all(planId)
    .map(mapPlanComment)
}

export function getPlanByRef(db: AppDatabase, planRef: string): Plan {
  const normalized = planRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? getPlanRowById(db, numericId)
    : getPlanRowByShortRef(db, normalized)

  if (!row) {
    throw new Error(`Plan ${planRef} was not found`)
  }

  return mapPlan(row)
}

export function markPlanReady(db: AppDatabase, planId: number): Plan {
  const plan = getPlan(db, planId)
  const effort = getEffort(db, plan.effortId)

  if (!effort.planRequiresReview) {
    return acceptPlan(db, planId)
  }

  const now = new Date().toISOString()
  db.prepare(`UPDATE plans SET ready_at = ? WHERE id = ?`).run(now, planId)
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(now, plan.effortId)
  addPlanComment(
    db,
    planId,
    'agent',
    plan.authorAgentId,
    'comment',
    'ready for human review',
  )
  bumpAppState(db)

  return getPlan(db, planId)
}

export function requestPlanChanges(db: AppDatabase, input: RequestPlanChangesInput): Plan {
  const plan = getPlan(db, input.planId)
  addPlanComment(db, input.planId, 'user', null, 'comment', input.body.trim())
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), plan.effortId)
  bumpAppState(db)
  return getPlan(db, input.planId)
}

function getPlan(db: AppDatabase, id: number): Plan {
  const row = getPlanRowById(db, id)

  if (!row) {
    throw new Error(`Plan ${id} was not found`)
  }

  return mapPlan(row)
}

function getPlanRowById(db: AppDatabase, id: number): PlanRow | undefined {
  return db
    .prepare<PlanRow>(
      `
      SELECT
        plans.*,
        CASE WHEN efforts.accepted_plan_id = plans.id THEN 1 ELSE 0 END AS accepted,
        (
          SELECT plan_comments.body
          FROM plan_comments
          WHERE plan_comments.plan_id = plans.id
            AND plan_comments.author = 'user'
            AND plan_comments.kind = 'comment'
          ORDER BY plan_comments.id DESC
          LIMIT 1
        ) AS latest_feedback_body,
        (
          SELECT plan_comments.created_at
          FROM plan_comments
          WHERE plan_comments.plan_id = plans.id
            AND plan_comments.author = 'user'
            AND plan_comments.kind = 'comment'
          ORDER BY plan_comments.id DESC
          LIMIT 1
        ) AS latest_feedback_at
      FROM plans
      JOIN efforts ON efforts.id = plans.effort_id
      WHERE plans.id = ?
    `,
    )
    .get(id)
}

function getPlanRowByShortRef(db: AppDatabase, shortRef: string): PlanRow | undefined {
  return db
    .prepare<PlanRow>(
      `
      SELECT
        plans.*,
        CASE WHEN efforts.accepted_plan_id = plans.id THEN 1 ELSE 0 END AS accepted,
        (
          SELECT plan_comments.body
          FROM plan_comments
          WHERE plan_comments.plan_id = plans.id
            AND plan_comments.author = 'user'
            AND plan_comments.kind = 'comment'
          ORDER BY plan_comments.id DESC
          LIMIT 1
        ) AS latest_feedback_body,
        (
          SELECT plan_comments.created_at
          FROM plan_comments
          WHERE plan_comments.plan_id = plans.id
            AND plan_comments.author = 'user'
            AND plan_comments.kind = 'comment'
          ORDER BY plan_comments.id DESC
          LIMIT 1
        ) AS latest_feedback_at
      FROM plans
      JOIN efforts ON efforts.id = plans.effort_id
      WHERE plans.short_ref = ?
    `,
    )
    .get(shortRef)
}

function addPlanComment(
  db: AppDatabase,
  planId: number,
  author: PlanComment['author'],
  agentId: string | null,
  kind: PlanCommentKind,
  body: string,
): PlanComment {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO plan_comments (plan_id, author, agent_id, kind, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(planId, author, agentId, kind, body, now)

  return getPlanComment(db, Number(result.lastInsertRowid))
}

function getPlanComment(db: AppDatabase, id: number): PlanComment {
  const row = db.prepare<PlanCommentRow>(`SELECT * FROM plan_comments WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Plan comment ${id} was not found`)
  }

  return mapPlanComment(row)
}

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    effortId: row.effort_id,
    shortRef: row.short_ref,
    body: row.body,
    summary: row.summary,
    authorAgentId: row.author_agent_id,
    createdAt: row.created_at,
    accepted: Boolean(row.accepted),
    readyAt: row.ready_at,
    acceptedAt: row.accepted_at,
    latestFeedbackBody: row.latest_feedback_body,
    latestFeedbackAt: row.latest_feedback_at,
  }
}

function mapPlanComment(row: PlanCommentRow): PlanComment {
  return {
    id: row.id,
    planId: row.plan_id,
    author: row.author,
    agentId: row.agent_id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at,
  }
}