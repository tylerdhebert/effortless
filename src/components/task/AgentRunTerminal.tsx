import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { ChevronDown, ExternalLink, Play, RotateCcw, Square, SquareTerminal } from 'lucide-react'
import type { AgentRun } from '../../../core/types'
import styles from './AgentRunTerminal.module.css'

type AgentRunTerminalProps = {
  activeRun: AgentRun | null
  tabs?: Array<{
    key: string
    label: string
    run: AgentRun | null
    runLive?: boolean
    profileLabel?: string | null
    branchLabel?: string | null
    taskId?: number | null
  }>
  activeTabKey?: string
  isStarting: boolean
  activeRunLive?: boolean
  startDisabled?: boolean
  emptyLabel?: string
  menuOpen?: boolean
  onStart?: () => void
  onResume?: (runId: number) => void
  onSelectTab?: (tabKey: string) => void
  onOpenTask?: (taskId: number) => void
  onStop: (runId: number) => void
  onToggleMenu?: (open: boolean) => void
  drawerClosedAt?: number
}

export function AgentRunTerminal({
  activeRun,
  tabs = [],
  activeTabKey,
  isStarting,
  activeRunLive = false,
  startDisabled = false,
  emptyLabel = 'ready',
  menuOpen: menuOpenProp,
  onStart,
  onResume,
  onSelectTab,
  onOpenTask,
  onStop,
  onToggleMenu,
  drawerClosedAt,
}: AgentRunTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const activeRunRef = useRef<AgentRun | null>(activeRun)
  const activeRunLiveRef = useRef(activeRunLive)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuRowRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [terminalReady, setTerminalReady] = useState(false)
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
    activeRunRef.current = activeRun
  }, [activeRun])

  useEffect(() => {
    activeRunLiveRef.current = activeRunLive
  }, [activeRunLive])

  useEffect(() => {
    if (!hostRef.current) return

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
    terminal.open(hostRef.current)
    fit.fit()
    terminal.focus()
    terminalRef.current = terminal
    fitRef.current = fit
    setTerminalReady(true)

    const consumeWheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    hostRef.current.addEventListener('wheel', consumeWheel, { passive: false })

    terminal.onData((data) => {
      const run = activeRunRef.current
      if (run?.status === 'running' && activeRunLiveRef.current) {
        void window.effortless.writeAgentRun(run.id, data)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      const run = activeRunRef.current
      if (run?.status === 'running' && activeRunLiveRef.current) {
        void window.effortless.resizeAgentRun(run.id, {
          cols: terminal.cols,
          rows: terminal.rows,
        })
      }
    })
    resizeObserver.observe(hostRef.current)

    return () => {
      hostRef.current?.removeEventListener('wheel', consumeWheel)
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitRef.current = null
      setTerminalReady(false)
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
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return

    function handleMenuKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeMenu()
        terminalRef.current?.focus()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setFocusedMenuIndex((i) => Math.min(i + 1, tabs.length - 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setFocusedMenuIndex((i) => Math.max(i - 1, 0))
        return
      }

      if (event.key === 'Enter' && focusedMenuIndex >= 0) {
        event.preventDefault()
        const tab = tabs[focusedMenuIndex]
        if (tab) {
          onSelectTab?.(tab.key)
          closeMenu()
        }
        return
      }
    }

    window.addEventListener('keydown', handleMenuKeydown, true)
    return () => window.removeEventListener('keydown', handleMenuKeydown, true)
  }, [menuOpen, focusedMenuIndex, tabs, onSelectTab])

  useEffect(() => {
    if (focusedMenuIndex >= 0) {
      menuRowRefs.current[focusedMenuIndex]?.focus()
    }
  }, [focusedMenuIndex])

  useEffect(() => {
    if (drawerClosedAt) {
      terminalRef.current?.focus()
    }
  }, [drawerClosedAt])

  const displayStatus =
    activeRun?.status === 'running' && !activeRunLive ? 'stale' : activeRun?.status
    activeRun?.status === 'running' && !activeRunLive ? 'stale' : activeRun?.status

  useEffect(() => {
    return window.effortless.onAgentRunTerminalEvent((event) => {
      const run = activeRunRef.current
      if (!run || event.runId !== run.id) return
      if (event.kind === 'data' && event.body) {
        terminalRef.current?.write(event.body)
      }
      if (event.kind === 'exit') {
        terminalRef.current?.writeln(`\r\n[run exited with code ${event.exitCode ?? 'unknown'}]`)
      }
      if (event.kind === 'error') {
        terminalRef.current?.writeln(`\r\n[run error] ${event.body ?? 'unknown error'}`)
      }
    })
  }, [])

  useEffect(() => {
    if (!activeRun || !terminalReady) return
    terminalRef.current?.clear()
    terminalRef.current?.writeln(`${activeRun.shortRef} ${activeRun.status} ${activeRun.label}`)
    terminalRef.current?.writeln(activeRun.cwd)
    terminalRef.current?.writeln('')
    terminalRef.current?.focus()
  }, [activeRun?.id, terminalReady])

  useEffect(() => {
    fitRef.current?.fit()
    terminalRef.current?.focus()
  }, [])

  const attachmentsWithRuns = tabs.filter((tab) => tab.run).length
  const activeTab = tabs.find((tab) => tab.key === activeTabKey) ?? null

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
              {tabs.map((tab, tabIndex) => {
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
              })}
            </div>
          ) : null}
        </div>
        <div className={styles['terminal-title']}>
          <h4>terminal</h4>
          <span>
            {activeRun
              ? `${activeTab?.label ?? 'run'} · ${activeRun.shortRef} · ${displayStatus}`
              : emptyLabel}
          </span>
        </div>
      </div>
      <div ref={hostRef} className={styles['terminal-host']}>
        {!activeRun ? (
          <div className={styles['terminal-empty']}>
            <SquareTerminal size={32} aria-hidden="true" />
            <span>no active run</span>
            <p>open the run menu to start or resume a session</p>
          </div>
        ) : null}
      </div>
    </section>
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
  if (!run.providerSessionId) return 'no provider session — start a new run and let the agent register its session'
  if (runLive) return 'run is currently live — stop before resuming'
  return 'resume'
}
