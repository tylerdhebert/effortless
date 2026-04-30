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
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>notification channels</h3>
        </div>
      </div>

      <div className={styles.form}>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={settings.osNotificationsEnabled}
            onChange={(e) => onUpdate({ osNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>os notifications</span>
          <small>native desktop notifications</small>
        </label>

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={settings.bannerNotificationsEnabled}
            onChange={(e) => onUpdate({ bannerNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>banner notifications</span>
          <small>in-app toast banners</small>
        </label>

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={settings.badgeNotificationsEnabled}
            onChange={(e) => onUpdate({ badgeNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>badge notifications</span>
          <small>warning badges on effort list</small>
        </label>

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={settings.soundNotificationsEnabled}
            onChange={(e) => onUpdate({ soundNotificationsEnabled: e.target.checked })}
            disabled={isUpdating}
          />
          <span>sound notifications</span>
          <small>play a sound on new alerts</small>
        </label>

        <div className={styles.durationRow}>
          <label htmlFor="toast-duration">toast duration</label>
          <div className={styles.durationInput}>
            <input
              id="toast-duration"
              type="number"
              min={1}
              max={30}
              value={settings.toastDurationSeconds}
              onChange={(e) => {
                const val = Number(e.target.value)
                if (val >= 1 && val <= 30) {
                  onUpdate({ toastDurationSeconds: val })
                }
              }}
              disabled={isUpdating}
            />
            <span>seconds</span>
          </div>
        </div>
      </div>
    </section>
  )
}
