import type { Effort } from '../../../core/types'
import { Home, Plus, Settings } from 'lucide-react'
import { formatTemplate } from '../../lib/helpers'
import styles from './Sidebar.module.css'

type SidebarProps = {
  efforts: Effort[]
  selectedEffortId: number | null
  reposCount: number
  mandatesCount: number
  surfaceMode: 'effort' | 'manage'
  manageSection: 'repos' | 'mandates'
  onSelectEffort: (effortId: number) => void
  onSetSurfaceMode: (mode: 'effort' | 'manage') => void
  onSetManageSection: (section: 'repos' | 'mandates') => void
  onOpenCreateEffort: () => void
}

export function Sidebar({
  efforts,
  selectedEffortId,
  reposCount,
  mandatesCount,
  surfaceMode,
  manageSection,
  onSelectEffort,
  onSetSurfaceMode,
  onSetManageSection,
  onOpenCreateEffort,
}: SidebarProps) {
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
            aria-label="create effort"
            onClick={() => {
              onOpenCreateEffort()
            }}
          >
            <Plus size={16} />
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
          </div>
        ) : (
          <div className={styles['effort-list']}>
            {efforts.map((effort) => (
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
                  <span>{effort.shortRef}</span>
                  <small>{formatTemplate(effort.template)}</small>
                </div>
                <strong>{effort.title}</strong>
                <div className={styles['effort-row-meta']}>
                  <span>{effort.status}</span>
                </div>
              </button>
            ))}

            {efforts.length === 0 ? <p className="empty-state">no efforts</p> : null}
          </div>
        )}
      </div>
    </aside>
  )
}
