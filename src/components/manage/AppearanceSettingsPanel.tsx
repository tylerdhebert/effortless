import { applyTheme, THEME_IDS, THEME_LABELS, THEME_PALETTES } from '../../themes'
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
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>appearance</h3>
        </div>
      </div>

      <div className={styles.grid}>
        {THEME_IDS.map((id) => {
          const active = currentTheme === id
          const palette = THEME_PALETTES[id]
          return (
            <button
              key={id}
              type="button"
              className={`${styles.card} ${active ? styles.active : ''}`}
              onClick={() => handleSelect(id)}
            >
              <div className={styles.preview} aria-hidden="true">
                <div className={styles.previewFrame} style={{ background: palette['--body-bg'] }}>
                  <div className={styles.previewSidebar} style={{ background: palette['--sidebar'] }} />
                  <div className={styles.previewMain}>
                    <div className={styles.previewHeader}>
                      <span className={styles.previewAccent} style={{ background: palette['--accent'] }} />
                      <span className={styles.previewLine} style={{ background: palette['--line-strong'] }} />
                    </div>
                    <div className={styles.previewSurface} style={{ background: palette['--surface'] }}>
                      <span className={styles.previewSwatch} style={{ background: palette['--panel'] }} />
                      <span className={styles.previewSwatch} style={{ background: palette['--button'] }} />
                      <span className={styles.previewSwatch} style={{ background: palette['--field'] }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.label}>{THEME_LABELS[id]}</span>
                <div className={styles.paletteRow} aria-hidden="true">
                  <span className={styles.swatch} style={{ background: palette['--accent'] }} />
                  <span className={styles.swatch} style={{ background: palette['--panel'] }} />
                  <span className={styles.swatch} style={{ background: palette['--line-strong'] }} />
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
