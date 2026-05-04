import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type {
  EffortTemplate,
  Mandate,
  Repo,
  TemplatePlaybook,
  UpdateTemplatePlaybookInput,
  WorkSurface,
  MandateSourceType,
} from '../../../core/types'
import { PathPicker } from '../ui/PathPicker'
import { NotificationSettingsPanel } from '../notifications/NotificationSettingsPanel'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { MandateTab } from './MandateTab'
import { TemplatePlaybookTab } from './TemplatePlaybookTab'
import styles from './ManageSurface.module.css'

type ManageSurfaceProps = {
  repos: Repo[]
  mandates: Mandate[]
  playbooks: TemplatePlaybook[]
  createRepo: (input: { name: string; path: string; baseBranch: string; buildCommand: string | null }) => Promise<Repo>
  updateRepo: (input: { repoId: number; name: string; path: string; baseBranch: string; buildCommand: string | null }) => Promise<Repo>
  deleteRepo: (repoId: number) => Promise<void>
  createMandate: (input: { workSurface: WorkSurface; repoId: number | null; sourceType: MandateSourceType; body: string | null; filePath: string | null }) => Promise<Mandate>
  updateMandate: (input: { mandateId: number; workSurface: WorkSurface; repoId: number | null; sourceType: MandateSourceType; body: string | null; filePath: string | null }) => Promise<Mandate>
  deleteMandate: (mandateId: number) => Promise<void>
  updateTemplatePlaybook: (input: UpdateTemplatePlaybookInput) => Promise<TemplatePlaybook>
  resetTemplatePlaybook: (template: EffortTemplate) => Promise<TemplatePlaybook>
  isCreatingRepo: boolean
  isUpdatingRepo: boolean
  isDeletingRepo: boolean
  isCreatingMandate: boolean
  isUpdatingMandate: boolean
  isDeletingMandate: boolean
  isUpdatingPlaybook: boolean
  isResettingPlaybook: boolean
  section: 'repos' | 'mandates' | 'playbooks' | 'notifications' | 'appearance'
  notificationSettings?: {
    osNotificationsEnabled: boolean
    bannerNotificationsEnabled: boolean
    badgeNotificationsEnabled: boolean
    soundNotificationsEnabled: boolean
    toastDurationSeconds: number
  }
  onUpdateNotificationSettings?: (settings: {
    osNotificationsEnabled?: boolean
    bannerNotificationsEnabled?: boolean
    badgeNotificationsEnabled?: boolean
    soundNotificationsEnabled?: boolean
    toastDurationSeconds?: number
  }) => void
  isUpdatingNotificationSettings?: boolean
  currentTheme?: string
  onUpdateTheme?: (theme: string) => void
}

