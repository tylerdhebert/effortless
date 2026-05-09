import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { ExternalLink } from 'lucide-react'
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
  onOpenTranscript?: (filePath: string) => void
}

export function AgentRunTerminal({
  activeRun,
  isStarting,
  startDisabled = false,
  startLabel = 'start',
  emptyLabel = 'ready',
  onStart,
  onStop,
  onOpenTranscript,
}: AgentRunTerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [terminalReady, setTerminalReady] = useState(false)

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

  return (
    <section className={styles['terminal-section']}>
      <div className={styles['terminal-header']}>
        <div>
          <h4>terminal</h4>
          <span>{activeRun ? `${activeRun.shortRef} ${activeRun.status}` : emptyLabel}</span>
        </div>
        <div className={styles['terminal-actions']}>
          <button
            type="button"
            disabled={!activeRun || !onOpenTranscript}
            onClick={() => activeRun && onOpenTranscript ? onOpenTranscript(activeRun.transcriptPath) : undefined}
            title="open transcript"
            aria-label="open transcript"
          >
            <ExternalLink size={13} />
            transcript
          </button>
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
        </div>
      </div>
      {activeRun ? (
        <div className={styles['run-details']}>
          <span>{activeRun.cwd}</span>
          <code>{activeRun.command || 'command pending'}</code>
        </div>
      ) : null}
      <div ref={hostRef} className={styles['terminal-host']} />
    </section>
  )
}
