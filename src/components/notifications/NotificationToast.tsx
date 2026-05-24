import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatNotificationKind, type PendingNotification } from '../../../core/notifications'
import styles from './NotificationToast.module.css'

type NotificationToastProps = {
  notifications: PendingNotification[]
  onNavigate: (notification: PendingNotification) => void
  isLoading?: boolean
  toastDurationSeconds?: number
  osNotificationsEnabled?: boolean
  soundNotificationsEnabled?: boolean
  bannerNotificationsEnabled?: boolean
}

export function NotificationToast({
  notifications,
  onNavigate,
  isLoading = false,
  toastDurationSeconds = 5,
  osNotificationsEnabled = true,
  soundNotificationsEnabled = false,
  bannerNotificationsEnabled = true,
}: NotificationToastProps) {
  const [visible, setVisible] = useState(false)
  const [index, setIndex] = useState(0)
  const [newNotifications, setNewNotifications] = useState<PendingNotification[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const hasEstablishedBaselineRef = useRef(false)

  const durationMs = toastDurationSeconds * 1000
  const current = newNotifications[index] ?? null

  // Detect newly arrived notifications and toast only those.
  // Wait until the first non-loading observation to establish the
  // baseline so existing notifications aren't re-toasted on startup.
  useEffect(() => {
    if (isLoading) return

    const notificationKey = (notification: PendingNotification) => `${notification.kind}-${notification.id}`
    const currentIds = new Set(notifications.map(notificationKey))

    if (!hasEstablishedBaselineRef.current) {
      prevIdsRef.current = currentIds
      hasEstablishedBaselineRef.current = true
      return
    }

    const arrived = notifications.filter((notification) => !prevIdsRef.current.has(notificationKey(notification)))
    prevIdsRef.current = currentIds

    if (arrived.length > 0) {
      setNewNotifications(arrived)
      setVisible(true)
      setIndex(0)

      if (osNotificationsEnabled) {
        for (const notification of arrived) {
          window.effortless.showOSNotification(
            `${notification.effortShortRef}: ${formatNotificationKind(notification.kind)}`,
            notification.message,
          )
        }
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
  }, [notifications, isLoading, osNotificationsEnabled, soundNotificationsEnabled])

  // Auto-dismiss timer
  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    if (visible && newNotifications.length > 0) {
      timerRef.current = setTimeout(() => {
        setVisible(false)
        setNewNotifications([])
      }, durationMs)
    }
  }, [visible, newNotifications.length, durationMs])

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
    const remaining = newNotifications.filter((_, i) => i !== index)
    if (remaining.length === 0) {
      setVisible(false)
      setNewNotifications([])
    } else {
      setNewNotifications(remaining)
      setIndex((prev) => Math.min(prev, remaining.length - 1))
      resetTimer()
    }
  }

  function handleNavigate() {
    onNavigate(current)
    setVisible(false)
    setNewNotifications([])
  }

  function handlePrev(event: React.MouseEvent) {
    event.stopPropagation()
    setIndex((prev) => Math.max(0, prev - 1))
    resetTimer()
  }

  function handleNext(event: React.MouseEvent) {
    event.stopPropagation()
    setIndex((prev) => Math.min(newNotifications.length - 1, prev + 1))
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
          <span className={styles.toastKind}>{formatNotificationKind(current.kind)}</span>
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
      {newNotifications.length > 1 && (
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
            {index + 1} / {newNotifications.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={index === newNotifications.length - 1}
            aria-label="next notification"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
