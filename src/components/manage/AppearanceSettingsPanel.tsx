import { applyTheme, THEME_IDS, THEME_LABELS } from '../../themes'
import styles from './AppearanceSettingsPanel.module.css'

type AppearanceSettingsPanelProps = {
  currentTheme: string
  onUpdateTheme: (theme: string) => void
}

export function AppearanceSettingsPanel({ currentTheme, onUpdateTheme }: AppearanceSettingsPanelProps) {
  function handleSelect(theme: string) {
    applyTheme(theme)
    onUpdateTheme(theme)
  }

  return (
    <div className={styles.panel}>
      <h3>theme</h3>
      <div className={styles.grid}>
        {THEME_IDS.map((id) => {
          const active = currentTheme === id
          return (
            <button
              key={id}
              type="button"
              className={`${styles.chip} ${active ? styles.active : ''}`}
              onClick={() => handleSelect(id)}
            >
              <span className={styles.swatch} style={{ background: getSwatchColor(id) }} />
              <span className={styles.label}>{THEME_LABELS[id]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getSwatchColor(themeId: string): string {
  const colors: Record<string, string> = {
    grass: '#8ccf62',
    dark: '#a0a0a0',
    light: '#6366f1',
    gruvbox: '#fabd2f',
    dracula: '#bd93f9',
    vice: '#ff7edb',
    nord: '#88c0d0',
    'tokyo-night': '#7aa2f7',
    'catppuccin-mocha': '#89b4fa',
    monokai: '#a6e22e',
    'rose-pine': '#c4a7e7',
    'one-dark-pro': '#61afef',
    'github-dark': '#58a6ff',
    default: '#4f78f1',
    night: '#77a7ff',
    summer: '#db7a24',
    winter: '#d97b3f',
    wildflower: '#efc31f',
    wa: '#d67a57',
  }
  return colors[themeId] ?? '#888888'
}
