import type { Task } from '../../core/types'

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
}

export function TaskList({ tasks, selectedTaskId, onSelectTask }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="empty-state">no tasks</p>
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          className={`task-list-row ${task.id === selectedTaskId ? 'selected' : ''}`}
          onClick={() => onSelectTask(task.id)}
        >
          <span
            className="task-list-dot"
            style={{ background: statusColors[task.status] ?? statusColors.open }}
            aria-hidden="true"
          />
          <span className="task-list-ref">{task.shortRef}</span>
          <span className="task-list-title">{task.title}</span>
        </button>
      ))}
    </div>
  )
}