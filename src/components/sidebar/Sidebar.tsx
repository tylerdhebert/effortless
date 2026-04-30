import { useMemo, useState } from 'react'
import type { Effort, Task } from '../../../core/types'
import type { PendingNotification } from '../../../core/notifications'
import { Home, Plus, Settings, Bell } from 'lucide-react'
import { formatTemplate, effortStatusColor } from '../../lib/helpers'
import { WarningIndicator } from '../notifications/WarningIndicator'
import { NotificationFooter } from '../notifications/NotificationFooter'
import styles from './Sidebar.module.css'

type SidebarProps = {
  efforts: Effort[]
  tasks: Task[]
  repos: { id: number; name: string }[]
  selectedEffortId: number | null
  reposCount: number
  mandatesCount: number
  surfaceMode: 'effort' | 'manage'
  manageSection: 'repos' | 'mandates' | 'notifications' | 'appearance'
  onSelectEffort: (effortId: number) => void
  onSetSurfaceMode: (mode: 'effort' | 'manage') => void
  onSetManageSection: (section: 'repos' | 'mandates' | 'notifications' | 'appearance') => void
  onOpenCreateEffort: () => void
  effortPendingMap: Map<number, boolean>
  notificationCount: number
  notifications: PendingNotification[]
  onNavigateNotification: (notification: PendingNotification) => void
}

