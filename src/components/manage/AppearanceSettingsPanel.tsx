import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Download, Palette, Upload } from 'lucide-react'
import {
  applyTheme,
  applyThemePalette,
  THEME_IDS,
  THEME_LABELS,
  THEME_PALETTES,
  THEME_VARIABLES,
  type ThemeId,
  type ThemePalette,
} from '../../themes'
import styles from './AppearanceSettingsPanel.module.css'

type AppearanceSettingsPanelProps = {
  currentTheme: string
  customTheme: ThemePalette
  customThemeActive: boolean
  onUpdateTheme: (theme: string) => void
  onActivateCustomTheme: () => void
  onUpdateCustomTheme: (palette: ThemePalette) => void
}

const THEME_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'chrome',
    keys: [
      '--body-bg',
      '--body-text',
      '--main',
      '--sidebar',
      '--surface',
      '--panel',
      '--field',
      '--button',
      '--line',
      '--line-strong',
    ],
  },
  {
    title: 'text',
    keys: ['--text', '--text-strong', '--muted', '--accent', '--placeholder', '--focus-shadow'],
  },
  {
    title: 'diff',
    keys: THEME_VARIABLES.filter((key) => ![
      '--body-bg',
      '--body-text',
      '--main',
      '--sidebar',
      '--surface',
      '--panel',
      '--field',
      '--button',
      '--line',
      '--line-strong',
      '--text',
      '--text-strong',
      '--muted',
      '--accent',
      '--placeholder',
      '--focus-shadow',
    ].includes(key)),
  },
]

function prettyVariableName(key: string): string {
  return key.replace(/^--/, '').replaceAll('-', ' ')
}

function colorInputValue(value: string): string | null {
  const normalized = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
  }
  return null
}

function serializeCustomTheme(palette: ThemePalette): string {
  return JSON.stringify(
    {
      format: 'effortless-custom-theme',
      version: 1,
      palette,
    },
    null,
    2,
  )
}

function parseImportedTheme(text: string, basePalette: ThemePalette): ThemePalette {
  const parsed = JSON.parse(text) as unknown
  const candidate =
    parsed && typeof parsed === 'object' && 'palette' in parsed && parsed.palette && typeof parsed.palette === 'object'
      ? (parsed.palette as Record<string, unknown>)
      : (parsed as Record<string, unknown>)

  const nextPalette: ThemePalette = { ...basePalette }
  let recognizedCount = 0
  for (const key of THEME_VARIABLES) {
    const value = candidate[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      nextPalette[key] = value.trim()
      recognizedCount += 1
    }
  }

  if (recognizedCount === 0) {
    throw new Error('No theme variables were found in that file.')
  }

  return nextPalette
}

function ThemePreview({
  palette,
  className,
}: {
  palette: ThemePalette
  className?: string
}) {
  return (
    <div className={`${styles.preview} ${className ?? ''}`} aria-hidden="true">
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
  )
}

export function AppearanceSettingsPanel({
  currentTheme,
  customTheme,
  customThemeActive,
  onUpdateTheme,
  onActivateCustomTheme,
  onUpdateCustomTheme,
}: AppearanceSettingsPanelProps) {
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const customPalette = useMemo(() => ({ ...customTheme }), [customTheme])

  function handleSelect(theme: ThemeId) {
    applyTheme(theme)
    onUpdateTheme(theme)
  }

  function handleActivateCustom() {
    applyThemePalette(customPalette)
    onActivateCustomTheme()
    setImportError(null)
  }

  function handleCustomValueChange(key: string, value: string) {
    const next = {
      ...customPalette,
      [key]: value,
    }
    applyThemePalette(next)
    onUpdateCustomTheme(next)
    setImportError(null)
  }

  function handleExport() {
    const blob = new Blob([serializeCustomTheme(customPalette)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'effortless-custom-theme.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const nextPalette = parseImportedTheme(text, customPalette)
      applyThemePalette(nextPalette)
      onUpdateCustomTheme(nextPalette)
      onActivateCustomTheme()
      setImportError(null)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import that theme file.')
    } finally {
      event.target.value = ''
    }
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
          const active = !customThemeActive && currentTheme === id
          const palette = THEME_PALETTES[id]
          return (
            <button
              key={id}
              type="button"
              className={`${styles.card} ${active ? styles.active : ''}`}
              onClick={() => handleSelect(id)}
            >
              <ThemePreview palette={palette} />

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

        <button
          type="button"
          className={`${styles.card} ${styles['custom-card']} ${customThemeActive ? styles.active : ''}`}
          onClick={handleActivateCustom}
        >
          <ThemePreview palette={customPalette} />

          <div className={styles.cardFooter}>
            <span className={styles.label}>custom</span>
            <div className={styles['custom-card-icon']} aria-hidden="true">
              <Palette size={14} />
            </div>
          </div>
        </button>
      </div>

      <section className={styles.customEditor}>
        <div className={styles.customHeader}>
          <div className={styles.customHeaderCopy}>
            <h4>custom theme</h4>
            <p>Configure every theme token, then export it to keep a local copy.</p>
          </div>
          <div className={styles.customActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className={styles.hiddenInput}
              onChange={handleImport}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />
              <span>import</span>
            </button>
            <button type="button" onClick={handleExport}>
              <Download size={14} />
              <span>export</span>
            </button>
          </div>
        </div>

        {importError ? <p className={styles.importError}>{importError}</p> : null}

        <div className={styles.customPreviewBand}>
          <ThemePreview palette={customPalette} className={styles.customPreview} />
        </div>

        <div className={styles.customGroups}>
          {THEME_GROUPS.map((group) => (
            <section key={group.title} className={styles.customGroup}>
              <div className={styles.customGroupHeader}>
                <h5>{group.title}</h5>
              </div>
              <div className={styles.variableGrid}>
                {group.keys.map((key) => {
                  const value = customPalette[key]
                  const pickerValue = colorInputValue(value)
                  return (
                    <label key={key} className={styles.variableField}>
                      <span className={styles.variableLabel}>{prettyVariableName(key)}</span>
                      <div className={styles.variableControls}>
                        <span className={styles.variablePreview} style={{ background: value }} aria-hidden="true" />
                        {pickerValue ? (
                          <input
                            className={styles.colorInput}
                            type="color"
                            value={pickerValue}
                            onChange={(event) => handleCustomValueChange(key, event.target.value)}
                          />
                        ) : (
                          <span className={styles.colorInputPlaceholder} aria-hidden="true" />
                        )}
                        <input
                          className={styles.variableInput}
                          value={value}
                          onChange={(event) => handleCustomValueChange(key, event.target.value)}
                          onFocus={handleActivateCustom}
                        />
                      </div>
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </section>
  )
}
