import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { ChevronDown, ExternalLink, Play, Plus, RotateCcw, Square, X } from 'lucide-react'
import type { AgentRun, InputRequest, LiveAgentRunSession } from '../../../core/types'
import { InputDock } from './InputDock'
import { Ref } from '../ui/Ref'
import { Stamp, statusTone } from '../ui/Stamp'
import styles from './AgentRunTerminal.module.css'

type TerminalEntry = {
  terminal: Terminal
  fit: FitAddon
  lastLiveSession: LiveAgentRunSession | null
  lastPtySize: TerminalSize | null
  pendingInitialResizeTolerance: boolean
  dispose: () => void
}

type TerminalSize = {
  cols: number
  rows: number
}

type FitScheduleMode = 'immediate' | 'settled'
const TERMINAL_LAYOUT_SETTLE_MS = 200

type XtermViewportInternals = {
  _core?: {
    _viewport?: {
      queueSync?: () => void
    }
  }
}

type IdleTerminalEntry = {
  terminal: Terminal
  fit: FitAddon
  dispose: () => void
}

type TerminalPalette = {
  theme: {
    background: string
    foreground: string
    cursor: string
    selectionBackground: string
  }
  idleArt: {
    top: string
    upper: string
    lower: string
    base: string
    label: string
    helper: string
  }
}

type TerminalTab = {
  key: string
  label: string
  tooltip?: string | null
  run: AgentRun | null
  hasLiveSession?: boolean
  providerLive?: boolean
  profileLabel?: string | null
  branchLabel?: string | null
  taskId?: number | null
  purpose?: AgentRun['purpose'] | null
  kind?: 'terminal' | 'work'
  workTaskId?: number | null
}

type MountedTerminalRun = {
  run: AgentRun
  hasLiveSession: boolean
  providerLive: boolean
  reattached: boolean
  liveSession: LiveAgentRunSession | null
}

type AgentRunTerminalProps = {
  activeRun: AgentRun | null
  tabs?: TerminalTab[]
  mountedRuns?: MountedTerminalRun[]
  activeTabKey?: string
  isStarting: boolean
  activeRunHasLiveSession?: boolean
  activeRunProviderLive?: boolean
  startDisabled?: boolean
  emptyLabel?: string
  ptyAvailable?: boolean
  menuOpen?: boolean
  onStart?: () => void
  onForkMain?: () => void
  onResume?: (runId: number) => void
  onSelectTab?: (tabKey: string) => void
  onOpenTask?: (taskId: number) => void
  onStop: (runId: number) => void
  onToggleMenu?: (open: boolean) => void
  onTerminalSizeChange?: (size: { cols: number; rows: number }) => void
  drawerClosedAt?: number
  forkMainDisabledReason?: string | null
  workPane?: ReactNode
  onCloseWorkTab?: (key: string) => void
  dockInputs?: InputRequest[]
  dockHiddenCount?: number
  onAnswerDockInput?: (inputRequestId: number, answer: string) => void
  isAnsweringDockInput?: boolean
  onOpenInputsDrawer?: () => void
}

