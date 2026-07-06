import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AttentionInput, AttentionVerdict } from '../../../core/attention'
import { Ref } from '../ui/Ref'
import { Stamp } from '../ui/Stamp'
import styles from './NeedsYou.module.css'

export type AttentionNavigateTarget = {
  effortId: number
  taskId?: number
  inputId?: number
}

type NeedsYouProps = {
  onNavigate: (target: AttentionNavigateTarget) => void
}

type PopoverRow =
  | { kind: 'input'; effortId: number; item: AttentionInput }
  | { kind: 'verdict'; effortId: number; item: AttentionVerdict }

const ATTENTION_PULSE_EVENT = 'effortless:attention-pulse'

export function pulseAttentionChip(): void {
  window.dispatchEvent(new CustomEvent(ATTENTION_PULSE_EVENT))
}

export function NeedsYou({ onNavigate }: NeedsYouProps) {
  const clusterRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [openChip, setOpenChip] = useState<'inputs' | 'verdicts' | null>(null)
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null)
  const [pulseInputs, setPulseInputs] = useState(false)
  const [pulseVerdicts, setPulseVerdicts] = useState(false)
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)

  const attentionQuery = useQuery({
    queryKey: ['attention'],
    queryFn: () => window.effortless.listAttention(),
  })

  const inputs = attentionQuery.data?.inputs ?? []
  const verdicts = attentionQuery.data?.verdicts ?? []
  const inputCount = inputs.length
  const verdictCount = verdicts.length
  const hasAttention = inputCount > 0 || verdictCount > 0

  const activeRows = useMemo((): PopoverRow[] => {
    if (openChip === 'inputs') {
      return inputs.map((item) => ({ kind: 'input' as const, effortId: item.effortId, item }))
    }
    if (openChip === 'verdicts') {
      return verdicts.map((item) => ({ kind: 'verdict' as const, effortId: item.effortId, item }))
    }
    return []
  }, [openChip, inputs, verdicts])

  const groupedRows = useMemo(() => {
    const groups = new Map<string, { effortRef: string; rows: PopoverRow[] }>()
    for (const row of activeRows) {
      const effortRef = row.kind === 'input' ? row.item.effortRef : row.item.effortRef
      const key = String(row.effortId)
      const existing = groups.get(key)
      if (existing) {
        existing.rows.push(row)
      } else {
        groups.set(key, { effortRef, rows: [row] })
      }
    }
    return Array.from(groups.values())
  }, [activeRows])

  const updatePopoverPosition = useCallback(() => {
    const anchor = clusterRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(420, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    setPopoverPosition({ top: rect.bottom + 6, left })
  }, [])

  useLayoutEffect(() => {
    if (!openChip) {
      setPopoverPosition(null)
      return
    }
    updatePopoverPosition()
    const handle = () => updatePopoverPosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [openChip, updatePopoverPosition])

  useEffect(() => {
    function handlePulse() {
      if (inputCount > 0) {
        setPulseInputs(true)
        window.setTimeout(() => setPulseInputs(false), 520)
      } else if (verdictCount > 0) {
        setPulseVerdicts(true)
        window.setTimeout(() => setPulseVerdicts(false), 520)
      }
    }

    window.addEventListener(ATTENTION_PULSE_EVENT, handlePulse)
    return () => window.removeEventListener(ATTENTION_PULSE_EVENT, handlePulse)
  }, [inputCount, verdictCount])

  const navigateRow = useCallback((row: PopoverRow) => {
    if (row.kind === 'input') {
      onNavigate({
        effortId: row.item.effortId,
        taskId: row.item.taskId ?? undefined,
        inputId: row.item.id,
      })
    } else {
      onNavigate({
        effortId: row.item.effortId,
        taskId: row.item.taskId,
      })
    }
    setOpenChip(null)
    setFocusedRowIndex(-1)
  }, [onNavigate])

  useEffect(() => {
    if (!openChip) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpenChip(null)
        setFocusedRowIndex(-1)
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setFocusedRowIndex((index) => Math.min(index + 1, activeRows.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setFocusedRowIndex((index) => Math.max(index - 1, 0))
        return
      }

      if (event.key === 'Enter' && focusedRowIndex >= 0) {
        event.preventDefault()
        const row = activeRows[focusedRowIndex]
        if (row) {
          navigateRow(row)
        }
      }
    }

    function handleBlur() {
      setOpenChip(null)
      setFocusedRowIndex(-1)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('blur', handleBlur)
    }
  }, [activeRows, focusedRowIndex, navigateRow, openChip])

  useEffect(() => {
    if (!openChip) return
    setFocusedRowIndex(activeRows.length > 0 ? 0 : -1)
  }, [openChip, activeRows.length])

  if (!hasAttention) {
    return null
  }

  function toggleChip(chip: 'inputs' | 'verdicts') {
    setOpenChip((current) => (current === chip ? null : chip))
  }

  let flatRowIndex = -1

  return (
    <>
      <div ref={clusterRef} className={styles.cluster} aria-label="needs you">
        {inputCount > 0 ? (
          <button
            type="button"
            className={`${styles.chip} ${pulseInputs ? styles.pulse : ''}`}
            aria-expanded={openChip === 'inputs'}
            aria-haspopup="dialog"
            onClick={() => toggleChip('inputs')}
          >
            <Stamp label={`${inputCount} input${inputCount === 1 ? '' : 's'}`} tone="gate" compact />
          </button>
        ) : null}
        {verdictCount > 0 ? (
          <button
            type="button"
            className={`${styles.chip} ${pulseVerdicts ? styles.pulse : ''}`}
            aria-expanded={openChip === 'verdicts'}
            aria-haspopup="dialog"
            onClick={() => toggleChip('verdicts')}
          >
            <Stamp label={`${verdictCount} verdict${verdictCount === 1 ? '' : 's'}`} tone="gate" compact />
          </button>
        ) : null}
      </div>

      {openChip && popoverPosition
        ? createPortal(
            <>
              <div
                className={styles.backdrop}
                aria-hidden="true"
                onMouseDown={() => {
                  setOpenChip(null)
                  setFocusedRowIndex(-1)
                }}
              />
              <div
                ref={popoverRef}
                className={styles.popover}
                role="dialog"
                aria-label={openChip === 'inputs' ? 'pending inputs' : 'pending verdicts'}
                style={{ top: popoverPosition.top, left: popoverPosition.left }}
              >
              {groupedRows.length === 0 ? (
                <p className={styles.empty}>nothing waiting</p>
              ) : (
                groupedRows.map((group) => (
                  <section key={group.effortRef} className={styles.group}>
                    <h3 className={styles['group-header']}>
                      <Ref value={group.effortRef} />
                    </h3>
                    {group.rows.map((row) => {
                      flatRowIndex += 1
                      const rowIndex = flatRowIndex
                      const preview =
                        row.kind === 'input'
                          ? row.item.prompt
                          : row.item.reviewSummary?.trim() || row.item.title
                      const refValue = row.kind === 'input' ? row.item.shortRef : row.item.taskRef
                      return (
                        <button
                          key={row.kind === 'input' ? `input-${row.item.id}` : `verdict-${row.item.taskId}`}
                          type="button"
                          className={`${styles.row} ${focusedRowIndex === rowIndex ? styles.focused : ''}`}
                          onClick={() => navigateRow(row)}
                          onMouseEnter={() => setFocusedRowIndex(rowIndex)}
                        >
                          <Ref value={refValue} />
                          <p className={styles.preview}>{preview}</p>
                          <span className={styles.arrow} aria-hidden="true">→</span>
                        </button>
                      )
                    })}
                  </section>
                ))
              )}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
