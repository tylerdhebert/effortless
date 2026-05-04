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
  const channelSummary = [
    { label: 'desktop', enabled: settings.osNotificationsEnabled },
    { label: 'banner', enabled: settings.bannerNotificationsEnabled },
    { label: 'badge', enabled: settings.badgeNotificationsEnabled },
    { label: 'sound', enabled: settings.soundNotificationsEnabled },
  ]

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h3>notification channels</h3>
        </div>
      </div>

      <div className={styles.summaryRow} aria-label="notification summary">
        {channelSummary.map((item) => (
          <span
            key={item.label}
            className={`${styles.summaryChip} ${item.enabled ? styles.summaryChipActive : ''}`}
          >
            {item.label} {item.enabled ? 'on' : 'off'}
          </span>
        ))}
      </div>

      <div className={styles.form}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>delivery</span>

          <label className={styles.toggleRow}>
            <div className={styles.toggleCopy}>
              <span>os notifications</span>
              <small>native desktop notifications</small>
            </div>
            <input
              type="checkbox"
              checked={settings.osNotificationsEnabled}
              onChange={(e) => onUpdate({ osNotificationsEnabled: e.target.checked })}
              disabled={isUpdating}
            />
          </label>

          <label className={styles.toggleRow}>
            <div className={styles.toggleCopy}>
              <span>banner notifications</span>
              <small>in-app toast banners</small>
            </div>
            <input
              type="checkbox"
              checked={settings.bannerNotificationsEnabled}
              onChange={(e) => onUpdate({ bannerNotificationsEnabled: e.target.checked })}
              disabled={isUpdating}
            />
          </label>

          <label className={styles.toggleRow}>
            <div className={styles.toggleCopy}>
              <span>badge notifications</span>
              <small>warning badges on effort list</small>
            </div>
            <input
              type="checkbox"
              checked={settings.badgeNotificationsEnabled}
              onChange={(e) => onUpdate({ badgeNotificationsEnabled: e.target.checked })}
              disabled={isUpdating}
            />
          </label>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>behavior</span>

          <label className={styles.toggleRow}>
            <div className={styles.toggleCopy}>
              <span>sound notifications</span>
              <small>play a sound on new alerts</small>
            </div>
            <input
              type="checkbox"
              checked={settings.soundNotificationsEnabled}
              onChange={(e) => onUpdate({ soundNotificationsEnabled: e.target.checked })}
              disabled={isUpdating}
            />
          </label>

          <div className={styles.durationRow}>
            <div className={styles.durationCopy}>
              <label htmlFor="toast-duration">toast duration</label>
              <small>how long in-app banners stay visible</small>
            </div>
            <div className={styles.durationControls}>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() =>
                  onUpdate({ toastDurationSeconds: Math.max(1, settings.toastDurationSeconds - 1) })
                }
                disabled={isUpdating || settings.toastDurationSeconds <= 1}
                aria-label="decrease toast duration"
              >
                -
              </button>
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
                <span>sec</span>
              </div>
              <button
                type="button"
                className={styles.stepperButton}
                onClick={() =>
                  onUpdate({ toastDurationSeconds: Math.min(30, settings.toastDurationSeconds + 1) })
                }
                disabled={isUpdating || settings.toastDurationSeconds >= 30}
                aria-label="increase toast duration"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
