import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import styles from './PillSwitcher.module.css'

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
}

const PILL_TRANSITION = 'left 140ms ease, width 140ms ease'

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
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [segmentWidth, setSegmentWidth] = useState<number | null>(null)
  const [pill, setPill] = useState<PillState | null>(null)
  const idx = options.findIndex((option) => option.id === value)

  const activeIdxRef = useRef<number>(idx)
  const activeValueRef = useRef<T>(value)
  const lastPositionedValueRef = useRef<T>(value)

  activeIdxRef.current = idx
  activeValueRef.current = value

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

  function pillStateFor(rect: SegmentRect, transition = 'none'): PillState {
    return {
      left: rect.left,
      width: rect.width,
      transition,
    }
  }

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
      lastPositionedValueRef.current = activeValueRef.current
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
    if (lastPositionedValueRef.current === value) return

    const final = rectFor(idx)
    if (!final) return

    lastPositionedValueRef.current = value
    setPill((current) => pillStateFor(final, current ? PILL_TRANSITION : 'none'))
  }, [idx, segmentWidth, value])

  return (
    <div
      ref={containerRef}
      className={styles['pill-switcher']}
      role="tablist"
      aria-label={ariaLabel}
    >
      {pill !== null ? (
        <div
          className={styles['pill-switcher-indicator']}
          style={{ left: pill.left, width: pill.width, transition: pill.transition }}
          aria-hidden="true"
        />
      ) : null}

      {options.map((option, optionIdx) => (
        <button
          key={option.id}
          ref={(node) => {
            buttonRefs.current[optionIdx] = node
          }}
          type="button"
          className={`${styles['pill-switcher-option']} ${value === option.id ? styles.selected : ''}`}
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
