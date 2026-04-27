import type { Effort } from '../../core/types'
import { Home, Plus, Settings } from 'lucide-react'
import { formatTemplate } from './helpers'

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
    <aside className="efforts-sidebar">
      <div className="sidebar-heading">
        <div className="sidebar-title">
          <span className="sidebar-dot" aria-hidden="true" />
          <h1>{surfaceMode === 'manage' ? 'manage' : 'efforts'}</h1>
        </div>
        <div className="sidebar-actions" aria-label="effort actions">
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

      <div className="sidebar-scroll">
        {surfaceMode === 'manage' ? (
          <div className="manage-nav">
            <button
              className={`manage-card ${manageSection === 'repos' ? 'selected' : ''}`}
              type="button"
              onClick={() => onSetManageSection('repos')}
            >
              <div className="manage-card-heading">
                <strong>repos</strong>
                <span>{reposCount}</span>
              </div>
            </button>
            <button
              className={`manage-card ${manageSection === 'mandates' ? 'selected' : ''}`}
              type="button"
              onClick={() => onSetManageSection('mandates')}
            >
              <div className="manage-card-heading">
                <strong>mandates</strong>
                <span>{mandatesCount}</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="effort-list">
            {efforts.map((effort) => (
              <button
                className={`effort-row ${effort.id === selectedEffortId ? 'selected' : ''}`}
                key={effort.id}
                onClick={() => {
                  onSelectEffort(effort.id)
                  onSetSurfaceMode('effort')
                }}
                type="button"
              >
                <div className="effort-row-heading">
                  <span>{effort.shortRef}</span>
                  <small>{formatTemplate(effort.template)}</small>
                </div>
                <strong>{effort.title}</strong>
                <div className="effort-row-meta">
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
