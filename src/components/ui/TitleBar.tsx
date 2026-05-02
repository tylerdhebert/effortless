import { useCallback, useEffect, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'
import styles from './TitleBar.module.css'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const platform = window.effortless.platform
  const isMac = platform === 'darwin'

  const refreshMaximized = useCallback(async () => {
    const maximized = await window.effortless.isWindowMaximized()
    setIsMaximized(maximized)
  }, [])

  useEffect(() => {
    refreshMaximized()
  }, [refreshMaximized])

  async function handleMaximize() {
    await window.effortless.maximizeWindow()
    await refreshMaximized()
  }

  return (
    <header className={styles['title-bar']}>
      {isMac ? (
        <div className={styles['traffic-light-spacer']} aria-hidden="true" />
      ) : null}
      <div className={styles['title-bar-content']}>
        <span className={styles['app-title']}>effortless</span>
      </div>
      {isMac ? null : (
        <div className={styles['window-controls']}>
          <button
            type="button"
            className={styles['window-control']}
            onClick={() => window.effortless.minimizeWindow()}
            aria-label="minimize"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            className={styles['window-control']}
            onClick={handleMaximize}
            aria-label={isMaximized ? 'restore' : 'maximize'}
          >
            <Square size={10} />
          </button>
          <button
            type="button"
            className={`${styles['window-control']} ${styles.close}`}
            onClick={() => window.effortless.closeWindow()}
            aria-label="close"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </header>
  )
}
