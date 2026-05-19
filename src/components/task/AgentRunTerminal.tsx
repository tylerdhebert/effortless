import { useCallback, useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { ChevronDown, ExternalLink, Play, Plus, RotateCcw, Square, SquareTerminal } from 'lucide-react'
import type { AgentRun } from '../../../core/types'
import styles from './AgentRunTerminal.module.css'

type TerminalEntry = {
  terminal: Terminal
  fit: FitAddon
  dispose: () => void
}

type TerminalTab = {
  key: string
  label: string
  run: AgentRun | null
  runLive?: boolean
  profileLabel?: string | null
  branchLabel?: string | null
  taskId?: number | null
  purpose?: AgentRun['purpose'] | null
}

type MountedTerminalRun = {
  run: AgentRun
  runLive: boolean
}

type AgentRunTerminalProps = {
  activeRun: AgentRun | null
  tabs?: TerminalTab[]
  mountedRuns?: MountedTerminalRun[]
  activeTabKey?: string
  isStarting: boolean
  activeRunLive?: boolean
  startDisabled?: boolean
  emptyLabel?: string
  menuOpen?: boolean
  onStart?: () => void
  onForkMain?: () => void
  onResume?: (runId: number) => void
  onSelectTab?: (tabKey: string) => void
  onOpenTask?: (taskId: number) => void
  onStop: (runId: number) => void
  onToggleMenu?: (open: boolean) => void
  drawerClosedAt?: number
  forkMainDisabledReason?: string | null
}

export function AgentRunTerminal({
  activeRun,
  tabs = [],
  mountedRuns = [],
  activeTabKey,
  isStarting,
  activeRunLive = false,
  startDisabled = false,
  emptyLabel = 'ready',
  menuOpen: menuOpenProp,
  onStart,
  onForkMain,
  onResume,
  onSelectTab,
  onOpenTask,
  onStop,
  onToggleMenu,
  drawerClosedAt,
  forkMainDisabledReason,
}: AgentRunTerminalProps) {
  const hostRefs = useRef(new Map<number, HTMLDivElement>())
  const terminalEntriesRef = useRef(new Map<number, TerminalEntry>())
  const runsByIdRef = useRef(new Map<number, { run: AgentRun; runLive: boolean }>())
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuRowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const fitFrameRef = useRef<number | null>(null)
  const secondFitFrameRef = useRef<number | null>(null)
  const [menuOpenInternal, setMenuOpenInternal] = useState(false)
  const [focusedMenuIndex, setFocusedMenuIndex] = useState(-1)

  const menuOpen = menuOpenProp ?? menuOpenInternal

  function closeMenu() {
    if (menuOpenProp !== undefined) {
      onToggleMenu?.(false)
    } else {
      setMenuOpenInternal(false)
    }
    setFocusedMenuIndex(-1)
  }

  function openMenu() {
    if (menuOpenProp !== undefined) {
      onToggleMenu?.(true)
    } else {
      setMenuOpenInternal(true)
    }
  }

  useEffect(() => {
    const next = new Map<number, { run: AgentRun; runLive: boolean }>()
    for (const mountedRun of mountedRuns) {
      next.set(mountedRun.run.id, mountedRun)
    }
    for (const tab of tabs) {
      if (tab.run) {
        next.set(tab.run.id, { run: tab.run, runLive: Boolean(tab.runLive) })
      }
    }
    runsByIdRef.current = next
  }, [mountedRuns, tabs])

  const queueViewportSync = useCallback((entry: TerminalEntry) => {
    const viewport = (entry.terminal as any)._core?._viewport
    viewport?.queueSync?.()
  }, [])

  const fitAndRefreshTerminal = useCallback((runId?: number) => {
    const targets = runId == null
      ? [...terminalEntriesRef.current.entries()]
      : (() => {
          const entry = terminalEntriesRef.current.get(runId)
          return entry ? [[runId, entry] as const] : []
        })()

    for (const [targetRunId, entry] of targets) {
      entry.fit.fit()
      entry.terminal.refresh(0, Math.max(0, entry.terminal.rows - 1))
      queueViewportSync(entry)

      const target = runsByIdRef.current.get(targetRunId)
      if (target?.run.status === 'running' && target.runLive) {
        void window.effortless.resizeAgentRun(targetRunId, {
          cols: entry.terminal.cols,
          rows: entry.terminal.rows,
        })
      }
    }
  }, [queueViewportSync])

  const scheduleFitAndRefresh = useCallback((runId?: number) => {
    if (fitFrameRef.current != null) {
      window.cancelAnimationFrame(fitFrameRef.current)
    }
    if (secondFitFrameRef.current != null) {
      window.cancelAnimationFrame(secondFitFrameRef.current)
    }

    fitFrameRef.current = window.requestAnimationFrame(() => {
      fitFrameRef.current = null
      fitAndRefreshTerminal(runId)
      secondFitFrameRef.current = window.requestAnimationFrame(() => {
        secondFitFrameRef.current = null
        fitAndRefreshTerminal(runId)
      })
    })
  }, [fitAndRefreshTerminal])

  const nudgeTerminalHost = useCallback((runId: number) => {
    const host = hostRefs.current.get(runId)
    if (!host) return

    host.style.height = 'calc(100% - 1px)'
    window.requestAnimationFrame(() => {
      const currentHost = hostRefs.current.get(runId)
      if (!currentHost) return
      currentHost.style.height = ''
      scheduleFitAndRefresh(runId)
    })
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
      scheduleFitAndRefresh(runId)
    }
  }, [queueViewportSync, scheduleFitAndRefresh])

  useEffect(() => {
    const mountedRunIds = new Set<number>()
    for (const mountedRun of mountedRuns) {
      const runId = mountedRun.run.id
      mountedRunIds.add(runId)
      if (terminalEntriesRef.current.has(runId)) continue

      const host = hostRefs.current.get(runId)
      if (!host) continue

      const terminal = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
        fontSize: 12,
        theme: {
          background: '#10120e',
          foreground: '#d5dccd',
          cursor: '#d5dccd',
          selectionBackground: '#435038',
        },
      })
      const fit = new FitAddon()
      terminal.loadAddon(fit)
      terminal.open(host)
      const resizeObserver = new ResizeObserver(() => scheduleFitAndRefresh(runId))
      resizeObserver.observe(host)

      const dataDisposable = terminal.onData((data) => {
        const target = runsByIdRef.current.get(runId)
        if (target?.run.status === 'running' && target.runLive) {
          void window.effortless.writeAgentRun(runId, data)
        }
      })
      const writeParsedDisposable = terminal.onWriteParsed(() => {
        refreshTerminalPaint(runId)
      })

      const entry: TerminalEntry = {
        terminal,
        fit,
        dispose: () => {
          resizeObserver.disconnect()
          writeParsedDisposable.dispose()
          dataDisposable.dispose()
          terminal.dispose()
        },
      }
      terminalEntriesRef.current.set(runId, entry)
      scheduleFitAndRefresh(runId)
    }

    for (const [runId, entry] of terminalEntriesRef.current.entries()) {
      if (mountedRunIds.has(runId)) continue
      entry.dispose()
      terminalEntriesRef.current.delete(runId)
    }
  }, [mountedRuns, refreshTerminalPaint, scheduleFitAndRefresh])

  useEffect(() => {
    const handleWindowResize = () => scheduleFitAndRefresh()
    window.addEventListener('resize', handleWindowResize)

    return () => {
      if (fitFrameRef.current != null) {
        window.cancelAnimationFrame(fitFrameRef.current)
      }
      if (secondFitFrameRef.current != null) {
        window.cancelAnimationFrame(secondFitFrameRef.current)
      }
      window.removeEventListener('resize', handleWindowResize)
      for (const entry of terminalEntriesRef.current.values()) {
        entry.dispose()
      }
      terminalEntriesRef.current.clear()
    }
  }, [scheduleFitAndRefresh])

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen])

  const mainTab = tabs.find((tab) => tab.key === 'main') ?? null
  const forkTabs = tabs.filter((tab) => tab.key !== 'main' && tab.purpose === 'fork')
  const otherTabs = tabs.filter((tab) => tab.key !== 'main' && tab.purpose !== 'fork')
  const orderedMenuTabs = [
    ...(mainTab ? [mainTab] : []),
    ...forkTabs,
    ...otherTabs,
  ]

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
  }, [menuOpen, focusedMenuIndex, orderedMenuTabs, onSelectTab])

  useEffect(() => {
    if (focusedMenuIndex >= 0) {
      menuRowRefs.current[focusedMenuIndex]?.focus()
    }
  }, [focusedMenuIndex])

  useEffect(() => {
    if (drawerClosedAt) {
      scheduleFitAndRefresh()
      if (activeRun) {
        terminalEntriesRef.current.get(activeRun.id)?.terminal.focus()
      }
    }
  }, [drawerClosedAt, scheduleFitAndRefresh, activeRun])

  useEffect(() => {
    scheduleFitAndRefresh()
  }, [menuOpen, scheduleFitAndRefresh])

  const displayStatus =
    activeRun?.status === 'running' && !activeRunLive ? 'stale' : activeRun?.status

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
    if (!activeRun) return
    scheduleFitAndRefresh(activeRun.id)
    nudgeTerminalHost(activeRun.id)
    terminalEntriesRef.current.get(activeRun.id)?.terminal.focus()
  }, [activeRun?.id, activeRunLive, scheduleFitAndRefresh, nudgeTerminalHost])

  const attachmentsWithRuns = tabs.filter((tab) => tab.run).length
  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? null
  const canForkMain = Boolean(onForkMain) && !forkMainDisabledReason && !isStarting

  return (
    <section className={styles['terminal-section']}>
      <div className={styles['terminal-header']}>
        <div ref={menuRef} className={styles['terminal-menu-shell']}>
          <button
            type="button"
            className={styles['terminal-menu-trigger']}
            aria-label="terminal runs"
            aria-expanded={menuOpen}
            onClick={() => {
              if (menuOpen) {
                closeMenu()
              } else {
                openMenu()
              }
            }}
          >
            <SquareTerminal size={15} aria-hidden="true" />
            <span>({attachmentsWithRuns})</span>
            <ChevronDown size={13} aria-hidden="true" />
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
        <div className={styles['terminal-title']}>
          <h4>terminal</h4>
          <span>
            {activeRun
              ? `${activeTab?.label ?? 'run'} - ${activeRun.shortRef} - ${displayStatus}`
              : emptyLabel}
          </span>
        </div>
      </div>
      <div className={styles['terminal-stack']}>
        {mountedRuns.map(({ run }) =>
          run ? (
            <div
              key={run.id}
              ref={(node) => {
                if (node) {
                  hostRefs.current.set(run.id, node)
                } else {
                  hostRefs.current.delete(run.id)
                }
              }}
              className={`${styles['terminal-host']} ${run.id === activeRun?.id ? styles.active : styles.hidden}`}
            />
          ) : null,
        )}
      </div>
      {!activeRun ? (
        <div className={styles['terminal-empty']}>
          <SquareTerminal size={32} aria-hidden="true" />
          <span>no active run</span>
          <p>open the run menu to start or resume a session</p>
        </div>
      ) : null}
    </section>
  )

  function renderTerminalMenuRow(tab: TerminalTab, tabIndex: number) {
    const status = resolveRunStatus(tab.run, Boolean(tab.runLive))
    const canResume = Boolean(tab.run?.providerSessionId) && !tab.runLive && !isStarting
    const canStop = Boolean(tab.run && tab.runLive && !isStarting)
    const canStartMain = tab.key === 'main' && Boolean(onStart) && !isStarting && !startDisabled
    const canOpenTask = tab.key !== 'main' && tab.taskId != null && Boolean(onOpenTask)
    const resumeTitle = resumeDisabledTitle(tab.run, Boolean(tab.runLive), isStarting)
    const stopTitle = tab.run
      ? !canStop
        ? 'run is not currently live'
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
                      <span>{tab.run?.shortRef ?? 'no run'}</span>
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

function TerminalMenuSeparator({ label }: { label: string }) {
  return (
    <div className={styles['terminal-menu-separator']}>
      <span />
      <strong>{label}</strong>
      <span />
    </div>
  )
}

function resolveRunStatus(run: AgentRun | null, runLive: boolean): string {
  if (!run) return 'ready'
  if (run.status === 'running' && !runLive) return 'stale'
  if (runLive) return 'running'
  return run.status
}

function renderMenuStatus(status: string) {
  const cls = status === 'ready' ? '' : status
  return (
    <span className={styles['menu-status']}>
      {cls ? <span className={`${styles['menu-status-dot']} ${styles[cls] ?? ''}`} /> : null}
      <span className={`${styles['menu-status-label']} ${styles[cls] ?? ''}`}>{status}</span>
    </span>
  )
}

function resumeDisabledTitle(run: AgentRun | null, runLive: boolean | undefined, isStarting: boolean): string {
  if (!run) return ''
  if (isStarting) return 'another run is starting'
  if (!run.providerSessionId) return 'no provider session - start a new run and let the agent register its session'
  if (runLive) return 'run is currently live - stop before resuming'
  return 'resume'
}
