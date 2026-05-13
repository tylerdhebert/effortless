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
  onStart?: () => void
  onResume?: (runId: number) => void
  onSelectTab?: (tabKey: string) => void
  onOpenTask?: (taskId: number) => void
  onStop: (runId: number) => void
}

export function AgentRunTerminal({
  activeRun,
  tabs = [],
  activeTabKey,
  isStarting,
  activeRunLive = false,
  startDisabled = false,
  emptyLabel = 'ready',
  onStart,
  onResume,
  onSelectTab,
  onOpenTask,
  onStop,
}: AgentRunTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const activeRunRef = useRef<AgentRun | null>(activeRun)
  const activeRunLiveRef = useRef(activeRunLive)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [terminalReady, setTerminalReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
        setMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen])

  const displayStatus =
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
            onClick={() => setMenuOpen((open) => !open)}
          >
            <SquareTerminal size={15} aria-hidden="true" />
            <span>({attachmentsWithRuns})</span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className={styles['terminal-menu']} role="menu">
              {tabs.map((tab) => {
                const status = resolveRunStatus(tab.run, Boolean(tab.runLive))
                const canResume = Boolean(tab.run?.providerSessionId) && !tab.runLive && !isStarting
                const canStop = Boolean(tab.run && tab.runLive && !isStarting)
                const canStartMain = tab.key === 'main' && Boolean(onStart) && !isStarting && !startDisabled
                const canOpenTask = tab.key !== 'main' && tab.taskId != null && Boolean(onOpenTask)
                return (
                  <div
                    key={tab.key}
                    className={`${styles['terminal-menu-row']} ${tab.key === activeTabKey ? styles.active : ''}`}
                    role="menuitem"
                  >
                    <button
                      type="button"
                      className={styles['terminal-menu-select']}
                      onClick={() => {
                        onSelectTab?.(tab.key)
                        setMenuOpen(false)
                      }}
                    >
                      <strong>{tab.label}</strong>
                      <span>{tab.run?.shortRef ?? 'no run'}</span>
                      <span>{status}</span>
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
                            setMenuOpen(false)
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
                            setMenuOpen(false)
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
                          title="resume"
                          disabled={!canResume}
                          onClick={() => {
                            onResume(tab.run!.id)
                            setMenuOpen(false)
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
                          title="stop"
                          disabled={!canStop}
                          onClick={() => {
                            onStop(tab.run!.id)
                            setMenuOpen(false)
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
      <div ref={hostRef} className={styles['terminal-host']} />
    </section>
  )
}

function resolveRunStatus(run: AgentRun | null, runLive: boolean): string {
  if (!run) return 'ready'
  if (run.status === 'running' && !runLive) return 'stale'
  if (runLive) return 'running'
  return run.status
}
