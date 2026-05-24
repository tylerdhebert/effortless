import type { Task } from '../../../core/types'
import { WarningIndicator } from '../notifications/WarningIndicator'
import styles from './TaskList.module.css'

const statusColors: Record<string, string> = {
  open: '#5a5e54',
  'in-flight': '#c6a764',
  reviewing: '#c6a764',
  'changes-requested': '#cf7e62',
  accepted: '#8ccf62',
  merged: '#8ccf62',
}

type TaskListProps = {
  tasks: Task[]
  selectedTaskId: number | null
  onSelectTask: (taskId: number) => void
  pendingTaskIds?: Set<number>
  runBadgeByTaskId?: Map<number, string>
  variant?: 'list' | 'strip'
}

export function TaskList({
  tasks,
  selectedTaskId,
  onSelectTask,
  pendingTaskIds,
  runBadgeByTaskId,
  variant = 'list',
}: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="empty-state">no tasks</p>
  }

  return (
    <div className={`${styles['task-list']} ${variant === 'strip' ? styles['task-list--strip'] : ''}`}>
      {tasks.map((task) => {
        const runBadge = runBadgeByTaskId?.get(task.id) ?? null
        return (
        <button
          key={task.id}
          type="button"
          className={`${styles['task-list-row']} ${task.id === selectedTaskId ? styles.selected : ''}`}
          title={`${task.title} | ${task.description}${runBadge ? ` | run ${runBadge}` : ''}`}
          onClick={() => onSelectTask(task.id)}
        >
          {variant === 'strip' ? (
            <>
              <span
                className={styles['task-list-dot']}
                style={{ background: statusColors[task.status] ?? statusColors.open }}
                aria-hidden="true"
              />
              <span className={styles['task-list-ref']}>{task.shortRef}</span>
              {runBadge ? <span className={styles['task-list-run-badge']}>{runBadge}</span> : null}
              {pendingTaskIds?.has(task.id) ? (
                <WarningIndicator title="needs input" size={12} />
              ) : null}
              <span className={styles['task-list-flyout']}>
                <span className={styles['task-list-flyout-kicker']}>{task.status}</span>
                <strong>{task.title}</strong>
                <span>{task.description}</span>
              </span>
            </>
          ) : (
            <>
              <div className={styles['task-list-topline']}>
                <span
                  className={styles['task-list-dot']}
                  style={{ background: statusColors[task.status] ?? statusColors.open }}
                  aria-hidden="true"
                />
                <span className={styles['task-list-ref']}>{task.shortRef}</span>
                {runBadge ? <span className={styles['task-list-run-badge']}>{runBadge}</span> : null}
                {pendingTaskIds?.has(task.id) ? (
                  <WarningIndicator title="needs input" size={12} />
                ) : null}
              </div>
              <div className={styles['task-list-status-row']}>
                <span className={styles['task-list-status']}>{task.status}</span>
              </div>
              <strong className={styles['task-list-title']}>{task.title}</strong>
            </>
          )}
        </button>
      )})}
    </div>
  )
}
