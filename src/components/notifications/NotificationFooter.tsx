import { useState } from 'react'
import { AlertTriangle, Clock } from 'lucide-react'
import type { PendingNotification } from '../../../core/notifications'
import styles from './NotificationFooter.module.css'

type NotificationFooterProps = {
  count: number
  notifications: PendingNotification[]
  onNavigate: (notification: PendingNotification) => void
}

export function NotificationFooter({ count, notifications, onNavigate }: NotificationFooterProps) {
  const [open, setOpen] = useState(false)
  const hasNotifications = count > 0

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
        type="button"
        className={`${styles.trigger} ${hasNotifications ? styles.active : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`${count} notifications`}
        aria-pressed={open}
      >
        <AlertTriangle size={18} />
        {hasNotifications && (
          <span className={styles.badge}>{count}</span>
        )}
      </button>

      {open && (
        <div className={styles.menu}>
          {notifications.length === 0 ? (
            <div className={styles.empty}>no notifications</div>
          ) : (
            <ul className={styles.list}>
              {notifications.map((notification) => (
                <li key={notification.id}>
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
                    <div className={styles.itemType}>{notification.kind.replace('-', ' ')}</div>
                    <div className={styles.itemMessage}>{notification.message}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