export function Sidebar({
  efforts,
  tasks,
  repos,
  selectedEffortId,
  reposCount,
  mandatesCount,
  surfaceMode,
  manageSection,
  onSelectEffort,
  onSetSurfaceMode,
  onSetManageSection,
  onOpenCreateEffort,
  effortPendingMap,
  notificationCount,
  notifications,
  onNavigateNotification,
}: SidebarProps) {
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [repoFilter, setRepoFilter] = useState<string[]>([])

  const effortRepoNames = useMemo(() => {
    const map = new Map<number, Set<string>>()
    for (const task of tasks) {
      if (task.repoId == null) continue
      const repo = repos.find((r) => r.id === task.repoId)
      if (!repo) continue
      const set = map.get(task.effortId) ?? new Set()
      set.add(repo.name)
      map.set(task.effortId, set)
    }
    return map
  }, [tasks, repos])

  const repoOptions = useMemo(() => {
    const names = new Set<string>()
    for (const set of effortRepoNames.values()) {
      for (const name of set) names.add(name)
    }
    return Array.from(names).sort()
  }, [effortRepoNames])

  const filteredEfforts = useMemo(() => {
    if (statusFilter.length === 0 && repoFilter.length === 0) return efforts
    return efforts.filter((effort) => {
      const statusMatch = statusFilter.length === 0 || statusFilter.includes(effort.status)
      const effortRepos = effortRepoNames.get(effort.id)
      const repoMatch =
        repoFilter.length === 0 ||
        (effortRepos != null && repoFilter.some((r) => effortRepos.has(r)))
      return statusMatch && repoMatch
    })
  }, [efforts, statusFilter, repoFilter, effortRepoNames])

  function toggleStatus(status: string) {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    )
  }

  function toggleRepo(repo: string) {
    setRepoFilter((prev) =>
      prev.includes(repo) ? prev.filter((r) => r !== repo) : [...prev, repo],
    )
  }

  const showFilters = surfaceMode === 'effort' && (repoOptions.length > 0 || efforts.length > 0)

  return (
    <aside className={styles['efforts-sidebar']}>
      <div className={styles['sidebar-heading']}>
        <div className={styles['sidebar-title']}>
          <span className={styles['sidebar-dot']} aria-hidden="true" />
          <h1>{surfaceMode === 'manage' ? 'manage' : 'efforts'}</h1>
        </div>
        <div className={styles['sidebar-actions']} aria-label="effort actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="home"
            onClick={() => {
              onSetSurfaceMode('effort')
            }}
          >
            <Home size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="open manage"
            onClick={() => {
              onSetSurfaceMode('manage')
              onSetManageSection(manageSection === 'repos' || manageSection === 'mandates' ? manageSection : 'repos')
            }}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className={styles['sidebar-filters']}>
          <div className={styles['filter-group']}>
            {(['active', 'complete', 'archived'] as const).map((status) => {
              const active = statusFilter.includes(status)
              const color = effortStatusColor(status)
              return (
                <button
                  key={status}
                  type="button"
                  className={`${styles['filter-pill']} ${active ? styles.active : ''}`}
                  style={active ? { borderColor: color, color, background: `${color}14` } : undefined}
                  onClick={() => toggleStatus(status)}
                >
                  {status}
                </button>
              )
            })}
          </div>
          {repoOptions.length > 0 ? (
            <div className={styles['filter-group']}>
              {repoOptions.map((repo) => {
                const active = repoFilter.includes(repo)
                return (
                  <button
                    key={repo}
                    type="button"
                    className={`${styles['filter-pill']} ${active ? styles.active : ''}`}
                    onClick={() => toggleRepo(repo)}
                  >
                    {repo}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles['sidebar-scroll']}>
        {surfaceMode === 'manage' ? (
          <div className={styles['manage-nav']}>
            <button
              className={`${styles['manage-card']} ${manageSection === 'repos' ? styles.selected : ''}`}
              type="button"
              onClick={() => onSetManageSection('repos')}
            >
              <div className={styles['manage-card-heading']}>
                <strong>repos</strong>
                <span>{reposCount}</span>
              </div>
            </button>
            <button
              className={`${styles['manage-card']} ${manageSection === 'mandates' ? styles.selected : ''}`}
              type="button"
              onClick={() => onSetManageSection('mandates')}
            >
              <div className={styles['manage-card-heading']}>
                <strong>mandates</strong>
                <span>{mandatesCount}</span>
              </div>
            </button>
            <button
              className={`${styles['manage-card']} ${manageSection === 'notifications' ? styles.selected : ''}`}
              type="button"
              onClick={() => onSetManageSection('notifications')}
            >
              <div className={styles['manage-card-heading']}>
                <strong>notifications</strong>
                <Bell size={14} />
              </div>
            </button>
            <button
              className={`${styles['manage-card']} ${manageSection === 'appearance' ? styles.selected : ''}`}
              type="button"
              onClick={() => onSetManageSection('appearance')}
            >
              <div className={styles['manage-card-heading']}>
                <strong>appearance</strong>
                <span>theme</span>
              </div>
            </button>
          </div>
        ) : (
          <div className={styles['effort-list']}>
            {filteredEfforts.map((effort) => (
              <button
                className={`${styles['effort-row']} ${effort.id === selectedEffortId ? styles.selected : ''}`}
                key={effort.id}
                onClick={() => {
                  onSelectEffort(effort.id)
                  onSetSurfaceMode('effort')
                }}
                type="button"
              >
                <div className={styles['effort-row-heading']}>
                  <span className={styles['effort-row-indicator']}>
                    {effortPendingMap.get(effort.id) ? (
                      <WarningIndicator title="needs input" size={12} />
                    ) : null}
                  </span>
                  <span>{effort.shortRef}</span>
                  <small>{formatTemplate(effort.template)}</small>
                  <span
                    className={styles['effort-row-status-dot']}
                    style={{ background: effortStatusColor(effort.status) }}
                    title={effort.status}
                  />
                </div>
                <strong>{effort.title}</strong>
              </button>
            ))}

            {filteredEfforts.length === 0 ? <p className="empty-state">no efforts</p> : null}
          </div>
        )}
      </div>

      <div className={styles['sidebar-footer']}>
        <button
          type="button"
          className={`icon-btn ${styles['add-effort-btn']}`}
          aria-label="create effort"
          onClick={() => {
            onOpenCreateEffort()
          }}
        >
          <Plus size={16} />
        </button>
        <NotificationFooter
          count={notificationCount}
          notifications={notifications}
          onNavigate={onNavigateNotification}
        />
      </div>
    </aside>
  )
}
