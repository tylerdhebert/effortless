import type { AppDatabase } from './db'

type PendingNotificationKind = 'plan-review' | 'task-review' | 'review-pass' | 'input-request'

export type PendingNotification = {
  id: number
  kind: PendingNotificationKind
  effortId: number
  effortShortRef: string
  effortTitle: string
  entityId: number
  entityShortRef: string
  entityType: string
  message: string
  startedAt: string
}

export function listPendingNotifications(db: AppDatabase): PendingNotification[] {
  const notifications: PendingNotification[] = []

  // Plans ready for review but not accepted
  const planRows = db
    .prepare<{
      id: number
      short_ref: string
      effort_id: number
      effort_short_ref: string
      effort_title: string
      summary: string | null
      ready_at: string
    }>(`
      SELECT
        plans.id,
        plans.short_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_short_ref,
        efforts.title AS effort_title,
        plans.summary,
        plans.ready_at
      FROM plans
      JOIN efforts ON efforts.id = plans.effort_id
      WHERE plans.ready_at IS NOT NULL
        AND plans.accepted_at IS NULL
    `)
    .all()

  for (const row of planRows) {
    notifications.push({
      id: row.id,
      kind: 'plan-review',
      effortId: row.effort_id,
      effortShortRef: row.effort_short_ref,
      effortTitle: row.effort_title,
      entityId: row.id,
      entityShortRef: row.short_ref,
      entityType: 'plan',
      message: row.summary ?? 'plan ready for review',
      startedAt: row.ready_at,
    })
  }

  // Tasks in reviewing status
  const taskRows = db
    .prepare<{
      id: number
      short_ref: string
      effort_id: number
      effort_short_ref: string
      effort_title: string
      title: string
      updated_at: string
    }>(`
      SELECT
        tasks.id,
        tasks.short_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_short_ref,
        efforts.title AS effort_title,
        tasks.title,
        tasks.updated_at
      FROM tasks
      JOIN efforts ON efforts.id = tasks.effort_id
      WHERE tasks.status = 'reviewing'
    `)
    .all()

  for (const row of taskRows) {
    notifications.push({
      id: row.id,
      kind: 'task-review',
      effortId: row.effort_id,
      effortShortRef: row.effort_short_ref,
      effortTitle: row.effort_title,
      entityId: row.id,
      entityShortRef: row.short_ref,
      entityType: 'task',
      message: row.title,
      startedAt: row.updated_at,
    })
  }

  // Reviews not yet applied
  const reviewRows = db
    .prepare<{
      id: number
      short_ref: string
      task_id: number
      task_short_ref: string
      effort_id: number
      effort_short_ref: string
      effort_title: string
      verdict: string
      created_at: string
    }>(`
      SELECT
        reviews.id,
        reviews.short_ref,
        tasks.id AS task_id,
        tasks.short_ref AS task_short_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_short_ref,
        efforts.title AS effort_title,
        reviews.verdict,
        reviews.created_at
      FROM reviews
      JOIN tasks ON tasks.id = reviews.task_id
      JOIN efforts ON efforts.id = tasks.effort_id
      WHERE reviews.applied_at IS NULL
    `)
    .all()

  for (const row of reviewRows) {
    notifications.push({
      id: row.id,
      kind: 'review-pass',
      effortId: row.effort_id,
      effortShortRef: row.effort_short_ref,
      effortTitle: row.effort_title,
      entityId: row.task_id,
      entityShortRef: row.task_short_ref,
      entityType: 'review',
      message: `${row.verdict} pending approval`,
      startedAt: row.created_at,
    })
  }

  // Pending input requests
  const inputRows = db
    .prepare<{
      id: number
      short_ref: string
      effort_id: number
      effort_short_ref: string
      effort_title: string
      plan_id: number | null
      task_id: number | null
      review_id: number | null
      prompt: string
      type: string
      requested_at: string
    }>(`
      SELECT
        input_requests.id,
        input_requests.short_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_short_ref,
        efforts.title AS effort_title,
        input_requests.plan_id,
        input_requests.task_id,
        input_requests.review_id,
        input_requests.prompt,
        input_requests.type,
        input_requests.requested_at
      FROM input_requests
      JOIN efforts ON efforts.id = input_requests.effort_id
      WHERE input_requests.status = 'pending'
    `)
    .all()

  for (const row of inputRows) {
    const entityType = row.review_id ? 'review' : row.task_id ? 'task' : row.plan_id ? 'plan' : 'effort'
    const entityId = row.review_id ?? row.task_id ?? row.plan_id ?? row.effort_id

    notifications.push({
      id: row.id,
      kind: 'input-request',
      effortId: row.effort_id,
      effortShortRef: row.effort_short_ref,
      effortTitle: row.effort_title,
      entityId: entityId,
      entityShortRef: row.short_ref,
      entityType: entityType,
      message: row.prompt,
      startedAt: row.requested_at,
    })
  }

  return notifications.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
}

export function countPendingNotifications(db: AppDatabase): number {
  const planCount = db
    .prepare<{ count: number }>(`
      SELECT COUNT(*) AS count FROM plans
      WHERE ready_at IS NOT NULL AND accepted_at IS NULL
    `)
    .get()!.count

  const taskCount = db
    .prepare<{ count: number }>(`
      SELECT COUNT(*) AS count FROM tasks WHERE status = 'reviewing'
    `)
    .get()!.count

  const reviewCount = db
    .prepare<{ count: number }>(`
      SELECT COUNT(*) AS count FROM reviews WHERE applied_at IS NULL
    `)
    .get()!.count

  const inputCount = db
    .prepare<{ count: number }>(`
      SELECT COUNT(*) AS count FROM input_requests WHERE status = 'pending'
    `)
    .get()!.count

  return planCount + taskCount + reviewCount + inputCount
}

export function getPendingNotificationsByEffort(
  db: AppDatabase,
  effortId: number,
): PendingNotification[] {
  return listPendingNotifications(db).filter((n) => n.effortId === effortId)
}
