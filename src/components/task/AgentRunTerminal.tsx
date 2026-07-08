import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { ChevronDown, Play, Plus, RotateCcw, Square, X } from 'lucide-react'
import type { AgentRun, InputRequest, LiveAgentRunSession } from '../../../core/types'
import { THEME_PALETTES } from '../../themes'
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
  providerLabel?: string | null
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

type TaskTabFace = 'work' | 'session'

type TaskSessionRun = {
  run: AgentRun
  hasLiveSession: boolean
  providerLive: boolean
  providerLabel: string | null
}

type TaskSessionTab = {
  taskId: number
  shortRef: string
  title: string
  branchLabel: string | null
  run: AgentRun | null
  hasLiveSession: boolean
  providerLive: boolean
  providerLabel: string | null
  runs: TaskSessionRun[]
}

type AvailableTask = {
  id: number
  shortRef: string
  title: string
}

type AgentRunTerminalProps = {
  activeRun: AgentRun | null
  tabs?: TerminalTab[]
  taskSessionTabs?: TaskSessionTab[]
  mountedRuns?: MountedTerminalRun[]
  availableTasks?: AvailableTask[]
  openTaskIds?: number[]
  activeTabKey?: string
  activeTaskFace?: TaskTabFace | null
  isStarting: boolean
  activeRunHasLiveSession?: boolean
  activeRunProviderLive?: boolean
  startDisabled?: boolean
  emptyLabel?: string
  ptyAvailable?: boolean
  onStart?: () => void
  onForkMain?: () => void
  onResume?: (runId: number) => void
  onSelectTab?: (tabKey: string) => void
  onSetTaskFace?: (taskId: number, face: TaskTabFace) => void
  onSelectTaskRun?: (taskId: number, runId: number) => void
  onStartTaskSession?: (taskId: number) => void
  onOpenTaskPage?: (taskId: number) => void
  onStop: (runId: number) => void
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
  taskSessionTabs = [],
  mountedRuns = [],
  availableTasks = [],
  openTaskIds = [],
  activeTabKey,
  activeTaskFace = null,
  isStarting,
  activeRunHasLiveSession = false,
  activeRunProviderLive = false,
  startDisabled = false,
  emptyLabel = 'ready',
  ptyAvailable = true,
  onStart,
  onForkMain,
  onResume,
  onSelectTab,
  onSetTaskFace,
  onSelectTaskRun,
  onStartTaskSession,
  onOpenTaskPage,
  onStop,
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
  const createMenuRef = useRef<HTMLDivElement | null>(null)
  const createButtonRef = useRef<HTMLButtonElement | null>(null)
  const createMenuElRef = useRef<HTMLDivElement | null>(null)
  const runSwitcherButtonRef = useRef<HTMLButtonElement | null>(null)
  const runSwitcherMenuRef = useRef<HTMLDivElement | null>(null)
  const fitFrameRef = useRef<number | null>(null)
  const layoutSettleTimerRef = useRef<number | null>(null)
  const lastPublishedTerminalSizeRef = useRef<TerminalSize | null>(null)
  const scheduleFitAndRefreshRef = useRef<(runId?: number, mode?: FitScheduleMode, reason?: string) => void>(() => {})
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [createMenuPosition, setCreateMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [runSwitcherOpen, setRunSwitcherOpen] = useState(false)
  const [runSwitcherPosition, setRunSwitcherPosition] = useState<{ top: number; left: number } | null>(null)

  const closeCreateMenu = useCallback(() => {
    setCreateMenuOpen(false)
  }, [])

  const closeRunSwitcher = useCallback(() => {
    setRunSwitcherOpen(false)
  }, [])

  function toggleCreateMenu() {
    closeRunSwitcher()
    setCreateMenuOpen((open) => !open)
  }

  function toggleRunSwitcher() {
    closeCreateMenu()
    setRunSwitcherOpen((open) => !open)
  }

  const updateCreateMenuPosition = useCallback(() => {
    const button = createButtonRef.current
    if (!button) return
    const buttonRect = button.getBoundingClientRect()
    const menuWidth = 260
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8)
    setCreateMenuPosition({
      top: buttonRect.bottom + 6,
      left: Math.max(8, Math.min(buttonRect.left, maxLeft)),
    })
  }, [])

  const updateRunSwitcherPosition = useCallback(() => {
    const button = runSwitcherButtonRef.current
    if (!button) return
    const buttonRect = button.getBoundingClientRect()
    const menuWidth = 280
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8)
    setRunSwitcherPosition({
      top: buttonRect.bottom + 6,
      left: Math.max(8, Math.min(buttonRect.right - menuWidth, maxLeft)),
    })
  }, [])

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

  const idleTerminalCopy = useMemo(() => {
    if (!activeRun) {
      return {
        label: 'no live run',
        helper: 'hit + to start a session or open a task',
      }
    }
    const label = `${activeRun.shortRef} ended`
    if (activeRun.providerSessionId && !activeRunProviderLive && !activeRunHasLiveSession) {
      return {
        label,
        helper: 'resume it from the controls above, or start fresh from +',
      }
    }
    return {
      label,
      helper: 'start a fresh session from +',
    }
  }, [activeRun, activeRunHasLiveSession, activeRunProviderLive])

  const renderIdleTerminal = useCallback(() => {
    const entry = idleEntryRef.current
    if (!entry) return
    const palette = applyTerminalPalette(entry.terminal, idleHostRef.current, undefined)
    entry.fit.fit()
    publishTerminalSize({
      cols: entry.terminal.cols,
      rows: entry.terminal.rows,
    })
    drawIdleWordmark(entry.terminal, palette.idleArt, idleTerminalCopy.label, idleTerminalCopy.helper)
  }, [applyTerminalPalette, idleTerminalCopy, publishTerminalSize])

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
    if (!createMenuOpen) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        !createMenuRef.current?.contains(target) &&
        !createMenuElRef.current?.contains(target)
      ) {
        closeCreateMenu()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [closeCreateMenu, createMenuOpen])

  useEffect(() => {
    if (!runSwitcherOpen) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        !runSwitcherButtonRef.current?.contains(target) &&
        !runSwitcherMenuRef.current?.contains(target)
      ) {
        closeRunSwitcher()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [closeRunSwitcher, runSwitcherOpen])

  useLayoutEffect(() => {
    if (!createMenuOpen) {
      setCreateMenuPosition(null)
      return
    }

    updateCreateMenuPosition()
    const handle = () => updateCreateMenuPosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [createMenuOpen, updateCreateMenuPosition])

  useLayoutEffect(() => {
    if (!runSwitcherOpen) {
      setRunSwitcherPosition(null)
      return
    }

    updateRunSwitcherPosition()
    const handle = () => updateRunSwitcherPosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [runSwitcherOpen, updateRunSwitcherPosition])

  const { mainTab, workTabs, stripTerminalTabs } = useMemo(() => {
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
      workTabs,
      stripTerminalTabs,
    }
  }, [tabs])

  useEffect(() => {
    if (!createMenuOpen) return

    function handleCreateMenuKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeCreateMenu()
      if (activeRun) {
        terminalEntriesRef.current.get(activeRun.id)?.terminal.focus()
      }
    }

    window.addEventListener('keydown', handleCreateMenuKeydown, true)
    return () => window.removeEventListener('keydown', handleCreateMenuKeydown, true)
  }, [activeRun, closeCreateMenu, createMenuOpen])

  useEffect(() => {
    if (!runSwitcherOpen) return

    function handleRunSwitcherKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeRunSwitcher()
      if (activeRun) {
        terminalEntriesRef.current.get(activeRun.id)?.terminal.focus()
      }
    }

    window.addEventListener('keydown', handleRunSwitcherKeydown, true)
    return () => window.removeEventListener('keydown', handleRunSwitcherKeydown, true)
  }, [activeRun, closeRunSwitcher, runSwitcherOpen])

  useEffect(() => {
    if (drawerClosedAt) {
      scheduleFitAndRefresh(undefined, 'settled', 'drawer-closed')
      if (activeRun && activeRunHasLiveSession) {
        terminalEntriesRef.current.get(activeRun.id)?.terminal.focus()
      }
    }
  }, [drawerClosedAt, scheduleFitAndRefresh, activeRun, activeRunHasLiveSession])

  const activeRunId = activeRun?.id ?? null
  const displayStatus = resolveRunStatus(activeRun, activeRunHasLiveSession, activeRunProviderLive)
  const canResumeActiveRun = Boolean(activeRun?.providerSessionId) && !activeRunProviderLive && !activeRunHasLiveSession
  const activeRunResumeTitle = resumeDisabledTitle(activeRun, Boolean(activeRunProviderLive || activeRunHasLiveSession), isStarting)

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
  const activeTaskId = activeTab?.kind === 'work' ? activeTab.workTaskId ?? activeTab.taskId ?? null : null
  const activeTaskSessionTab = activeTaskId != null
    ? taskSessionTabs.find((tab) => tab.taskId === activeTaskId) ?? null
    : null
  const activeTaskShortRef = activeTaskSessionTab?.shortRef ?? (activeTab ? workTabShortRef(activeTab) : '')
  const isTaskTabActive = activeTab?.kind === 'work' && activeTaskId != null
  const isTaskSessionFaceActive = isTaskTabActive && activeTaskFace === 'session'
  const isWorkTabActive = activeTab?.kind === 'work' && !isTaskSessionFaceActive
  const showTaskSessionEmpty = Boolean(isTaskSessionFaceActive && activeTaskId != null && !activeRun)
  const canForkMain = Boolean(onForkMain) && !forkMainDisabledReason && !isStarting
  const canStartMain = Boolean(onStart) && !isStarting && !startDisabled
  const canShowStartMain = Boolean(mainTab && !mainTab.hasLiveSession && !mainTab.providerLive)
  const openTaskIdSet = useMemo(() => new Set(openTaskIds), [openTaskIds])
  const availableCreateTasks = useMemo(
    () => availableTasks.filter((task) => !openTaskIdSet.has(task.id)),
    [availableTasks, openTaskIdSet],
  )
  const taskEmptyLabel = availableTasks.length > 0 ? 'all tasks open' : 'no tasks yet'

  useEffect(() => {
    if (isTaskSessionFaceActive) {
      scheduleFitAndRefresh(activeRunId ?? undefined, 'settled', 'task-session-face')
    }
  }, [activeRunId, isTaskSessionFaceActive, scheduleFitAndRefresh])

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
          <div ref={createMenuRef} className={styles['create-menu-shell']}>
            <button
              ref={createButtonRef}
              type="button"
              className={styles['stage-tab-add']}
              aria-label="new tab"
              title="new tab"
              aria-expanded={createMenuOpen}
              onClick={toggleCreateMenu}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
            {createMenuOpen && createMenuPosition
              ? createPortal(
                  <div
                    ref={createMenuElRef}
                    className={styles['create-menu']}
                    role="menu"
                    style={{ top: createMenuPosition.top, left: createMenuPosition.left }}
                  >
                    <TerminalMenuSeparator label="terminal" />
                    <div className={styles['create-menu-section']}>
                      {canShowStartMain ? (
                        <button
                          type="button"
                          className={styles['create-menu-item']}
                          role="menuitem"
                          disabled={!canStartMain}
                          onClick={() => {
                            onStart?.()
                            closeCreateMenu()
                            onSelectTab?.('main')
                          }}
                        >
                          <Play size={13} aria-hidden="true" />
                          <span>start main terminal</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles['create-menu-item']}
                        role="menuitem"
                        disabled={!canForkMain}
                        title={forkMainDisabledReason ?? 'fork main'}
                        onClick={() => {
                          onForkMain?.()
                          closeCreateMenu()
                        }}
                      >
                        <Plus size={13} aria-hidden="true" />
                        <span>fork main</span>
                      </button>
                    </div>

                    <TerminalMenuSeparator label="tasks" />
                    <div className={styles['create-menu-section']}>
                      {availableCreateTasks.length > 0 ? (
                        availableCreateTasks.map((task) => (
                          <button
                            type="button"
                            key={task.id}
                            className={styles['create-menu-item']}
                            role="menuitem"
                            onClick={() => {
                              onOpenTaskPage?.(task.id)
                              closeCreateMenu()
                            }}
                          >
                            <Ref value={task.shortRef} />
                            <span className={styles['create-menu-task-title']}>{task.title}</span>
                          </button>
                        ))
                      ) : (
                        <p className={styles['terminal-menu-empty']}>{taskEmptyLabel}</p>
                      )}
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        </div>
        <div className={styles['stage-tab-strip-end']}>
          {isTaskTabActive && activeTaskId != null ? (
            <div className={styles['task-face-toggle']} aria-label="task tab face">
              {(['work', 'session'] as const).map((face) => (
                <button
                  key={face}
                  type="button"
                  className={activeTaskFace === face || (!activeTaskFace && face === 'work') ? styles.active : ''}
                  aria-pressed={activeTaskFace === face || (!activeTaskFace && face === 'work')}
                  onClick={() => onSetTaskFace?.(activeTaskId, face)}
                >
                  {face}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles['stage-tab-status']}>
            {!isWorkTabActive && !showTaskSessionEmpty ? (
              activeRun ? (
                <>
                  <Ref value={activeRun.shortRef} />
                  <Stamp label={displayStatus} tone={statusTone(displayStatus)} compact />
                  {activeRunHasLiveSession ? (
                    <button
                      type="button"
                      className={styles['run-action-button']}
                      aria-label={`stop ${activeRun.shortRef}`}
                      title="stop"
                      disabled={isStarting}
                      onClick={() => onStop(activeRun.id)}
                    >
                      <Square size={12} aria-hidden="true" />
                    </button>
                  ) : canResumeActiveRun ? (
                    <button
                      type="button"
                      className={styles['run-action-button']}
                      aria-label={`resume ${activeRun.shortRef}`}
                      title={activeRunResumeTitle}
                      disabled={isStarting}
                      onClick={() => onResume?.(activeRun.id)}
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                    </button>
                  ) : null}
                  {isTaskSessionFaceActive && activeTaskSessionTab && activeTaskSessionTab.runs.length >= 2 ? (
                    <>
                      <button
                        ref={runSwitcherButtonRef}
                        type="button"
                        className={styles['run-switcher-trigger']}
                        aria-label="select session"
                        aria-expanded={runSwitcherOpen}
                        onClick={toggleRunSwitcher}
                      >
                        <ChevronDown size={13} aria-hidden="true" />
                      </button>
                      {runSwitcherOpen && runSwitcherPosition
                        ? createPortal(
                            <div
                              ref={runSwitcherMenuRef}
                              className={styles['run-switcher-menu']}
                              role="menu"
                              style={{ top: runSwitcherPosition.top, left: runSwitcherPosition.left }}
                            >
                              {activeTaskSessionTab.runs.map((entry) => {
                                const status = resolveRunStatus(entry.run, entry.hasLiveSession, entry.providerLive)
                                const canResumeEntry = Boolean(entry.run.providerSessionId) && !entry.providerLive
                                const entryResumeTitle = resumeDisabledTitle(entry.run, Boolean(entry.providerLive || entry.hasLiveSession), isStarting)
                                return (
                                  <div
                                    key={entry.run.id}
                                    className={`${styles['run-switcher-item']} ${entry.run.id === activeRun.id ? styles.active : ''}`}
                                    role="menuitem"
                                  >
                                    <button
                                      type="button"
                                      className={styles['run-switcher-select']}
                                      onClick={() => {
                                        onSelectTaskRun?.(activeTaskSessionTab.taskId, entry.run.id)
                                        closeRunSwitcher()
                                      }}
                                    >
                                      <Ref value={entry.run.shortRef} />
                                      <Stamp label={status} tone={statusTone(status)} compact />
                                      <span>{entry.providerLabel ?? 'provider'}</span>
                                    </button>
                                    <div className={styles['run-switcher-actions']}>
                                      {entry.hasLiveSession ? (
                                        <button
                                          type="button"
                                          className={styles['run-switcher-action']}
                                          aria-label={`stop ${entry.run.shortRef}`}
                                          title="stop"
                                          disabled={isStarting}
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            onStop(entry.run.id)
                                            closeRunSwitcher()
                                          }}
                                        >
                                          <Square size={12} aria-hidden="true" />
                                        </button>
                                      ) : canResumeEntry ? (
                                        <button
                                          type="button"
                                          className={styles['run-switcher-action']}
                                          aria-label={`resume ${entry.run.shortRef}`}
                                          title={entryResumeTitle}
                                          disabled={isStarting}
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            onResume?.(entry.run.id)
                                            closeRunSwitcher()
                                          }}
                                        >
                                          <RotateCcw size={13} aria-hidden="true" />
                                        </button>
                                      ) : (
                                        <span className={styles['run-switcher-action-spacer']} aria-hidden="true" />
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>,
                            document.body,
                          )
                        : null}
                    </>
                  ) : null}
                </>
              ) : (
                <span className={styles['stage-tab-status-idle']}>{emptyLabel}</span>
              )
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
        {showTaskSessionEmpty && activeTaskId != null ? (
          <div className={styles['task-session-empty']}>
            <p>no session for {activeTaskShortRef} yet</p>
            <button
              type="button"
              disabled={isStarting || startDisabled}
              onClick={() => onStartTaskSession?.(activeTaskId)}
            >
              start
            </button>
          </div>
        ) : null}
        <div className={`${styles['terminal-stack']} ${isWorkTabActive || showTaskSessionEmpty ? styles.hidden : ''}`}>
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

// Worm's-eye "efl" (the CLI command). Geometric slab glyphs are pushed through a
// perspective warp: every row splays wider toward the base (horizontal
// convergence) while GIANT_TILT compresses the rows toward the top (vertical
// foreshortening). TILT 0 reads as a straight-on "skyscraper" (full-height,
// converging inward); higher values lean toward a Star Wars "crawl" (top
// squashed). The warped shape is supersampled 2×2 into Unicode quadrant blocks so
// the sloped edges resolve smoothly instead of as a coarse staircase.
//
// Tuning knobs live here: GIANT_TILT (upright↔crawl) and the flare range in
// buildGiantArt.
const GIANT_TILT = .75;

const GIANT_BITMAPS: Record<'e' | 'f' | 'l', string[]> = {
  // Same source height for all three; e is blanked at the top so it sits at the
  // shared x-height baseline while f and l rise as ascenders.
  e: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.##############.',
    '.##############.',
    '.####......####.',
    '.####......####.',
    '.##############.',
    '.##############.',
    '.####...........',
    '.####...........',
    '.##############.',
    '.##############.',
  ],
  f: [
    '.....########',
    '.....########',
    '.....####....',
    '.....####....',
    '.############',
    '.############',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
    '.....####....',
  ],
  l: [
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '..####..',
    '.######.',
    '.######.',
  ],
}

// 2×2 sub-cell coverage → quadrant block, indexed by (tl|tr<<1|bl<<2|br<<3).
const GIANT_QUADRANTS = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█']
const GIANT_GAP = 6

// Ink-trim each glyph so the equal GIANT_GAP yields even spacing — the source side
// bearings differ per letter and would otherwise make the gaps look uneven.
function trimGlyph(rows: string[]): string[] {
  let min = Infinity
  let max = -1
  for (const row of rows) {
    for (let col = 0; col < row.length; col++) {
      if (row[col] === '#') {
        if (col < min) min = col
        if (col > max) max = col
      }
    }
  }
  if (max < 0) return rows
  return rows.map((row) => {
    let trimmed = ''
    for (let col = min; col <= max; col++) trimmed += row[col] ?? '.'
    return trimmed
  })
}

const GIANT_TRIMMED: Record<'e' | 'f' | 'l', string[]> = {
  e: trimGlyph(GIANT_BITMAPS.e),
  f: trimGlyph(GIANT_BITMAPS.f),
  l: trimGlyph(GIANT_BITMAPS.l),
}

// Fitting span for the f-centred layout: the block is padded symmetric about the
// f, and e (leftmost, widest) drives the extent, so final width tracks 2×e + f.
const giantGlyphWidth = (key: 'e' | 'f' | 'l') => Math.max(...GIANT_TRIMMED[key].map((row) => row.length))
const GIANT_FIT_SPAN = 2 * giantGlyphWidth('e') + giantGlyphWidth('f')

function renderGiantLetter(src: string[], outH: number, topScale: number, botScale: number, tilt: number): string[] {
  const srcH = src.length
  const srcW = Math.max(...src.map((row) => row.length))
  const power = 1 + tilt * 2.4
  const subH = outH * 2
  const maxW = Math.round(srcW * botScale)
  const subW = maxW * 2
  const center = subW / 2
  const coverage: boolean[][] = []
  for (let sy = 0; sy < subH; sy++) {
    const depth = subH === 1 ? 1 : sy / (subH - 1)
    // Inverse-map every sub-pixel through one continuous transform (rather than
    // scaling+rounding each row independently) so all edges are sampled against
    // the same boundary line and the stair-steps come out evenly spaced.
    const scale = (topScale + (botScale - topScale) * depth) * 2
    const srcRow = Math.min(srcH - 1, Math.floor((1 - Math.pow(1 - depth, power)) * srcH))
    const row = new Array<boolean>(subW).fill(false)
    for (let sx = 0; sx < subW; sx++) {
      const u = (sx - center) / scale + srcW / 2
      if (u >= 0 && u < srcW && src[srcRow][Math.floor(u)] === '#') row[sx] = true
    }
    coverage.push(row)
  }
  const lines: string[] = []
  for (let oy = 0; oy < outH; oy++) {
    let line = ''
    for (let ox = 0; ox < maxW; ox++) {
      const tl = coverage[oy * 2][ox * 2]
      const tr = coverage[oy * 2][ox * 2 + 1]
      const bl = coverage[oy * 2 + 1][ox * 2]
      const br = coverage[oy * 2 + 1][ox * 2 + 1]
      line += GIANT_QUADRANTS[(tl ? 1 : 0) | (tr ? 2 : 0) | (bl ? 4 : 0) | (br ? 8 : 0)]
    }
    lines.push(line)
  }
  return lines
}

function buildGiant(outH: number, topScale: number, botScale: number, tilt: number): string[] {
  const letters = (['e', 'f', 'l'] as const).map((key) =>
    renderGiantLetter(GIANT_TRIMMED[key], outH, topScale, botScale, tilt),
  )
  const widths = letters.map((letter) => letter[0].length)
  const gap = ' '.repeat(GIANT_GAP)
  const rawWidth = widths[0] + widths[1] + widths[2] + GIANT_GAP * 2
  // Anchor on the f's centre column (not the block's) so f sits dead-centre, then
  // pad symmetric about it so the shared centerLine keeps it centred.
  const fCenter = Math.round(widths[0] + GIANT_GAP + widths[1] / 2)
  const half = Math.max(fCenter, rawWidth - fCenter)
  const padLeft = ' '.repeat(half - fCenter)
  const padRight = ' '.repeat(half - (rawWidth - fCenter))
  const lines: string[] = []
  for (let row = 0; row < outH; row++) {
    lines.push(padLeft + letters.map((letter) => letter[row]).join(gap) + padRight)
  }
  return lines
}

// Sizes the giant to the pane and returns null (fall back to compact text) when
// it can't fit legibly.
function buildGiantArt(cols: number, rows: number): string[] | null {
  if (cols < 60 || rows < 14) return null
  const botScale = clamp((cols * 0.9 - 2 * GIANT_GAP) / GIANT_FIT_SPAN, 1.7, 4)
  const topScale = botScale * 0.3
  const outH = clamp(Math.floor((rows - 6) * 0.82), 8, 22)
  const art = buildGiant(outH, topScale, botScale, GIANT_TILT)
  if (art[0].length > cols || art.length > rows - 4) return null
  return art
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}

function drawIdleWordmark(
  terminal: Terminal,
  palette: TerminalPalette['idleArt'],
  label: string,
  helper: string,
): void {
  const art = buildGiantArt(terminal.cols, terminal.rows)

  // Gradient the rows dim-far (top) to bright-near (base) to deepen the low angle.
  const markLines = art
    ? art.map((line, index) => {
        const depth = art.length === 1 ? 1 : index / (art.length - 1)
        return ansiText(mixColors(palette.top, palette.label, depth), centerLine(terminal.cols, line), depth > 0.55)
      })
    : [ansiText(palette.upper, centerLine(terminal.cols, 'e f f o r t l e s s'), true)]

  const caption = art
    ? ['', ansiText(mixColors(palette.helper, palette.upper, 0.5), centerLine(terminal.cols, 'e f f o r t l e s s'))]
    : []

  const body = [
    '',
    ...markLines,
    ...caption,
    '',
    ansiText(palette.label, centerLine(terminal.cols, label)),
    ansiText(palette.helper, centerLine(terminal.cols, helper)),
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

// The embedded CLIs (codex, claude, …) render their own ANSI colors assuming a
// dark terminal, so the PTY screen stays dark in every app theme. We borrow the
// app's own dark-theme tokens so it matches dark mode exactly rather than being
// an alien black void. `host` is unused now but kept for call-site stability.
function deriveTerminalPalette(_host: HTMLElement | null, cursorColor?: string): TerminalPalette {
  const dark = THEME_PALETTES.dark
  const background = dark['--field']
  const foreground = dark['--text']
  const strong = dark['--text-strong']
  const muted = dark['--muted']
  const accent = dark['--accent']
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
