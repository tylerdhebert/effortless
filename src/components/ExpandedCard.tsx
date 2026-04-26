import type { ReactNode } from 'react'

type ExpandedCardProps = {
  title: string
  variant: 'task' | 'review'
  dataKey: string
  onClose: () => void
  children: ReactNode
}

export function ExpandedCard({ title, variant, dataKey, onClose, children }: ExpandedCardProps) {
  const dataProps =
    variant === 'task'
      ? { 'data-task-card': dataKey.replace('task-', '') }
      : { 'data-review-card': dataKey.replace('review-', '') }

  return (
    <div className={`expanded-card ${variant}-expansion`} {...dataProps}>
      <header>
        <div className="expanded-card-heading">
          <span>{variant}</span>
          <h3>{title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="close card">
          x
        </button>
      </header>
      <div className="expanded-card-body">{children}</div>
    </div>
  )
}