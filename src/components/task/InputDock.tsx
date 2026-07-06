import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InputRequest } from '../../../core/types'
import { pulseAttentionChip } from '../notifications/NeedsYou'
import { Ref } from '../ui/Ref'
import { Stamp } from '../ui/Stamp'
import styles from './InputDock.module.css'

type InputDockProps = {
  inputs: InputRequest[]
  hiddenCount: number
  onAnswer: (inputRequestId: number, answer: string) => void
  isAnswering: boolean
  onOpenInputsDrawer: () => void
}

const TIMER_MS = 10_000

export function InputDock({
  inputs,
  hiddenCount,
  onAnswer,
  isAnswering,
  onOpenInputsDrawer,
}: InputDockProps) {
  const [demotedIds, setDemotedIds] = useState<Set<number>>(() => new Set())
  const prefersReducedMotion = usePrefersReducedMotion()

  const visibleInputs = useMemo(
    () => inputs.filter((input) => !demotedIds.has(input.id)),
    [demotedIds, inputs],
  )

  useEffect(() => {
    const activeIds = new Set(inputs.map((input) => input.id))
    setDemotedIds((current) => {
      const next = new Set<number>()
      for (const id of current) {
        if (activeIds.has(id)) {
          next.add(id)
        }
      }
      return next.size === current.size ? current : next
    })
  }, [inputs])

  const handleDemote = useCallback((inputId: number) => {
    setDemotedIds((current) => {
      if (current.has(inputId)) return current
      const next = new Set(current)
      next.add(inputId)
      return next
    })
    pulseAttentionChip()
  }, [])

  if (visibleInputs.length === 0 && hiddenCount === 0) {
    return null
  }

  return (
    <div className={styles.dock} aria-label="inline input dock">
      {hiddenCount > 0 ? (
        <button type="button" className={styles['more-link']} onClick={onOpenInputsDrawer}>
          +{hiddenCount} more
        </button>
      ) : null}
      {visibleInputs.map((input) => (
        <InputDockCard
          key={input.id}
          input={input}
          onAnswer={onAnswer}
          isAnswering={isAnswering}
          onDemote={() => handleDemote(input.id)}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </div>
  )
}

function InputDockCard({
  input,
  onAnswer,
  isAnswering,
  onDemote,
  prefersReducedMotion,
}: {
  input: InputRequest
  onAnswer: (inputRequestId: number, answer: string) => void
  isAnswering: boolean
  onDemote: () => void
  prefersReducedMotion: boolean
}) {
  const [pinned, setPinned] = useState(false)
  const [paused, setPaused] = useState(false)
  const [demoting, setDemoting] = useState(false)

  const pin = useCallback(() => {
    setPinned(true)
  }, [])

  const handleTimerEnd = useCallback(() => {
    if (pinned || demoting) return
    if (prefersReducedMotion) {
      onDemote()
      return
    }
    setDemoting(true)
  }, [demoting, onDemote, pinned, prefersReducedMotion])

  useEffect(() => {
    if (!demoting || prefersReducedMotion) return
    const timer = window.setTimeout(() => {
      onDemote()
    }, 340)
    return () => window.clearTimeout(timer)
  }, [demoting, onDemote, prefersReducedMotion])

  return (
    <article
      className={`${styles.card} ${demoting ? styles.demoting : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
      onPointerDown={pin}
      onKeyDown={pin}
    >
      {!pinned ? (
        <div className={styles['timer-track']} aria-hidden="true">
          <div
            className={`${styles['timer-bar']} ${paused ? styles.paused : ''}`}
            onAnimationEnd={handleTimerEnd}
            style={prefersReducedMotion ? { animationDuration: '0.001ms' } : { animationDuration: `${TIMER_MS}ms` }}
          />
        </div>
      ) : null}

      <div className={styles['card-header']}>
        <Stamp label="needs you" tone="gate" compact />
        <Ref value={input.shortRef} />
      </div>

      <p className={styles.prompt}>{input.prompt}</p>

      <div className={styles.answers}>
        {input.type === 'yesno' ? (
          <>
            <button
              type="button"
              className={styles['answer-btn']}
              disabled={isAnswering}
              onClick={() => {
                pin()
                onAnswer(input.id, 'yes')
              }}
            >
              yes
            </button>
            <button
              type="button"
              className={styles['answer-btn']}
              disabled={isAnswering}
              onClick={() => {
                pin()
                onAnswer(input.id, 'no')
              }}
            >
              no
            </button>
          </>
        ) : null}

        {input.type === 'choice' && input.choices
          ? input.choices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className={styles['answer-btn']}
                disabled={isAnswering}
                onClick={() => {
                  pin()
                  onAnswer(input.id, choice.value)
                }}
              >
                {choice.label}
              </button>
            ))
          : null}

        {input.type === 'text' ? (
          <form
            className={styles['text-form']}
            onSubmit={(event) => {
              event.preventDefault()
              const form = event.currentTarget
              const field = form.elements.namedItem('answer') as HTMLInputElement
              const answer = field.value.trim()
              if (!answer) return
              pin()
              onAnswer(input.id, answer)
              field.value = ''
            }}
          >
            <input
              name="answer"
              type="text"
              aria-label="answer"
              placeholder="answer"
              disabled={isAnswering}
              onInput={pin}
            />
            <button type="submit" disabled={isAnswering}>
              send
            </button>
          </form>
        ) : null}
      </div>
    </article>
  )
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setPrefersReducedMotion(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}
