import type { AppDatabase } from './db'

type PendingNotificationKind = 'task-review' | 'input-request'

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

  // Pending input requests
  const inputRows = db
    .prepare<{
      id: number
      short_ref: string
      effort_id: number
      effort_short_ref: string
      effort_title: string
      task_id: number | null
      run_id: number | null
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
        input_requests.task_id,
        input_requests.run_id,
        input_requests.prompt,
        input_requests.type,
        input_requests.requested_at
      FROM input_requests
      JOIN efforts ON efforts.id = input_requests.effort_id
      WHERE input_requests.status = 'pending'
    `)
    .all()

  for (const row of inputRows) {
    const entityType = row.task_id ? 'task' : row.run_id ? 'run' : 'effort'
    const entityId = row.task_id ?? row.run_id ?? row.effort_id

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
  const taskCount = db
    .prepare<{ count: number }>(`
      SELECT COUNT(*) AS count FROM tasks WHERE status = 'reviewing'
    `)
    .get()!.count

  const inputCount = db
    .prepare<{ count: number }>(`
      SELECT COUNT(*) AS count FROM input_requests WHERE status = 'pending'
    `)
    .get()!.count

  return taskCount + inputCount
}

export function getPendingNotificationsByEffort(
  db: AppDatabase,
  effortId: number,
): PendingNotification[] {
  return listPendingNotifications(db).filter((n) => n.effortId === effortId)
}
