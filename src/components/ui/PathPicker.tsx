import { useCallback, useRef, useState } from 'react'
import { PathBrowserPopover } from './PathBrowserPopover'
import styles from './PathPicker.module.css'

type PathPickerProps = {
  value: string
  onChange: (path: string) => void
  placeholder?: string
  selectFiles?: boolean
  ariaLabel?: string
}

export function PathPicker({
  value,
  onChange,
  placeholder = 'select a directory...',
  selectFiles = false,
  ariaLabel,
}: PathPickerProps) {
  const [open, setOpen] = useState(false)
  const [browsing, setBrowsing] = useState<string | undefined>(undefined)
  const anchorRef = useRef<HTMLDivElement>(null)

  const openBrowser = useCallback(() => {
    let initialPath: string | undefined = value || undefined
    if (selectFiles && value) {
      const lastSeparator = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
      if (lastSeparator > 0) {
        initialPath = value.slice(0, lastSeparator)
      }
    }
    setBrowsing(initialPath)
    setOpen(true)
  }, [selectFiles, value])

  const handleSelect = useCallback(
    (path: string) => {
      onChange(path)
      setOpen(false)
    },
    [onChange],
  )

  return (
    <>
      <div ref={anchorRef} className={styles['path-picker']}>
        <input
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className={styles['browse-button']}
          onClick={openBrowser}
          title="browse filesystem"
        >
          browse
        </button>
      </div>

      <PathBrowserPopover
        open={open}
        browsing={browsing}
        setBrowsing={setBrowsing}
        selectFiles={selectFiles}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
      />
    </>
  )
}
