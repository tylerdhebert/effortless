import { CircleHelp } from 'lucide-react'
import type { Task } from '../../../core/types'
import { WarningIndicator } from '../notifications/WarningIndicator'
import { Ref } from '../ui/Ref'
import { Stamp, statusTone } from '../ui/Stamp'
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
  variant?: 'list' | 'strip' | 'drawer'
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
    <div className={`${styles['task-list']} ${
      variant === 'strip' ? styles['task-list--strip'] : ''
    }${variant === 'drawer' ? ` ${styles['task-list--drawer']}` : ''}`}>
      {tasks.map((task) => {
        const runBadge = runBadgeByTaskId?.get(task.id) ?? null
        return (
        <button
          key={task.id}
          type="button"
          className={`${styles['task-list-row']} ${task.id === selectedTaskId ? styles.selected : ''}`}
          onClick={() => onSelectTask(task.id)}
        >
          {variant === 'drawer' ? (
            <>
              <Ref value={task.shortRef} />
              <Stamp label={task.status} tone={statusTone(task.status)} compact />
              <span className={styles['task-list-drawer-title']}>{task.title}</span>
              {pendingTaskIds?.has(task.id) ? (
                <WarningIndicator title="needs input" size={12} />
              ) : null}
              <span
                className={styles['task-list-drawer-hint']}
                title={task.description || undefined}
                aria-hidden={!task.description}
              >
                <CircleHelp size={13} />
              </span>
            </>
          ) : variant === 'strip' ? (
            <>
              <span
                className={styles['task-list-dot']}
                style={{ background: statusColors[task.status] ?? statusColors.open }}
                aria-hidden="true"
              />
              <Ref value={task.shortRef} />
              {runBadge ? (
                <Stamp label={runBadge} tone={statusTone(runBadge)} compact />
              ) : null}
              {pendingTaskIds?.has(task.id) ? (
                <WarningIndicator title="needs input" size={12} />
              ) : null}
              <span className={styles['task-list-flyout']}>
                <Stamp label={task.status} tone={statusTone(task.status)} compact />
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
                <Ref value={task.shortRef} />
                {runBadge ? (
                  <Stamp label={runBadge} tone={statusTone(runBadge)} compact />
                ) : null}
                {pendingTaskIds?.has(task.id) ? (
                  <WarningIndicator title="needs input" size={12} />
                ) : null}
              </div>
              <div className={styles['task-list-status-row']}>
                <Stamp label={task.status} tone={statusTone(task.status)} />
              </div>
              <strong className={styles['task-list-title']}>{task.title}</strong>
            </>
          )}
        </button>
      )})}
    </div>
  )
}