export function AgentRunTerminal({
  activeRun,
  tabs = [],
  mountedRuns = [],
  activeTabKey,
  isStarting,
  activeRunHasLiveSession = false,
  activeRunProviderLive = false,
  startDisabled = false,
  emptyLabel = 'ready',
  ptyAvailable = true,
  menuOpen: menuOpenProp,
  onStart,
  onForkMain,
  onResume,
  onSelectTab,
  onOpenTask,
  onStop,
  onToggleMenu,
  onTerminalSizeChange,
  drawerClosedAt,
  forkMainDisabledReason,
  workPane,
  onCloseWorkTab,
  dockInputs = [],
  dockHiddenCount = 0,
  onAnswerDockInput,
  isAnsweringDockInput = false,
  onOpenInputsDrawer,
}: AgentRunTerminalProps) {
  const hostRefs = useRef(new Map<number, HTMLDivElement>())
  const terminalEntriesRef = useRef(new Map<number, TerminalEntry>())
  const idleHostRef = useRef<HTMLDivElement | null>(null)
  const idleEntryRef = useRef<IdleTerminalEntry | null>(null)
  const runsByIdRef = useRef(new Map<number, {
    run: AgentRun
    hasLiveSession: boolean
    providerLive: boolean
    liveSession: LiveAgentRunSession | null
  }>())
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuRowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const fitFrameRef = useRef<number | null>(null)
  const layoutSettleTimerRef = useRef<number | null>(null)
  const lastPublishedTerminalSizeRef = useRef<TerminalSize | null>(null)
  const scheduleFitAndRefreshRef = useRef<(runId?: number, mode?: FitScheduleMode, reason?: string) => void>(() => {})
  const [menuOpenInternal, setMenuOpenInternal] = useState(false)
  const [focusedMenuIndex, setFocusedMenuIndex] = useState(-1)

  const menuOpen = menuOpenProp ?? menuOpenInternal

  const closeMenu = useCallback(() => {
    if (menuOpenProp !== undefined) {
      onToggleMenu?.(false)
    } else {
      setMenuOpenInternal(false)
    }
    setFocusedMenuIndex(-1)
  }, [menuOpenProp, onToggleMenu])

  function openMenu() {
    if (menuOpenProp !== undefined) {
      onToggleMenu?.(true)
    } else {
      setMenuOpenInternal(true)
    }
  }

  useEffect(() => {
    const next = new Map<number, {
      run: AgentRun
      hasLiveSession: boolean
      providerLive: boolean
      liveSession: LiveAgentRunSession | null
    }>()
    for (const mountedRun of mountedRuns) {
      next.set(mountedRun.run.id, mountedRun)
    }
    for (const tab of tabs) {
      if (tab.run) {
        next.set(tab.run.id, {
          run: tab.run,
          hasLiveSession: Boolean(tab.hasLiveSession),
          providerLive: Boolean(tab.providerLive),
          liveSession: next.get(tab.run.id)?.liveSession ?? null,
        })
      }
    }
    runsByIdRef.current = next
  }, [mountedRuns, tabs])

  const queueViewportSync = useCallback((entry: TerminalEntry) => {
    const viewport = (entry.terminal as unknown as XtermViewportInternals)._core?._viewport
    viewport?.queueSync?.()
  }, [])

  const applyTerminalPalette = useCallback((terminal: Terminal, host: HTMLElement | null, cursorColor?: string) => {
    const palette = deriveTerminalPalette(host, cursorColor)
    terminal.options.theme = palette.theme
    return palette
  }, [])

  const publishTerminalSize = useCallback((size: TerminalSize) => {
    if (sameTerminalSize(lastPublishedTerminalSizeRef.current, size)) return
    lastPublishedTerminalSizeRef.current = size
    onTerminalSizeChange?.(size)
  }, [onTerminalSizeChange])

  const renderIdleTerminal = useCallback(() => {
    const entry = idleEntryRef.current
    if (!entry) return
    const palette = applyTerminalPalette(entry.terminal, idleHostRef.current, undefined)
    entry.fit.fit()
    publishTerminalSize({
      cols: entry.terminal.cols,
      rows: entry.terminal.rows,
    })
    drawIdleWordmark(entry.terminal, palette.idleArt)
  }, [applyTerminalPalette, publishTerminalSize])

  const fitAndRefreshTerminal = useCallback((runId?: number) => {
    const targetRunId = runId ?? (activeRunHasLiveSession ? activeRun?.id : undefined)
    const targets = targetRunId == null
      ? []
      : (() => {
          const entry = terminalEntriesRef.current.get(targetRunId)
          return entry ? [[targetRunId, entry] as const] : []
        })()

    for (const [targetRunId, entry] of targets) {
      entry.fit.fit()
      entry.terminal.refresh(0, Math.max(0, entry.terminal.rows - 1))
      queueViewportSync(entry)

      const target = runsByIdRef.current.get(targetRunId)
      if (target?.hasLiveSession) {
        const size = {
          cols: entry.terminal.cols,
          rows: entry.terminal.rows,
        }
        if (targetRunId === activeRun?.id) {
          publishTerminalSize(size)
        }
        if (entry.pendingInitialResizeTolerance && entry.lastPtySize && isMinorTerminalSizeDrift(entry.lastPtySize, size)) {
          entry.pendingInitialResizeTolerance = false
        } else if (!sameTerminalSize(entry.lastPtySize, size)) {
          entry.lastPtySize = size
          entry.pendingInitialResizeTolerance = false
          void window.effortless.resizeAgentRun(targetRunId, size)
        } else {
          entry.pendingInitialResizeTolerance = false
        }
      }
    }

    if (runId == null && !activeRunHasLiveSession) {
      renderIdleTerminal()
    }
  }, [queueViewportSync, activeRun?.id, activeRunHasLiveSession, renderIdleTerminal, publishTerminalSize])

  const scheduleFitAndRefresh = useCallback((runId?: number, mode: FitScheduleMode = 'immediate', _reason = 'unknown') => {
    const queueFit = () => {
      if (fitFrameRef.current != null) {
        window.cancelAnimationFrame(fitFrameRef.current)
      }
      fitFrameRef.current = window.requestAnimationFrame(() => {
        fitFrameRef.current = null
        fitAndRefreshTerminal(runId)
      })
    }

    if (mode === 'settled') {
      if (layoutSettleTimerRef.current != null) {
        window.clearTimeout(layoutSettleTimerRef.current)
      }
      layoutSettleTimerRef.current = window.setTimeout(() => {
        layoutSettleTimerRef.current = null
        queueFit()
      }, TERMINAL_LAYOUT_SETTLE_MS)
      return
    }

    if (layoutSettleTimerRef.current != null) {
      window.clearTimeout(layoutSettleTimerRef.current)
      layoutSettleTimerRef.current = null
    }
    queueFit()
  }, [fitAndRefreshTerminal])

  useEffect(() => {
    scheduleFitAndRefreshRef.current = scheduleFitAndRefresh
  }, [scheduleFitAndRefresh])

  const refreshTerminalPaint = useCallback((runId: number) => {
    const entry = terminalEntriesRef.current.get(runId)
    if (!entry) return

    const scrollable = entry.terminal.element?.querySelector('.xterm-scrollable-element') as HTMLElement | null

    entry.terminal.refresh(0, Math.max(0, entry.terminal.rows - 1))
    queueViewportSync(entry)

    if (
      scrollable &&
      entry.terminal.buffer.active.length > entry.terminal.rows &&
      scrollable.scrollHeight <= scrollable.clientHeight
    ) {
      scheduleFitAndRefresh(runId, 'settled', 'scrollability-recovery')
    }
  }, [queueViewportSync, scheduleFitAndRefresh])

  useEffect(() => {
    if (activeRunHasLiveSession || !idleHostRef.current) {
      idleEntryRef.current?.dispose()
      idleEntryRef.current = null
      return
    }
    if (idleEntryRef.current) {
      renderIdleTerminal()
      return
    }

    const terminal = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      convertEol: true,
      fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
      fontSize: 12,
      theme: deriveTerminalPalette(idleHostRef.current).theme,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(idleHostRef.current)
    const resizeObserver = new ResizeObserver(() => renderIdleTerminal())
    resizeObserver.observe(idleHostRef.current)

    idleEntryRef.current = {
      terminal,
      fit,
      dispose: () => {
        resizeObserver.disconnect()
        terminal.dispose()
      },
    }

    renderIdleTerminal()
  }, [activeRunHasLiveSession, renderIdleTerminal])

  useEffect(() => {
    const mountedRunIds = new Set<number>()
    for (const mountedRun of mountedRuns) {
      const runId = mountedRun.run.id
      mountedRunIds.add(runId)
      const existingEntry = terminalEntriesRef.current.get(runId)
      if (existingEntry) {
        existingEntry.lastLiveSession = mountedRun.liveSession
        continue
      }

      const host = hostRefs.current.get(runId)
      if (!host) continue

      const terminal = new Terminal({
        cols: mountedRun.liveSession?.cols,
        rows: mountedRun.liveSession?.rows,
        cursorBlink: false,
        fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
        fontSize: 12,
        theme: deriveTerminalPalette(host, undefined).theme,
      })
      const fit = new FitAddon()
      terminal.loadAddon(fit)
      terminal.open(host)
      const resizeObserver = new ResizeObserver(() => {
        scheduleFitAndRefresh(undefined, 'settled', 'resize-observer')
      })
      resizeObserver.observe(host)

      const dataDisposable = terminal.onData((data) => {
        const target = runsByIdRef.current.get(runId)
        if (target?.hasLiveSession) {
          void window.effortless.writeAgentRun(runId, data)
        }
      })
      const writeParsedDisposable = terminal.onWriteParsed(() => {
        refreshTerminalPaint(runId)
      })

      const entry: TerminalEntry = {
        terminal,
        fit,
        lastLiveSession: mountedRun.liveSession,
        lastPtySize: mountedRun.liveSession
          ? { cols: mountedRun.liveSession.cols, rows: mountedRun.liveSession.rows }
          : null,
        pendingInitialResizeTolerance: Boolean(mountedRun.liveSession),
        dispose: () => {
          resizeObserver.disconnect()
          writeParsedDisposable.dispose()
          dataDisposable.dispose()
          terminal.dispose()
        },
      }
      terminalEntriesRef.current.set(runId, entry)
      applyTerminalPalette(terminal, host, undefined)
      scheduleFitAndRefresh(runId, 'settled', 'terminal-create')
    }

    for (const [runId, entry] of terminalEntriesRef.current.entries()) {
      if (mountedRunIds.has(runId)) continue
      entry.dispose()
      terminalEntriesRef.current.delete(runId)
    }
  }, [activeRun?.id, activeRunHasLiveSession, applyTerminalPalette, mountedRuns, refreshTerminalPaint, scheduleFitAndRefresh])

  useEffect(() => {
    const root = document.documentElement
    const syncThemes = () => {
      const idleEntry = idleEntryRef.current
      if (idleEntry) {
        renderIdleTerminal()
      }

      for (const [runId, entry] of terminalEntriesRef.current.entries()) {
        applyTerminalPalette(entry.terminal, hostRefs.current.get(runId) ?? null)
        entry.terminal.refresh(0, Math.max(0, entry.terminal.rows - 1))
      }
    }

    const observer = new MutationObserver(syncThemes)
    observer.observe(root, { attributes: true, attributeFilter: ['style'] })
    syncThemes()

    return () => observer.disconnect()
  }, [applyTerminalPalette, renderIdleTerminal])

  useEffect(() => {
    const terminalEntries = terminalEntriesRef.current
    const handleWindowResize = () => scheduleFitAndRefreshRef.current(undefined, 'settled', 'window-resize')
    window.addEventListener('resize', handleWindowResize)

    return () => {
      if (layoutSettleTimerRef.current != null) {
        window.clearTimeout(layoutSettleTimerRef.current)
      }
      if (fitFrameRef.current != null) {
        window.cancelAnimationFrame(fitFrameRef.current)
      }
      window.removeEventListener('resize', handleWindowResize)
      idleEntryRef.current?.dispose()
      idleEntryRef.current = null
      for (const entry of terminalEntries.values()) {
        entry.dispose()
      }
      terminalEntries.clear()
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [closeMenu, menuOpen])

  const { mainTab, forkTabs, workTabs, otherTabs, stripTerminalTabs, orderedMenuTabs } = useMemo(() => {
    const mainTab = tabs.find((tab) => tab.key === 'main') ?? null
    const forkTabs = tabs.filter((tab) => tab.key !== 'main' && tab.purpose === 'fork' && tab.kind !== 'work')
    const workTabs = tabs.filter((tab) => tab.kind === 'work')
    const otherTabs = tabs.filter((tab) => tab.key !== 'main' && tab.purpose !== 'fork' && tab.kind !== 'work')
    const stripTerminalTabs = [
      ...(mainTab ? [mainTab] : []),
      ...forkTabs,
      ...otherTabs,
    ]
    return {
      mainTab,
      forkTabs,
      workTabs,
      otherTabs,
      stripTerminalTabs,
      orderedMenuTabs: stripTerminalTabs,
    }
  }, [tabs])

  useEffect(() => {
    if (!menuOpen) return

    function handleMenuKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeMenu()
        if (activeRun) {
          terminalEntriesRef.current.get(activeRun.id)?.terminal.focus()
        }
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setFocusedMenuIndex((i) => Math.min(i + 1, orderedMenuTabs.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setFocusedMenuIndex((i) => Math.max(i - 1, 0))
        return
      }

      if (event.key === 'Enter' && focusedMenuIndex >= 0) {
        event.preventDefault()
        const tab = orderedMenuTabs[focusedMenuIndex]
        if (tab) {
          onSelectTab?.(tab.key)
          closeMenu()
        }
        return
      }
    }

    window.addEventListener('keydown', handleMenuKeydown, true)
    return () => window.removeEventListener('keydown', handleMenuKeydown, true)
  }, [activeRun, closeMenu, focusedMenuIndex, menuOpen, orderedMenuTabs, onSelectTab])

  useEffect(() => {
    if (focusedMenuIndex >= 0) {
      menuRowRefs.current[focusedMenuIndex]?.focus()
    }
  }, [focusedMenuIndex])

  useEffect(() => {
    if (drawerClosedAt) {
      scheduleFitAndRefresh(undefined, 'settled', 'drawer-closed')
      if (activeRun && activeRunHasLiveSession) {
        terminalEntriesRef.current.get(activeRun.id)?.terminal.focus()
      }
    }
  }, [drawerClosedAt, scheduleFitAndRefresh, activeRun, activeRunHasLiveSession])

  useEffect(() => {
    scheduleFitAndRefresh(undefined, 'settled', 'menu-open-change')
  }, [menuOpen, scheduleFitAndRefresh])

  const activeRunId = activeRun?.id ?? null
  const displayStatus = resolveRunStatus(activeRun, activeRunHasLiveSession, activeRunProviderLive)

  useEffect(() => {
    return window.effortless.onAgentRunTerminalEvent((event) => {
      const entry = terminalEntriesRef.current.get(event.runId)
      if (!entry) return
      if (event.kind === 'data' && event.body) {
        entry.terminal.write(event.body)
      }
      if (event.kind === 'exit') {
        entry.terminal.writeln(`\r\n[run exited with code ${event.exitCode ?? 'unknown'}]`)
      }
      if (event.kind === 'error') {
        entry.terminal.writeln(`\r\n[run error] ${event.body ?? 'unknown error'}`)
      }
    })
  }, [])

  useEffect(() => {
    if (!activeRunId || !activeRunHasLiveSession) {
      renderIdleTerminal()
      return
    }
    scheduleFitAndRefresh(activeRunId, 'settled', 'active-run-change')
    terminalEntriesRef.current.get(activeRunId)?.terminal.focus()
  }, [activeRunId, activeRunHasLiveSession, scheduleFitAndRefresh, renderIdleTerminal])

  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? null
  const isWorkTabActive = activeTab?.kind === 'work'
  const canForkMain = Boolean(onForkMain) && !forkMainDisabledReason && !isStarting

  function selectStripTab(tabKey: string) {
    onSelectTab?.(tabKey)
  }

  function handleStripTabKeydown(event: { key: string; preventDefault: () => void }, tabKey: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectStripTab(tabKey)
    }
  }

  return (
    <section className={styles['terminal-section']}>
      <div className={styles['stage-tab-strip']}>
        <div className={styles['stage-tab-rail']}>
          {stripTerminalTabs.map((tab) => {
            const isLive = Boolean(tab.hasLiveSession || tab.providerLive)
            const isActive = tab.key === activeTabKey
            return (
              <button
                key={tab.key}
                type="button"
                className={`${styles['stage-tab']} ${isActive ? styles.active : ''}`}
                title={tab.label}
                aria-selected={isActive}
                onClick={() => selectStripTab(tab.key)}
                onKeyDown={(event) => handleStripTabKeydown(event, tab.key)}
              >
                <span
                  className={`${styles['stage-tab-live-dot']} ${isLive ? styles.live : styles.idle}`}
                  aria-hidden="true"
                />
                <span className={styles['stage-tab-label']}>{tab.label}</span>
              </button>
            )
          })}
          {workTabs.map((tab) => {
            const shortRef = workTabShortRef(tab)
            const isActive = tab.key === activeTabKey
            return (
              <div
                key={tab.key}
                className={`${styles['stage-tab']} ${styles.work} ${isActive ? styles.active : ''}`}
                title={tab.tooltip ?? tab.label}
              >
                <button
                  type="button"
                  className={styles['stage-tab-select']}
                  aria-selected={isActive}
                  onClick={() => selectStripTab(tab.key)}
                  onKeyDown={(event) => handleStripTabKeydown(event, tab.key)}
                >
                  <span className={styles['stage-tab-work-glyph']} aria-hidden="true">▹</span>
                  <Ref value={shortRef} />
                </button>
                <button
                  type="button"
                  className={styles['stage-tab-close']}
                  aria-label={`close ${shortRef}`}
                  title={`close ${shortRef}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCloseWorkTab?.(tab.key)
                  }}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            )
          })}
          <button
            type="button"
            className={styles['stage-tab-add']}
            aria-label="add terminal"
            title="add terminal"
            onClick={() => openMenu()}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        <div className={styles['stage-tab-strip-end']}>
          <div className={styles['stage-tab-status']}>
            {!isWorkTabActive ? (
              activeRun ? (
                <>
                  <Ref value={activeRun.shortRef} />
                  <Stamp label={displayStatus} tone={statusTone(displayStatus)} compact />
                </>
              ) : (
                <span className={styles['stage-tab-status-idle']}>{emptyLabel}</span>
              )
            ) : null}
          </div>
          <div ref={menuRef} className={styles['terminal-menu-shell']}>
            <button
              type="button"
              className={styles['stage-tab-menu-trigger']}
              aria-label="terminal overflow menu"
              aria-expanded={menuOpen}
              onClick={() => {
                if (menuOpen) {
                  closeMenu()
                } else {
                  openMenu()
                }
              }}
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className={styles['terminal-menu']} role="menu">
                {mainTab ? renderTerminalMenuRow(mainTab, 0) : null}

                <TerminalMenuSeparator label="forks" />
                <div className={styles['terminal-menu-section']}>
                  {forkTabs.length > 0 ? (
                    forkTabs.map((tab, tabIndex) => renderTerminalMenuRow(tab, tabIndex + 1))
                  ) : (
                    <p className={styles['terminal-menu-empty']}>no forks yet</p>
                  )}
                </div>
                <button
                  type="button"
                  className={styles['terminal-menu-sticky-action']}
                  disabled={!canForkMain}
                  title={forkMainDisabledReason ?? 'fork main'}
                  onClick={() => {
                    onForkMain?.()
                    closeMenu()
                  }}
                >
                  <Plus size={13} aria-hidden="true" />
                  <span>fork main</span>
                </button>

                <TerminalMenuSeparator label="others" />
                <div className={styles['terminal-menu-section']}>
                  {otherTabs.length > 0 ? (
                    otherTabs.map((tab, tabIndex) => renderTerminalMenuRow(tab, tabIndex + 1 + forkTabs.length))
                  ) : (
                    <p className={styles['terminal-menu-empty']}>no other terminals</p>
                  )}
                </div>
                <button
                  type="button"
                  className={`${styles['terminal-menu-sticky-action']} ${styles.secondary}`}
                  disabled
                  title="add terminal is coming next"
                >
                  <Plus size={13} aria-hidden="true" />
                  <span>add terminal</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className={styles['terminal-stage']}>
        {!isWorkTabActive && onAnswerDockInput && onOpenInputsDrawer ? (
          <InputDock
            inputs={dockInputs}
            hiddenCount={dockHiddenCount}
            onAnswer={onAnswerDockInput}
            isAnswering={isAnsweringDockInput}
            onOpenInputsDrawer={onOpenInputsDrawer}
          />
        ) : null}
        {isWorkTabActive && workPane ? (
          <div className={styles['work-pane-host']}>{workPane}</div>
        ) : null}
        <div className={`${styles['terminal-stack']} ${isWorkTabActive ? styles.hidden : ''}`}>
        {!ptyAvailable ? (
          <div className={styles['terminal-pty-unavailable']}>
            <p>embedded terminal unavailable</p>
            <p>node-pty did not load on this platform. runs can still be prepared; start will fail until native deps are fixed.</p>
          </div>
        ) : null}
        {!activeRunHasLiveSession && ptyAvailable ? (
          <div className={`${styles['terminal-host']} ${styles.active}`}>
            <div
              ref={idleHostRef}
              className={styles['terminal-shell']}
            />
          </div>
        ) : null}
        {mountedRuns.map(({ run }) =>
          run ? (
            <div
              key={run.id}
              className={`${styles['terminal-host']} ${run.id === activeRun?.id && activeRunHasLiveSession ? styles.active : styles.hidden}`}
            >
              <div
                ref={(node) => {
                  if (node) {
                    hostRefs.current.set(run.id, node)
                  } else {
                    hostRefs.current.delete(run.id)
                  }
                }}
                className={styles['terminal-shell']}
              />
            </div>
          ) : null,
        )}
      </div>
      </div>
    </section>
  )

  function renderTerminalMenuRow(tab: TerminalTab, tabIndex: number) {
    const status = resolveRunStatus(tab.run, Boolean(tab.hasLiveSession), Boolean(tab.providerLive))
    const canResume = Boolean(tab.run?.providerSessionId) && !tab.providerLive && !tab.hasLiveSession && !isStarting
    const canStop = Boolean(tab.run && tab.hasLiveSession && !isStarting)
    const canStartMain = tab.key === 'main' && Boolean(onStart) && !isStarting && !startDisabled
    const canOpenTask = tab.key !== 'main' && tab.taskId != null && Boolean(onOpenTask)
    const resumeTitle = resumeDisabledTitle(tab.run, Boolean(tab.providerLive || tab.hasLiveSession), isStarting)
    const stopTitle = tab.run
      ? !canStop
        ? 'terminal session is not currently attached'
        : 'stop'
      : ''
    return (
                  <div
                    key={tab.key}
                    className={`${styles['terminal-menu-row']} ${tab.key === activeTabKey ? styles.active : ''}`}
                    role="menuitem"
                  >
                    <button
                      type="button"
                      className={styles['terminal-menu-select']}
                      tabIndex={-1}
                      ref={(el) => {
                        menuRowRefs.current[tabIndex] = el
                      }}
                      onClick={() => {
                        onSelectTab?.(tab.key)
                        closeMenu()
                      }}
                    >
                      <strong>{tab.label}</strong>
                      {tab.run?.shortRef ? <Ref value={tab.run.shortRef} /> : <span>no run</span>}
                      {renderMenuStatus(status)}
                      <span>{tab.profileLabel ?? 'no profile'}</span>
                      <span>{tab.branchLabel ?? (tab.key === 'main' ? 'effort' : 'no branch')}</span>
                    </button>
                    <div className={styles['terminal-menu-actions']}>
                      {canOpenTask ? (
                        <button
                          type="button"
                          className={styles['terminal-menu-icon-action']}
                          aria-label={`open ${tab.label} task`}
                          title="open task"
                          onClick={() => {
                            onOpenTask?.(tab.taskId!)
                            closeMenu()
                          }}
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className={styles['terminal-menu-icon-spacer']} aria-hidden="true" />
                      )}
                      {canStartMain ? (
                        <button
                          type="button"
                          className={styles['terminal-menu-icon-action']}
                          aria-label="start main run"
                          title="start"
                          onClick={() => {
                            onStart?.()
                            closeMenu()
                          }}
                        >
                          <Play size={13} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className={styles['terminal-menu-icon-spacer']} aria-hidden="true" />
                      )}
                      {tab.run && onResume ? (
                        <button
                          type="button"
                          className={styles['terminal-menu-icon-action']}
                          aria-label={`resume ${tab.label}`}
                          title={resumeTitle}
                          disabled={!canResume}
                          onClick={() => {
                            onResume(tab.run!.id)
                            closeMenu()
                          }}
                        >
                          <RotateCcw size={13} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className={styles['terminal-menu-icon-spacer']} aria-hidden="true" />
                      )}
                      {tab.run ? (
                        <button
                          type="button"
                          className={styles['terminal-menu-icon-action']}
                          aria-label={`stop ${tab.label}`}
                          title={stopTitle}
                          disabled={!canStop}
                          onClick={() => {
                            onStop(tab.run!.id)
                            closeMenu()
                          }}
                        >
                          <Square size={12} aria-hidden="true" />
                        </button>
                      ) : (
                        <span className={styles['terminal-menu-icon-spacer']} aria-hidden="true" />
                      )}
                    </div>
                  </div>
    )
  }

}

function workTabShortRef(tab: TerminalTab): string {
  return tab.label.replace(/ work$/, '')
}

function TerminalMenuSeparator({ label }: { label: string }) {
  return (
    <div className={styles['terminal-menu-separator']}>
      <span />
      <strong>{label}</strong>
      <span />
    </div>
  )
}

function resolveRunStatus(
  run: AgentRun | null,
  hasLiveSession: boolean,
  providerLive: boolean,
): string {
  if (!run) return 'ready'
  if (providerLive) return 'running'
  if (hasLiveSession) return 'stale'
  return run.status
}

function renderMenuStatus(status: string) {
  return <Stamp label={status} tone={statusTone(status)} compact />
}

function resumeDisabledTitle(run: AgentRun | null, runLive: boolean | undefined, isStarting: boolean): string {
  if (!run) return ''
  if (isStarting) return 'another run is starting'
  if (!run.providerSessionId) return 'no provider session - start a new run and let the agent register its session'
  if (runLive) return 'run is currently live - stop before resuming'
  return 'resume'
}

function sameTerminalSize(left: TerminalSize | null, right: TerminalSize): boolean {
  return Boolean(left && left.cols === right.cols && left.rows === right.rows)
}

function isMinorTerminalSizeDrift(left: TerminalSize, right: TerminalSize): boolean {
  return Math.abs(left.cols - right.cols) <= 1 && Math.abs(left.rows - right.rows) <= 1
}

function drawIdleWordmark(terminal: Terminal, palette: TerminalPalette['idleArt']): void {
  const art = terminal.cols >= 56
    ? [
        ['e', 'f', 'f', 'o', 'r', 't', 'l', 'e', 's', 's'].join(' '),
        ['ee', 'ff', 'ff', 'oo', 'rr', 'tt', 'll', 'ee', 'ss', 'ss'].join(' '),
        ['eee', 'fff', 'fff', 'ooo', 'rrr', 'ttt', 'lll', 'eee', 'sss', 'sss'].join(' '),
        ['eeee', 'ffff', 'ffff', 'oooo', 'rrrr', 'tttt', 'llll', 'eeee', 'ssss', 'ssss'].join(' '),
      ]
    : terminal.cols >= 28
      ? [
          'effortless',
          'effortless',
          'effortless',
        ]
      : [
          'effortless',
        ]

  const body = [
    '',
    ansiText(palette.top, centerLine(terminal.cols, art[0])),
    ...(art[1]
      ? [ansiText(palette.upper, centerLine(terminal.cols, art[1]))]
      : []),
    ...(art[2]
      ? [ansiText(palette.lower, centerLine(terminal.cols, art[2]), true)]
      : []),
    ...(art[3]
      ? [ansiText(palette.base, centerLine(terminal.cols, art[3]), true)]
      : []),
    '',
    ansiText(palette.label, centerLine(terminal.cols, 'no live run')),
    ansiText(palette.helper, centerLine(terminal.cols, 'open the run menu to start or resume a session')),
  ]

  const topPad = Math.max(0, Math.floor((terminal.rows - body.length) / 2))
  const lines = [
    ...Array.from({ length: topPad }, () => ''),
    ...body,
  ]

  terminal.write('\x1b[?25l\x1b[2J\x1b[3J\x1b[H' + lines.join('\r\n'))
}

function centerLine(width: number, line: string): string {
  const padding = Math.max(0, Math.floor((width - line.length) / 2))
  return `${' '.repeat(padding)}${line}`
}

function deriveTerminalPalette(host: HTMLElement | null, cursorColor?: string): TerminalPalette {
  const rootStyles = window.getComputedStyle(document.documentElement)
  const hostStyles = host ? window.getComputedStyle(host) : rootStyles
  const background = resolveTerminalBackground(hostStyles, rootStyles)
  const foreground = readCssVar(rootStyles, '--text', '#d5dccd')
  const strong = readCssVar(rootStyles, '--text-strong', foreground)
  const muted = readCssVar(rootStyles, '--muted', foreground)
  const accent = readCssVar(rootStyles, '--accent', strong)
  const selectionBackground = rgbaString(mixColors(accent, strong, 0.28), 0.26)

  return {
    theme: {
      background,
      foreground,
      cursor: cursorColor ?? strong,
      selectionBackground,
    },
    idleArt: {
      top: mixColors(muted, foreground, 0.34),
      upper: foreground,
      lower: mixColors(accent, foreground, 0.34),
      base: accent,
      label: strong,
      helper: muted,
    },
  }
}

function readCssVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim()
  return value || fallback
}

function resolveTerminalBackground(
  hostStyles: CSSStyleDeclaration,
  rootStyles: CSSStyleDeclaration,
): string {
  const hostBackground = hostStyles.backgroundColor.trim()
  if (hostBackground && hostBackground !== 'transparent' && hostBackground !== 'rgba(0, 0, 0, 0)') {
    return hostBackground
  }
  return readCssVar(rootStyles, '--field', '#10120e')
}

function ansiText(color: string, text: string, bold = false): string {
  const [r, g, b] = parseColor(color)
  const prefix = bold ? '\x1b[1;' : '\x1b['
  return `${prefix}38;2;${r};${g};${b}m${text}\x1b[0m`
}

function mixColors(left: string, right: string, amount: number): string {
  const [lr, lg, lb] = parseColor(left)
  const [rr, rg, rb] = parseColor(right)
  const weight = Math.min(1, Math.max(0, amount))
  const inverse = 1 - weight
  return `rgb(${Math.round(lr * inverse + rr * weight)} ${Math.round(lg * inverse + rg * weight)} ${Math.round(lb * inverse + rb * weight)})`
}

function rgbaString(color: string, alpha: number): string {
  const [r, g, b] = parseColor(color)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function parseColor(color: string): [number, number, number] {
  const value = color.trim()
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    if (hex.length === 3) {
      return [
        Number.parseInt(hex[0] + hex[0], 16),
        Number.parseInt(hex[1] + hex[1], 16),
        Number.parseInt(hex[2] + hex[2], 16),
      ]
    }
    if (hex.length >= 6) {
      return [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ]
    }
  }

  const match = value.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  if (match) {
    return [
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10),
      Number.parseInt(match[3], 10),
    ]
  }

  return [213, 220, 205]
}
