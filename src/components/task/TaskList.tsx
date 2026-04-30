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
}

export function TaskList({ tasks, selectedTaskId, onSelectTask, pendingTaskIds }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="empty-state">no tasks</p>
  }

  return (
    <div className={styles['task-list']}>
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          className={`${styles['task-list-row']} ${task.id === selectedTaskId ? styles.selected : ''}`}
          onClick={() => onSelectTask(task.id)}
        >
            <div className={styles['task-list-meta']}>
              <div className={styles['task-list-topline']}>
                <span
                  className={styles['task-list-dot']}
                  style={{ background: statusColors[task.status] ?? statusColors.open }}
                  aria-hidden="true"
                />
                <span className={styles['task-list-ref']}>{task.shortRef}</span>
                {pendingTaskIds?.has(task.id) ? (
                  <WarningIndicator title="needs input" size={12} />
                ) : null}
              </div>
              <span className={styles['task-list-status']}>{task.status}</span>
              {task.ownerAgentId ? (
                <span className={styles['task-list-agent']}>{task.ownerAgentId}</span>
              ) : null}
            </div>
          <strong className={styles['task-list-title']}>{task.title}</strong>
          <p className={styles['task-list-description']}>{task.description}</p>
        </button>
      ))}
    </div>
  )
}
