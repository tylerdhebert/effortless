import { useState } from 'react'
import styles from './NotificationSettingsPanel.module.css'

type NotificationSettings = {
  osNotificationsEnabled: boolean
  bannerNotificationsEnabled: boolean
  badgeNotificationsEnabled: boolean
  soundNotificationsEnabled: boolean
  toastDurationSeconds: number
}

type NotificationSettingsPanelProps = {
  settings: NotificationSettings
  onUpdate: (settings: Partial<NotificationSettings>) => void
  isUpdating: boolean
}

export function NotificationSettingsPanel({
  settings,
  onUpdate,
  isUpdating,
}: NotificationSettingsPanelProps) {
  const [localDuration, setLocalDuration] = useState(settings.toastDurationSeconds)

  return (
    <div className={styles.panel}>
      <h3>notification settings</h3>

      <div className={styles.setting}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.osNotificationsEnabled}
            onChange={(e) => onUpdate({ osNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>os notifications</span>
        </label>
        <p className={styles.hint}>show native desktop notifications</p>
      </div>

      <div className={styles.setting}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.bannerNotificationsEnabled}
            onChange={(e) => onUpdate({ bannerNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>banner notifications</span>
        </label>
        <p className={styles.hint}>show in-app toast banners</p>
      </div>

      <div className={styles.setting}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.badgeNotificationsEnabled}
            onChange={(e) => onUpdate({ badgeNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>badge notifications</span>
        </label>
        <p className={styles.hint}>show warning badges on effort list items</p>
      </div>

      <div className={styles.setting}>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.soundNotificationsEnabled}
            onChange={(e) => onUpdate({ soundNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>sound notifications</span>
        </label>
        <p className={styles.hint}>play a sound when new notifications arrive</p>
      </div>

      <div className={styles.setting}>
        <label className={styles.durationLabel}>
          <span>toast duration</span>
          <input
            type="number"
            min={1}
            max={30}
            value={localDuration}
            onChange={(e) => setLocalDuration(Number(e.target.value))}
            onBlur={() => onUpdate({ toastDurationSeconds: localDuration })}
            disabled={isUpdating}
          />
          <span>seconds</span>
        </label>
        <p className={styles.hint}>how long toast banners stay visible</p>
      </div>
    </div>
  )
}
