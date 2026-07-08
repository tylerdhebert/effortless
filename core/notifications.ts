import type { AppDatabase } from './db'

export type PendingNotificationKind =
  | 'task-review'
  | 'input-request'
  | 'run-input-request'
  | 'run-failed'

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
  taskId: number | null
  terminalTabKey: string | null
}

export function formatNotificationKind(kind: PendingNotificationKind): string {
  switch (kind) {
    case 'task-review':
      return 'task review'
    case 'input-request':
      return 'input request'
    case 'run-input-request':
      return 'run input'
    case 'run-failed':
      return 'run failed'
    default:
      return kind
  }
}

export function isInputRequestNotification(kind: PendingNotificationKind): boolean {
  return kind === 'input-request' || kind === 'run-input-request'
}

export function listPendingNotifications(db: AppDatabase): PendingNotification[] {
  const notifications: PendingNotification[] = []

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
      taskId: row.id,
      terminalTabKey: null,
    })
  }

  const inputRows = db
    .prepare<{
      id: number
      short_ref: string
      effort_id: number
      effort_short_ref: string
      effort_title: string
      task_id: number | null
      task_short_ref: string | null
      run_id: number | null
      run_short_ref: string | null
      run_terminal_tab_key: string | null
      prompt: string
      requested_at: string
    }>(`
      SELECT
        input_requests.id,
        input_requests.short_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_short_ref,
        efforts.title AS effort_title,
        input_requests.task_id,
        tasks.short_ref AS task_short_ref,
        input_requests.run_id,
        agent_runs.short_ref AS run_short_ref,
        agent_runs.terminal_tab_key AS run_terminal_tab_key,
        input_requests.prompt,
        input_requests.requested_at
      FROM input_requests
      JOIN efforts ON efforts.id = input_requests.effort_id
      LEFT JOIN tasks ON tasks.id = input_requests.task_id
      LEFT JOIN agent_runs ON agent_runs.id = input_requests.run_id
      WHERE input_requests.status = 'pending'
    `)
    .all()

  for (const row of inputRows) {
    const runScoped = row.run_id != null
    notifications.push({
      id: row.id,
      kind: runScoped ? 'run-input-request' : 'input-request',
      effortId: row.effort_id,
      effortShortRef: row.effort_short_ref,
      effortTitle: row.effort_title,
      entityId: row.id,
      entityShortRef: row.short_ref,
      entityType: runScoped ? 'run' : row.task_id ? 'task' : 'effort',
      message: row.prompt,
      startedAt: row.requested_at,
      taskId: row.task_id,
      terminalTabKey: row.run_terminal_tab_key,
    })
  }

  const failedRunRows = db
    .prepare<{
      id: number
      short_ref: string
      effort_id: number
      effort_short_ref: string
      effort_title: string
      task_id: number | null
      label: string
      error: string | null
      terminal_tab_key: string | null
      updated_at: string
    }>(`
      SELECT
        agent_runs.id,
        agent_runs.short_ref,
        efforts.id AS effort_id,
        efforts.short_ref AS effort_short_ref,
        efforts.title AS effort_title,
        agent_runs.task_id,
        agent_runs.label,
        agent_runs.error,
        agent_runs.terminal_tab_key,
        agent_runs.updated_at
      FROM agent_runs
      JOIN efforts ON efforts.id = agent_runs.effort_id
      WHERE agent_runs.status = 'failed'
    `)
    .all()

  for (const row of failedRunRows) {
    notifications.push({
      id: row.id,
      kind: 'run-failed',
      effortId: row.effort_id,
      effortShortRef: row.effort_short_ref,
      effortTitle: row.effort_title,
      entityId: row.id,
      entityShortRef: row.short_ref,
      entityType: 'run',
      message: row.error?.trim() || `${row.label} failed`,
      startedAt: row.updated_at,
      taskId: row.task_id,
      terminalTabKey: row.terminal_tab_key,
    })
  }

  return notifications.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  )
}

export function getPendingNotificationsByEffort(
  db: AppDatabase,
  effortId: number,
): PendingNotification[] {
  return listPendingNotifications(db).filter((n) => n.effortId === effortId)
}
