import styles from './ToggleSwitch.module.css'

type ToggleSwitchProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}

export function ToggleSwitch({ label, checked, onChange, disabled, ariaLabel }: ToggleSwitchProps) {
  return (
    <label className={styles['toggle-switch']} aria-label={ariaLabel ?? label}>
      <span className={styles['toggle-label']}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${styles['toggle-track']} ${checked ? styles.checked : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles['toggle-thumb']} />
      </button>
    </label>
  )
}
