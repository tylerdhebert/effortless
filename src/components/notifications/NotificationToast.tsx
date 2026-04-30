import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { PendingNotification } from '../../../core/notifications'
import styles from './NotificationToast.module.css'

type NotificationToastProps = {
  notifications: PendingNotification[]
  onNavigate: (notification: PendingNotification) => void
  toastDurationSeconds?: number
  osNotificationsEnabled?: boolean
  soundNotificationsEnabled?: boolean
  bannerNotificationsEnabled?: boolean
}

export function NotificationToast({
  notifications,
  onNavigate,
  toastDurationSeconds = 5,
  osNotificationsEnabled = true,
  soundNotificationsEnabled = false,
  bannerNotificationsEnabled = true,
}: NotificationToastProps) {
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevIdsRef = useRef<string>('')
  const initialRef = useRef(true)

  const durationMs = toastDurationSeconds * 1000
  const activeNotifications = notifications.filter((n) => !dismissedIds.has(n.id))
  const hasNotifications = activeNotifications.length > 0
  const current = activeNotifications[index] ?? null

  // Show toast and trigger OS/sound notifications when new ones arrive
  // Skip on initial mount so existing pending notifications don't re-alert
  useEffect(() => {
    const currentIds = notifications.map((n) => n.id).sort().join(',')
    if (initialRef.current) {
      prevIdsRef.current = currentIds
      initialRef.current = false
      return
    }

    if (currentIds !== prevIdsRef.current && notifications.length > 0) {
      prevIdsRef.current = currentIds
      setVisible(true)
      setIndex(0)
      setDismissedIds(new Set())

      const latest = notifications[0]
      if (latest) {
        if (osNotificationsEnabled) {
          window.effortless.showOSNotification(
            `${latest.effortShortRef}: ${latest.kind.replace('-', ' ')}`,
            latest.message,
          )
        }
        if (soundNotificationsEnabled) {
          try {
            const ctx = new AudioContext()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = 880
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.1, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
            osc.start(ctx.currentTime)
            osc.stop(ctx.currentTime + 0.3)
          } catch {
            // ignore audio errors
          }
        }
      }
    }
  }, [notifications, osNotificationsEnabled, soundNotificationsEnabled])

  // Auto-dismiss timer
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (visible && hasNotifications) {
      timerRef.current = setTimeout(() => {
        setVisible(false)
      }, durationMs)
    }
  }, [visible, hasNotifications, durationMs])

  useEffect(() => {
    resetTimer()
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [resetTimer])

  if (!bannerNotificationsEnabled || !visible || !current) {
    return null
  }

  function handleDismiss(event: React.MouseEvent) {
    event.stopPropagation()
    setDismissedIds((prev) => new Set(prev).add(current.id))
    if (activeNotifications.length <= 1) {
      setVisible(false)
    } else {
      setIndex((prev) => Math.min(prev, activeNotifications.length - 2))
      resetTimer()
    }
  }

  function handleNavigate() {
    onNavigate(current)
    handleDismiss({ stopPropagation: () => {} } as React.MouseEvent)
  }

  function handlePrev(event: React.MouseEvent) {
    event.stopPropagation()
    setIndex((prev) => Math.max(0, prev - 1))
    resetTimer()
  }

  function handleNext(event: React.MouseEvent) {
    event.stopPropagation()
    setIndex((prev) => Math.min(activeNotifications.length - 1, prev + 1))
    resetTimer()
  }

  function handleMouseEnter() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handleMouseLeave() {
    resetTimer()
  }

  return (
    <div
      className={styles.toast}
      onClick={handleNavigate}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
    >
      <div className={styles.toastContent}>
        <div className={styles.toastHeader}>
          <span className={styles.toastKind}>{current.kind.replace('-', ' ')}</span>
          <button
            type="button"
            className={styles.toastClose}
            onClick={handleDismiss}
            aria-label="dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
        <p className={styles.toastMessage}>{current.message}</p>
        <div className={styles.toastMeta}>
          <span>
            {current.effortShortRef} · {current.entityShortRef}
          </span>
        </div>
      </div>
      {activeNotifications.length > 1 && (
        <div className={styles.toastPager}>
          <button
            type="button"
            onClick={handlePrev}
            disabled={index === 0}
            aria-label="previous notification"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            {index + 1} / {activeNotifications.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={index === activeNotifications.length - 1}
            aria-label="next notification"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
