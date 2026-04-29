import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { FileText, Folder } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RefObject } from 'react'
import styles from './PathPicker.module.css'

type BrowseResult = {
  path: string
  sep: string
  parent: string | null
  entries: Array<{ name: string; isDir: boolean }>
}

type PopoverPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

type PathBrowserPopoverProps = {
  open: boolean
  browsing: string | undefined
  setBrowsing: (path: string | undefined) => void
  selectFiles: boolean
  anchorRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onSelect: (path: string) => void
}

export function PathBrowserPopover({
  open,
  browsing,
  setBrowsing,
  selectFiles,
  anchorRef,
  onClose,
  onSelect,
}: PathBrowserPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PopoverPosition | null>(null)

  const { data, isFetching } = useQuery<BrowseResult>({
    queryKey: ['filesystem-browse', browsing ?? '', selectFiles],
    queryFn: () => window.effortless.browsePath(browsing, selectFiles),
    enabled: open,
    placeholderData: keepPreviousData,
  })

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const width = Math.min(Math.max(rect.width, 420), viewportWidth - 16)
    const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8))
    const belowSpace = viewportHeight - rect.bottom - 8
    const aboveSpace = rect.top - 8
    const openAbove = belowSpace < 280 && aboveSpace > belowSpace
    const maxHeight = Math.max(180, Math.min(360, (openAbove ? aboveSpace : belowSpace) - 12))
    const estimatedHeight = Math.min(360, maxHeight)
    const top = openAbove
      ? Math.max(8, rect.top - estimatedHeight - 8)
      : Math.min(viewportHeight - estimatedHeight - 8, rect.bottom + 8)

    setPosition({ top, left, width, maxHeight })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    const handle = () => updatePosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorRef, onClose, open])

  useEffect(() => {
    if (open) updatePosition()
  }, [data, open, updatePosition])

  useLayoutEffect(() => {
    if (!popoverRef.current || !position) return
    const actual = popoverRef.current.getBoundingClientRect().height
    const maxTop = window.innerHeight - actual - 8
    if (position.top > maxTop) {
      setPosition((previous) => (previous ? { ...previous, top: Math.max(8, maxTop) } : previous))
    }
  }, [position?.left, position?.top])

  if (!open || !position) return null

  return createPortal(
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      <div className={styles['popover-header']}>
        <span className={styles['current-path']}>{data?.path ?? browsing ?? 'loading...'}</span>
        {isFetching ? <span className={styles.syncing}>syncing</span> : null}
        <button type="button" className={styles['close-button']} onClick={onClose}>
          close
        </button>
      </div>

      <div className={styles['entry-list']} style={{ maxHeight: position.maxHeight }}>
        {!data ? (
          <p className={styles.empty}>loading...</p>
        ) : (
          <>
            {data.parent ? (
              <button
                type="button"
                className={styles.entry}
                onClick={() => setBrowsing(data.parent ?? undefined)}
              >
                <span className={styles['entry-icon']}>..</span>
                <span className={styles['entry-name']}>parent directory</span>
              </button>
            ) : null}

            {data.entries.length === 0 ? (
              <p className={styles.empty}>
                {selectFiles ? 'no files or subdirectories' : 'no subdirectories'}
              </p>
            ) : null}

            {data.entries.map((entry) => {
              const entryPath = `${data.path}${data.sep}${entry.name}`
              const Icon = entry.isDir ? Folder : FileText
              const handleClick = entry.isDir ? () => setBrowsing(entryPath) : () => onSelect(entryPath)

              return (
                <button
                  key={entry.name}
                  type="button"
                  className={styles.entry}
                  onClick={handleClick}
                >
                  <span className={styles['entry-icon']}>
                    <Icon size={15} />
                  </span>
                  <span className={styles['entry-name']}>{entry.name}</span>
                </button>
              )
            })}
          </>
        )}
      </div>

      <div className={styles['popover-footer']}>
        <span className={styles['footer-path']}>{data?.path ?? ''}</span>
        <div className={styles['popover-actions']}>
          <button type="button" onClick={onClose}>
            cancel
          </button>
          <button
            type="button"
            className={styles['select-button']}
            onClick={() => {
              if (data?.path) onSelect(data.path)
            }}
          >
            select
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