export function ManageSurface({
  repos,
  mandates,
  playbooks,
  createRepo,
  updateRepo,
  deleteRepo,
  createMandate,
  updateMandate,
  deleteMandate,
  updateTemplatePlaybook,
  resetTemplatePlaybook,
  isCreatingRepo,
  isUpdatingRepo,
  isDeletingRepo,
  isCreatingMandate,
  isUpdatingMandate,
  isDeletingMandate,
  isUpdatingPlaybook,
  isResettingPlaybook,
  section,
  notificationSettings,
  onUpdateNotificationSettings,
  isUpdatingNotificationSettings,
  currentTheme,
  onUpdateTheme,
}: ManageSurfaceProps) {
  const [repoName, setRepoName] = useState('')
  const [repoPath, setRepoPath] = useState('')
  const [repoBaseBranch, setRepoBaseBranch] = useState('main')
  const [repoBuildCommand, setRepoBuildCommand] = useState('')
  const [editingRepoId, setEditingRepoId] = useState<number | null>(null)
  const [editingRepoName, setEditingRepoName] = useState('')
  const [editingRepoPath, setEditingRepoPath] = useState('')
  const [editingRepoBaseBranch, setEditingRepoBaseBranch] = useState('main')
  const [editingRepoBuildCommand, setEditingRepoBuildCommand] = useState('')

  function resetRepoEditor() {
    setEditingRepoId(null)
    setEditingRepoName('')
    setEditingRepoPath('')
    setEditingRepoBaseBranch('main')
    setEditingRepoBuildCommand('')
  }

  function beginRepoEdit(repo: Repo) {
    setEditingRepoId(repo.id)
    setEditingRepoName(repo.name)
    setEditingRepoPath(repo.path)
    setEditingRepoBaseBranch(repo.baseBranch)
    setEditingRepoBuildCommand(repo.buildCommand ?? '')
  }

  return (
    <>
      <div className={`effort-scroll ${styles['manage-scroll']}`}>
        {section === 'repos' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-repos']}`}>
            <section className={styles['manage-panel']}>
              <div className={styles['manage-panel-header']}>
                <div>
                  <h3>{editingRepoId ? 'edit repo' : 'add repo'}</h3>
                </div>
              </div>

              <form
                className={`${styles['repo-form']} ${styles['manage-form']}`}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (editingRepoId) {
                    if (!editingRepoName.trim() || !editingRepoPath.trim() || !editingRepoBaseBranch.trim()) return
                    updateRepo({
                      repoId: editingRepoId,
                      name: editingRepoName,
                      path: editingRepoPath,
                      baseBranch: editingRepoBaseBranch,
                      buildCommand: editingRepoBuildCommand || null,
                    })
                  } else {
                    if (!repoName.trim() || !repoPath.trim() || !repoBaseBranch.trim()) return
                    createRepo({ name: repoName, path: repoPath, baseBranch: repoBaseBranch, buildCommand: repoBuildCommand || null })
                  }
                }}
              >
                <input
                  aria-label="repo name"
                  placeholder="name"
                  value={editingRepoId ? editingRepoName : repoName}
                  onChange={(event) =>
                    editingRepoId ? setEditingRepoName(event.target.value) : setRepoName(event.target.value)
                  }
                />
                <PathPicker
                  ariaLabel="repo path"
                  placeholder="repo path"
                  value={editingRepoId ? editingRepoPath : repoPath}
                  onChange={(path) =>
                    editingRepoId ? setEditingRepoPath(path) : setRepoPath(path)
                  }
                />
                <div className={styles['repo-form-row']}>
                  <input
                    aria-label="repo base branch"
                    placeholder="base branch"
                    value={editingRepoId ? editingRepoBaseBranch : repoBaseBranch}
                    onChange={(event) =>
                      editingRepoId ? setEditingRepoBaseBranch(event.target.value) : setRepoBaseBranch(event.target.value)
                    }
                  />
                  <input
                    aria-label="repo build command"
                    placeholder="build command"
                    value={editingRepoId ? editingRepoBuildCommand : repoBuildCommand}
                    onChange={(event) =>
                      editingRepoId ? setEditingRepoBuildCommand(event.target.value) : setRepoBuildCommand(event.target.value)
                    }
                  />
                </div>
                <div className={styles['manage-repo-actions']}>
                  <button type="submit" disabled={editingRepoId ? isUpdatingRepo : isCreatingRepo}>
                    {editingRepoId ? (isUpdatingRepo ? 'saving' : 'save repo') : isCreatingRepo ? 'creating' : 'add repo'}
                  </button>
                  {editingRepoId ? (
                    <button type="button" onClick={resetRepoEditor} disabled={isUpdatingRepo}>
                      cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>

            <section className={styles['manage-panel']}>
              <div className={styles['manage-panel-header']}>
                <div>
                  <h3>repos</h3>
                </div>
              </div>

              <div className={`${styles['repo-list']} ${styles['manage-repo-list']}`}>
                {repos.map((repo) => (
                  <article className={`${styles['repo-row']} ${styles['manage-repo-row']}`} key={repo.id}>
                    <div>
                      <strong>{repo.name}</strong>
                      <span>{repo.shortRef}</span>
                    </div>
                    <p>{repo.path}</p>
                    <small>{repo.baseBranch}</small>
                    <div className={styles['manage-repo-actions']}>
                      <button type="button" className="icon-btn" onClick={() => beginRepoEdit(repo)} aria-label="edit">
                        <Pencil size={12} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => deleteRepo(repo.id)} disabled={isDeletingRepo} aria-label="remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))}

                {repos.length === 0 ? <p className="empty-state">no repos</p> : null}
              </div>
            </section>
          </section>
        ) : section === 'mandates' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-mandates']}`}>
            <section className={`${styles['manage-panel']} ${styles['manage-panel-wide']}`}>
              <div className={styles['manage-panel-header']}>
                <div>
                  <h3>mandates</h3>
                </div>
              </div>
              <MandateTab
                repos={repos}
                mandates={mandates}
                createMandate={createMandate}
                updateMandate={updateMandate}
                deleteMandate={deleteMandate}
                isCreating={isCreatingMandate}
                isUpdating={isUpdatingMandate}
                isDeleting={isDeletingMandate}
              />
            </section>
          </section>
        ) : section === 'playbooks' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-playbooks']}`}>
            <section className={`${styles['manage-panel']} ${styles['manage-panel-wide']}`}>
              <div className={styles['manage-panel-header']}>
                <div>
                  <h3>template playbooks</h3>
                </div>
              </div>
              <TemplatePlaybookTab
                playbooks={playbooks}
                onSave={updateTemplatePlaybook}
                onReset={resetTemplatePlaybook}
                isSaving={isUpdatingPlaybook}
                isResetting={isResettingPlaybook}
              />
            </section>
          </section>
        ) : section === 'notifications' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-notifications']}`}>
            {notificationSettings && onUpdateNotificationSettings ? (
              <NotificationSettingsPanel
                settings={notificationSettings}
                onUpdate={onUpdateNotificationSettings}
                isUpdating={isUpdatingNotificationSettings ?? false}
              />
            ) : (
              <p className="empty-state">notification settings unavailable</p>
            )}
          </section>
        ) : section === 'appearance' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-notifications']}`}>
            <AppearanceSettingsPanel
              currentTheme={currentTheme ?? 'grass'}
              onUpdateTheme={onUpdateTheme ?? (() => {})}
            />
          </section>
        ) : null}
      </div>
    </>
  )
}
