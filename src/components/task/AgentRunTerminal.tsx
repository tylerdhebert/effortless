import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { ChevronsDown, ChevronsUp } from 'lucide-react'
import '@xterm/xterm/css/xterm.css'
import type { AgentRun } from '../../../core/types'
import styles from './AgentRunTerminal.module.css'

type AgentRunTerminalProps = {
  activeRun: AgentRun | null
  isStarting: boolean
  startDisabled?: boolean
  startLabel?: string
  emptyLabel?: string
  onStart?: () => void
  onStop: (runId: number) => void
}

export function AgentRunTerminal({
  activeRun,
  isStarting,
  startDisabled = false,
  startLabel = 'start',
  emptyLabel = 'ready',
  onStart,
  onStop,
}: AgentRunTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [terminalReady, setTerminalReady] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

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
      if (activeRun?.status === 'running') {
        void window.effortless.writeAgentRun(activeRun.id, data)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      if (activeRun?.status === 'running') {
        void window.effortless.resizeAgentRun(activeRun.id, {
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
  }, [activeRun?.id, activeRun?.status])

  useEffect(() => {
    return window.effortless.onAgentRunTerminalEvent((event) => {
      if (!activeRun || event.runId !== activeRun.id) return
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
  }, [activeRun])

  useEffect(() => {
    if (!activeRun || !terminalReady) return
    terminalRef.current?.clear()
    terminalRef.current?.writeln(`${activeRun.shortRef} ${activeRun.status} ${activeRun.label}`)
    terminalRef.current?.writeln(activeRun.cwd)
    terminalRef.current?.writeln('')
    terminalRef.current?.focus()
  }, [activeRun?.id, terminalReady])

  useEffect(() => {
    if (collapsed) return
    fitRef.current?.fit()
    terminalRef.current?.focus()
  }, [collapsed])

  return (
    <section className={`${styles['terminal-section']} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles['terminal-header']}>
        <div>
          <h4>terminal</h4>
          <span>{activeRun ? `${activeRun.shortRef} ${activeRun.status}` : emptyLabel}</span>
        </div>
        <div className={styles['terminal-actions']}>
          {onStart ? (
            <button type="button" disabled={isStarting || startDisabled} onClick={onStart}>
              {isStarting ? 'starting' : startLabel}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!activeRun || activeRun.status !== 'running' || isStarting}
            onClick={() => activeRun ? onStop(activeRun.id) : undefined}
          >
            stop
          </button>
          <button
            type="button"
            className={styles['collapse-button']}
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'expand terminal' : 'collapse terminal'}
            aria-label={collapsed ? 'expand terminal' : 'collapse terminal'}
          >
            {collapsed ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}
          </button>
        </div>
      </div>
      <div ref={hostRef} className={styles['terminal-host']} />
    </section>
  )
}
