import type { ThemePreference } from '../../../core/db'
import { PillSwitcher } from '../ui/PillSwitcher'
import styles from './AppearanceSettingsPanel.module.css'

type AppearanceSettingsPanelProps = {
  currentTheme: ThemePreference
  onUpdateTheme: (theme: ThemePreference) => void
}

const THEME_OPTIONS: Array<{ id: ThemePreference; label: string }> = [
  { id: 'system', label: 'system' },
  { id: 'dark', label: 'dark' },
  { id: 'light', label: 'light' },
]

export function AppearanceSettingsPanel({
  currentTheme,
  onUpdateTheme,
}: AppearanceSettingsPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3>appearance</h3>
      </div>

      <PillSwitcher
        options={THEME_OPTIONS}
        value={currentTheme}
        onChange={onUpdateTheme}
        ariaLabel="theme"
      />
    </section>
  )
}
