import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Square } from 'lucide-react'
import type { AttentionInput, AttentionVerdict } from '../../../core/attention'
import type { AgentRun, LiveAgentRunSession } from '../../../core/types'
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
  onNavigateRun: (run: AgentRun) => void
}

type PopoverRow =
  | { kind: 'input'; effortId: number; item: AttentionInput }
  | { kind: 'verdict'; effortId: number; item: AttentionVerdict }

type LiveRunRow = {
  run: AgentRun
  session: LiveAgentRunSession
}

const ATTENTION_PULSE_EVENT = 'effortless:attention-pulse'

export function pulseAttentionChip(): void {
  window.dispatchEvent(new CustomEvent(ATTENTION_PULSE_EVENT))
}

export function NeedsYou({ onNavigate, onNavigateRun }: NeedsYouProps) {
  const queryClient = useQueryClient()
  const clusterRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null)
  const [pulse, setPulse] = useState(false)
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1)

  const attentionQuery = useQuery({
    queryKey: ['attention'],
    queryFn: () => window.effortless.listAttention(),
  })

  const runsQuery = useQuery({
    queryKey: ['agent-runs', 'all'],
    queryFn: () => window.effortless.listAgentRuns(),
  })

  const liveSessionsQuery = useQuery({
    queryKey: ['agent-runs', 'live-sessions'],
    queryFn: () => window.effortless.listLiveAgentRunSessions(),
  })

  const stopRunMutation = useMutation({
    mutationFn: (runId: number) => window.effortless.stopAgentRun(runId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['agent-runs', 'live-sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['attention'] })
    },
  })

  const inputs = attentionQuery.data?.inputs ?? []
  const verdicts = attentionQuery.data?.verdicts ?? []
  const needsYouCount = inputs.length + verdicts.length

  const attentionRows = useMemo((): PopoverRow[] => [
    ...inputs.map((item) => ({ kind: 'input' as const, effortId: item.effortId, item })),
    ...verdicts.map((item) => ({ kind: 'verdict' as const, effortId: item.effortId, item })),
  ], [inputs, verdicts])

  const liveRunRows = useMemo((): LiveRunRow[] => {
    const sessionsByRunId = new Map((liveSessionsQuery.data ?? []).map((session) => [session.runId, session]))
    return (runsQuery.data ?? [])
      .map((run) => {
        const session = sessionsByRunId.get(run.id)
        return session ? { run, session } : null
      })
      .filter((row): row is LiveRunRow => row !== null)
  }, [liveSessionsQuery.data, runsQuery.data])

  const hasAnythingToShow = needsYouCount > 0 || liveRunRows.length > 0

  const groupedRows = useMemo(() => {
    const groups = new Map<string, { effortRef: string; rows: PopoverRow[] }>()
    for (const row of attentionRows) {
      const effortRef = row.item.effortRef
      const key = String(row.effortId)
      const existing = groups.get(key)
      if (existing) {
        existing.rows.push(row)
      } else {
        groups.set(key, { effortRef, rows: [row] })
      }
    }
    return Array.from(groups.values())
  }, [attentionRows])

  const updatePopoverPosition = useCallback(() => {
    const anchor = clusterRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.min(420, window.innerWidth - 16)
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
    setPopoverPosition({ top: rect.bottom + 6, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
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
  }, [open, updatePopoverPosition])

  useEffect(() => {
    function handlePulse() {
      setPulse(true)
      window.setTimeout(() => setPulse(false), 520)
    }

    window.addEventListener(ATTENTION_PULSE_EVENT, handlePulse)
    return () => window.removeEventListener(ATTENTION_PULSE_EVENT, handlePulse)
  }, [])

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
    setOpen(false)
    setFocusedRowIndex(-1)
  }, [onNavigate])

  const navigateRun = useCallback((run: AgentRun) => {
    onNavigateRun(run)
    setOpen(false)
    setFocusedRowIndex(-1)
  }, [onNavigateRun])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        setFocusedRowIndex(-1)
        return
      }

      if (event.key === 'ArrowDown') {
        if (attentionRows.length === 0) return
        event.preventDefault()
        setFocusedRowIndex((index) => Math.min(index + 1, attentionRows.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        if (attentionRows.length === 0) return
        event.preventDefault()
        setFocusedRowIndex((index) => Math.max(index - 1, 0))
        return
      }

      if (event.key === 'Enter' && focusedRowIndex >= 0) {
        event.preventDefault()
        const row = attentionRows[focusedRowIndex]
        if (row) {
          navigateRow(row)
        }
      }
    }

    function handleBlur() {
      setOpen(false)
      setFocusedRowIndex(-1)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('blur', handleBlur)
    }
  }, [attentionRows, focusedRowIndex, navigateRow, open])

  useEffect(() => {
    if (!open) return
    setFocusedRowIndex(attentionRows.length > 0 ? 0 : -1)
  }, [open, attentionRows.length])

  if (!hasAnythingToShow) {
    return null
  }

  let flatRowIndex = -1

  return (
    <>
      <div ref={clusterRef} className={styles.cluster} aria-label="attention">
        <button
          type="button"
          className={`${styles.trigger} ${pulse ? styles.pulse : ''}`}
          aria-label="attention"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((current) => !current)}
        >
          <Bell size={14} />
          {needsYouCount > 0 ? <span className={styles.badge}>{needsYouCount}</span> : null}
        </button>
      </div>

      {open && popoverPosition
        ? createPortal(
            <>
              <div
                className={styles.backdrop}
                aria-hidden="true"
                onMouseDown={() => {
                  setOpen(false)
                  setFocusedRowIndex(-1)
                }}
              />
              <div
                ref={popoverRef}
                className={styles.popover}
                role="dialog"
                aria-label="attention"
                style={{ top: popoverPosition.top, left: popoverPosition.left }}
              >
                {groupedRows.length > 0 ? (
                  <section className={styles.section}>
                    <h2 className={styles['section-header']}>needs you</h2>
                    {groupedRows.map((group) => (
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
                              className={`${styles.row} ${styles['attention-row']} ${
                                focusedRowIndex === rowIndex ? styles.focused : ''
                              }`}
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
                    ))}
                  </section>
                ) : null}

                {liveRunRows.length > 0 ? (
                  <section className={styles.section}>
                    <h2 className={styles['section-header']}>in flight</h2>
                    {liveRunRows.map(({ run, session }) => {
                      const status = session.providerLive ? 'running' : 'stale'
                      const contextLabel = run.taskId != null
                        ? run.terminalTabKey?.replace(/^task-/, '') || `task-${run.taskId}`
                        : run.terminalTabKey ?? 'main'
                      return (
                        <div
                          key={run.id}
                          role="button"
                          tabIndex={0}
                          className={`${styles.row} ${styles['run-row']}`}
                          onClick={() => navigateRun(run)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            navigateRun(run)
                          }}
                        >
                          <Ref value={run.shortRef} />
                          <Stamp label={status} tone={session.providerLive ? 'live' : 'neutral'} compact />
                          <span className={styles.context}>{contextLabel}</span>
                          <button
                            type="button"
                            className={styles.stop}
                            aria-label={`stop ${run.shortRef}`}
                            title="stop"
                            disabled={stopRunMutation.isPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              stopRunMutation.mutate(run.id)
                            }}
                          >
                            <Square size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </section>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
