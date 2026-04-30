import { AlertTriangle } from 'lucide-react'
import styles from './WarningIndicator.module.css'

type WarningIndicatorProps = {
  title?: string
  pulse?: boolean
  size?: number
}

export function WarningIndicator({ title, pulse = false, size = 14 }: WarningIndicatorProps) {
  return (
    <span
      className={`${styles.indicator} ${pulse ? styles.pulse : ''}`}
      title={title}
      aria-label={title}
    >
      <AlertTriangle size={size} />
    </span>
  )
}
