import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type TransitionEvent,
} from 'react'

type PillOption<T extends string> = {
  id: T
  label: string
}

type SegmentRect = {
  left: number
  width: number
  right: number
}

type PillState = {
  left: number
  width: number
  transition: string
  darkEdgeOpacity: number
  lightEdgeOpacity: number
  edgeTransition: string
}

export function PillSwitcher<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: PillOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [segmentWidth, setSegmentWidth] = useState<number | null>(null)
  const [pill, setPill] = useState<PillState | null>(null)
  const idx = options.findIndex((option) => option.id === value)

  const activeIdxRef = useRef<number>(idx)
  const prevIdxRef = useRef<number>(idx)
  const leadingEdgeRef = useRef<'left' | 'right'>('right')
  const phaseRef = useRef<'idle' | 'stretch' | 'squish' | 'bounce' | 'settle'>('idle')
  const rafRef = useRef<number | null>(null)
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animationRef = useRef<{
    squish: PillState
    bounce: PillState
    settle: PillState
  } | null>(null)

  function rectFor(index: number): SegmentRect | null {
    const container = containerRef.current
    const button = buttonRefs.current[index]
    if (!container || !button) return null

    const containerRect = container.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const left = buttonRect.left - containerRect.left
    const width = buttonRect.width

    return { left, width, right: left + width }
  }

  function renderedPillRect(): SegmentRect | null {
    const container = containerRef.current
    const pillNode = pillRef.current
    if (!container || !pillNode) return null

    const containerRect = container.getBoundingClientRect()
    const pillRect = pillNode.getBoundingClientRect()
    const left = pillRect.left - containerRect.left
    const width = pillRect.width

    return { left, width, right: left + width }
  }

  function pillStateFor(rect: SegmentRect, transition = 'none'): PillState {
    return {
      left: rect.left,
      width: rect.width,
      transition,
      darkEdgeOpacity: 0,
      lightEdgeOpacity: 0,
      edgeTransition: 'opacity 120ms ease-out',
    }
  }

  function transitionFor(durationMs: number, easing: string) {
    return `left ${durationMs}ms ${easing}, width ${durationMs}ms ${easing}`
  }

  useEffect(() => {
    activeIdxRef.current = idx
  }, [idx])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    function syncLayout() {
      const buttons = buttonRefs.current.filter(
        (button): button is HTMLButtonElement => button !== null,
      )
      if (!buttons.length) return

      const maxWidth = Math.ceil(Math.max(...buttons.map((button) => button.offsetWidth)))
      setSegmentWidth((current) => (current === maxWidth ? current : maxWidth))

      if (phaseRef.current !== 'idle') return

      const activeRect = rectFor(activeIdxRef.current)
      if (!activeRect) return

      setPill((current) => {
        if (
          current &&
          Math.abs(current.left - activeRect.left) < 0.5 &&
          Math.abs(current.width - activeRect.width) < 0.5 &&
          current.transition === 'none'
        ) {
          return current
        }
        return pillStateFor(activeRect)
      })
      prevIdxRef.current = activeIdxRef.current
    }

    syncLayout()

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncLayout) : null
    observer?.observe(container)
    for (const button of buttonRefs.current) {
      if (button) observer?.observe(button)
    }

    return () => {
      observer?.disconnect()
    }
  }, [options.length])

  useEffect(() => {
    if (segmentWidth === null) return

    const prevIdx = prevIdxRef.current
    if (prevIdx === idx) return

    const start = renderedPillRect() ?? rectFor(prevIdx)
    const final = rectFor(idx)
    if (!start || !final) return

    prevIdxRef.current = idx

    const movingRight = idx > prevIdx
    leadingEdgeRef.current = movingRight ? 'right' : 'left'

    const stretchDurationMs = 56
    const stretchHandoffLeadMs = 28
    const stretchTransition = transitionFor(
      stretchDurationMs,
      'cubic-bezier(0.26, 0.86, 0.38, 1)',
    )
    const squishTransition = transitionFor(145, 'cubic-bezier(0.35, 0, 0.2, 1)')
    const bounceTransition = transitionFor(170, 'cubic-bezier(0.18, 0.9, 0.32, 1.22)')
    const settleTransition = transitionFor(180, 'cubic-bezier(0.22, 1, 0.36, 1)')
    const squishEdgeTransition = 'opacity 145ms cubic-bezier(0.35, 0, 0.2, 1)'
    const bounceEdgeTransition = 'opacity 170ms cubic-bezier(0.18, 0.9, 0.32, 1.22)'
    const settleEdgeTransition = 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)'
    const squishInset = final.width * 0.35
    const bounceInset = Math.min(10, Math.max(4, final.width * 0.12))
    const squishWidth = final.width - squishInset

    const stretch: PillState = {
      ...pillStateFor(final),
      transition: stretchTransition,
    }

    const squish: PillState = movingRight
      ? {
          ...pillStateFor(final),
          left: final.right - squishWidth,
          width: squishWidth,
          transition: squishTransition,
          darkEdgeOpacity: 0.72,
          edgeTransition: squishEdgeTransition,
        }
      : {
          ...pillStateFor(final),
          left: final.left,
          width: squishWidth,
          transition: squishTransition,
          darkEdgeOpacity: 0.72,
          edgeTransition: squishEdgeTransition,
        }

    const bounce: PillState = movingRight
      ? {
          ...pillStateFor(final),
          left: final.left - bounceInset,
          width: final.width + bounceInset,
          transition: bounceTransition,
          lightEdgeOpacity: 0.06,
          edgeTransition: bounceEdgeTransition,
        }
      : {
          ...pillStateFor(final),
          left: final.left,
          width: final.width + bounceInset,
          transition: bounceTransition,
          lightEdgeOpacity: 0.06,
          edgeTransition: bounceEdgeTransition,
        }

    phaseRef.current = 'stretch'
    animationRef.current = {
      squish,
      bounce,
      settle: {
        ...pillStateFor(final),
        transition: settleTransition,
        edgeTransition: settleEdgeTransition,
      },
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (handoffTimerRef.current !== null) clearTimeout(handoffTimerRef.current)

    setPill({ ...pillStateFor(start), transition: 'none' })
    rafRef.current = requestAnimationFrame(() => {
      setPill(stretch)
      handoffTimerRef.current = setTimeout(() => {
        if (phaseRef.current !== 'stretch') return
        phaseRef.current = 'squish'
        handoffTimerRef.current = null
        setPill(animationRef.current?.squish ?? null)
      }, Math.max(0, stretchDurationMs - stretchHandoffLeadMs))
      rafRef.current = null
    })

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (handoffTimerRef.current !== null) {
        clearTimeout(handoffTimerRef.current)
        handoffTimerRef.current = null
      }
    }
  }, [idx, segmentWidth]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePillTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== 'width') return

    const animation = animationRef.current
    if (!animation) return

    if (phaseRef.current === 'squish') {
      phaseRef.current = 'bounce'
      setPill(animation.bounce)
      return
    }

    if (phaseRef.current === 'bounce') {
      phaseRef.current = 'settle'
      setPill(animation.settle)
      return
    }

    if (phaseRef.current === 'settle') {
      phaseRef.current = 'idle'
      if (handoffTimerRef.current !== null) {
        clearTimeout(handoffTimerRef.current)
        handoffTimerRef.current = null
      }
      animationRef.current = null
      setPill((current) => (current ? { ...current, transition: 'none' } : current))
    }
  }

  const darkEdgeGradient =
    leadingEdgeRef.current === 'right'
      ? 'linear-gradient(90deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.06) 72%, rgba(0,0,0,0.2) 86%, rgba(0,0,0,0.48) 100%)'
      : 'linear-gradient(270deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.06) 72%, rgba(0,0,0,0.2) 86%, rgba(0,0,0,0.48) 100%)'

  const lightEdgeGradient =
    leadingEdgeRef.current === 'right'
      ? 'linear-gradient(90deg, rgba(255,255,255,0) 48%, rgba(221,255,198,0.08) 72%, rgba(243,255,234,0.34) 100%)'
      : 'linear-gradient(270deg, rgba(255,255,255,0) 48%, rgba(221,255,198,0.08) 72%, rgba(243,255,234,0.34) 100%)'

  return (
    <div
      ref={containerRef}
      className="pill-switcher"
      role="tablist"
      aria-label={ariaLabel}
    >
      {pill !== null ? (
        <div
          ref={pillRef}
          className="pill-switcher-indicator"
          onTransitionEnd={handlePillTransitionEnd}
          style={{ left: pill.left, width: pill.width, transition: pill.transition }}
          aria-hidden="true"
        >
          <div className="pill-switcher-indicator-fill" />
          <div
            className="pill-switcher-indicator-edge dark"
            style={{
              background: darkEdgeGradient,
              opacity: pill.darkEdgeOpacity,
              transition: pill.edgeTransition,
            }}
          />
          <div
            className="pill-switcher-indicator-edge light"
            style={{
              background: lightEdgeGradient,
              opacity: pill.lightEdgeOpacity,
              transition: pill.edgeTransition,
            }}
          />
        </div>
      ) : null}

      {options.map((option, optionIdx) => (
        <button
          key={option.id}
          ref={(node) => {
            buttonRefs.current[optionIdx] = node
          }}
          type="button"
          className={`pill-switcher-option ${value === option.id ? 'selected' : ''}`}
          style={segmentWidth !== null ? { width: segmentWidth } : undefined}
          onClick={() => onChange(option.id)}
          role="tab"
          aria-selected={value === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
