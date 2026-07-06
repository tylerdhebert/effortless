import styles from './Stamp.module.css'

export type StampTone = 'neutral' | 'live' | 'gate' | 'ok' | 'danger'

const LIVE_STATUSES = new Set(['in-flight', 'running', 'live'])
const GATE_STATUSES = new Set(['reviewing', 'pending', 'prepared'])
const OK_STATUSES = new Set(['accepted', 'merged', 'passed', 'approve', 'complete', 'answered'])
const DANGER_STATUSES = new Set(['conflicted', 'failed', 'request-changes', 'changes-requested', 'orphaned'])

const TONE_CLASS: Record<StampTone, string> = {
  neutral: styles.toneNeutral,
  live: styles.toneLive,
  gate: styles.toneGate,
  ok: styles.toneOk,
  danger: styles.toneDanger,
}

export function statusTone(status: string): StampTone {
  if (LIVE_STATUSES.has(status)) return 'live'
  if (GATE_STATUSES.has(status)) return 'gate'
  if (OK_STATUSES.has(status)) return 'ok'
  if (DANGER_STATUSES.has(status)) return 'danger'
  return 'neutral'
}

export function Stamp({
  label,
  tone,
  compact = false,
}: {
  label: string
  tone: StampTone
  compact?: boolean
}) {
  return (
    <span className={`${styles.stamp} ${TONE_CLASS[tone]} ${compact ? styles.compact : ''}`}>
      {label}
    </span>
  )
}
