import { useEffect, useState } from 'react'
import styles from './ToggleSwitch.module.css'

type ToggleSwitchProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}

export function ToggleSwitch({ label, checked, onChange, disabled, ariaLabel }: ToggleSwitchProps) {
  const [optimisticChecked, setOptimisticChecked] = useState(checked)

  useEffect(() => {
    setOptimisticChecked(checked)
  }, [checked])

  function handleToggle() {
    if (disabled) return
    const next = !optimisticChecked
    setOptimisticChecked(next)
    onChange(next)
  }

  return (
    <div className={styles['toggle-switch']}>
      <span className={styles['toggle-copy']}>
        <span className={styles['toggle-label']}>{label}</span>
        <span className={styles['toggle-value']}>{optimisticChecked ? 'on' : 'off'}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-label={ariaLabel ?? label}
        aria-checked={optimisticChecked}
        disabled={disabled}
        className={`${styles['toggle-track']} ${optimisticChecked ? styles.checked : ''}`}
        onClick={handleToggle}
      >
        <span className={styles['toggle-thumb']} />
      </button>
    </div>
  )
}
