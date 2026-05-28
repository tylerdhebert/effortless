import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Clock } from 'lucide-react'
import { formatNotificationKind, type PendingNotification } from '../../../core/notifications'
import styles from './NotificationFooter.module.css'

type NotificationFooterProps = {
  count: number
  notifications: PendingNotification[]
  onNavigate: (notification: PendingNotification) => void
}

export function NotificationFooter({ count, notifications, onNavigate }: NotificationFooterProps) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hasNotifications = count > 0

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev
      if (next && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const isCollapsed = triggerRef.current.closest('.collapsed-sidebar') != null
        if (isCollapsed) {
          setMenuPos({ top: rect.top, left: rect.right + 10 })
        } else {
          setMenuPos({ top: rect.bottom + 4, left: rect.right - 268 })
        }
      }
      return next
    })
  }

  function handleNavigate(notification: PendingNotification) {
    setOpen(false)
    onNavigate(notification)
  }

  function formatElapsed(startedAt: string): string {
    const elapsed = Date.now() - new Date(startedAt).getTime()
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <div className={styles.footer}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${hasNotifications ? styles.active : ''}`}
        onClick={handleToggle}
        aria-label={`${count} notifications`}
        aria-pressed={open}
      >
        <AlertTriangle size={18} />
        {hasNotifications && (
          <span className={styles.badge}>{count}</span>
        )}
      </button>

      {open && menuPos && createPortal(
        <div className={styles.menu} style={{ position: 'fixed', top: menuPos.top, left: Math.max(0, menuPos.left) }}>
          {notifications.length === 0 ? (
            <div className={styles.empty}>no notifications</div>
          ) : (
            <ul className={styles.list}>
              {notifications.map((notification) => (
                <li key={`${notification.kind}-${notification.id}`}>
                  <button
                    type="button"
                    className={styles.item}
                    onClick={() => handleNavigate(notification)}
                  >
                    <div className={styles.itemHeader}>
                      <span className={styles.itemRefs}>
                        {notification.effortShortRef} · {notification.entityShortRef}
                      </span>
                      <span className={styles.itemElapsed}>
                        <Clock size={10} />
                        {formatElapsed(notification.startedAt)}
                      </span>
                    </div>
                    <div className={styles.itemType}>{formatNotificationKind(notification.kind)}</div>
                    <div className={styles.itemMessage}>{notification.message}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
