import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type {
  AgentProfile,
  CreateAgentProfileInput,
  Instructions,
  Repo,
  UpdateAgentProfileInput,
  SetInstructionsInput,
} from '../../../core/types'
import type { ThemePreference } from '../../../core/db'
import { PathPicker } from '../ui/PathPicker'
import { NotificationSettingsPanel } from '../notifications/NotificationSettingsPanel'
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel'
import { AgentProfileTab } from './AgentProfileTab'
import { InstructionsTab } from './InstructionsTab'
import styles from './ManageSurface.module.css'

type ManageSurfaceProps = {
  repos: Repo[]
  agentProfiles: AgentProfile[]
  instructions: Instructions[]
  createRepo: (input: { name: string; path: string; baseBranch: string; buildCommand: string | null }) => Promise<Repo>
  updateRepo: (input: { repoId: number; name: string; path: string; baseBranch: string; buildCommand: string | null }) => Promise<Repo>
  deleteRepo: (repoId: number) => Promise<void>
  createAgentProfile: (input: CreateAgentProfileInput) => Promise<AgentProfile>
  updateAgentProfile: (input: UpdateAgentProfileInput) => Promise<AgentProfile>
  deleteAgentProfile: (profileId: number) => Promise<void>
  setInstructions: (input: SetInstructionsInput) => Promise<Instructions>
  deleteInstructions: (id: number) => Promise<void>
  isCreatingRepo: boolean
  isUpdatingRepo: boolean
  isDeletingRepo: boolean
  isCreatingAgentProfile: boolean
  isUpdatingAgentProfile: boolean
  isDeletingAgentProfile: boolean
  isSavingInstructions: boolean
  isClearingInstructions: boolean
  section: 'repos' | 'profiles' | 'instructions' | 'notifications' | 'appearance'
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
  currentTheme?: ThemePreference
  onUpdateTheme?: (theme: ThemePreference) => void
}

export function ManageSurface({
  repos,
  agentProfiles,
  instructions,
  createRepo,
  updateRepo,
  deleteRepo,
  createAgentProfile,
  updateAgentProfile,
  deleteAgentProfile,
  setInstructions,
  deleteInstructions,
  isCreatingRepo,
  isUpdatingRepo,
  isDeletingRepo,
  isCreatingAgentProfile,
  isUpdatingAgentProfile,
  isDeletingAgentProfile,
  isSavingInstructions,
  isClearingInstructions,
  section,
  notificationSettings,
  onUpdateNotificationSettings,
  isUpdatingNotificationSettings,
  currentTheme,
  onUpdateTheme,
}: ManageSurfaceProps) {
  const [selectedRepoKey, setSelectedRepoKey] = useState<string>('new')
  const [repoName, setRepoName] = useState('')
  const [repoPath, setRepoPath] = useState('')
  const [repoBaseBranch, setRepoBaseBranch] = useState('main')
  const [repoBuildCommand, setRepoBuildCommand] = useState('')

  const selectedRepo = useMemo(
    () => repos.find((repo) => String(repo.id) === selectedRepoKey) ?? null,
    [repos, selectedRepoKey],
  )

  useEffect(() => {
    if (selectedRepoKey === 'new') {
      setRepoName('')
      setRepoPath('')
      setRepoBaseBranch('main')
      setRepoBuildCommand('')
      return
    }

    if (!selectedRepo) {
      return
    }

    setRepoName(selectedRepo.name)
    setRepoPath(selectedRepo.path)
    setRepoBaseBranch(selectedRepo.baseBranch)
    setRepoBuildCommand(selectedRepo.buildCommand ?? '')
  }, [repos, selectedRepo, selectedRepoKey])

  const repoBaseline = selectedRepo
    ? {
        name: selectedRepo.name,
        path: selectedRepo.path,
        baseBranch: selectedRepo.baseBranch,
        buildCommand: selectedRepo.buildCommand ?? '',
      }
    : {
        name: '',
        path: '',
        baseBranch: 'main',
        buildCommand: '',
      }

  const repoDirty =
    repoName !== repoBaseline.name ||
    repoPath !== repoBaseline.path ||
    repoBaseBranch !== repoBaseline.baseBranch ||
    repoBuildCommand !== repoBaseline.buildCommand

  const repoReady = repoName.trim().length > 0 && repoPath.trim().length > 0 && repoBaseBranch.trim().length > 0

  function resetRepoEditor() {
    setRepoName(repoBaseline.name)
    setRepoPath(repoBaseline.path)
    setRepoBaseBranch(repoBaseline.baseBranch)
    setRepoBuildCommand(repoBaseline.buildCommand)
  }

  async function handleRepoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!repoReady) return

    if (selectedRepo) {
      await updateRepo({
        repoId: selectedRepo.id,
        name: repoName,
        path: repoPath,
        baseBranch: repoBaseBranch,
        buildCommand: repoBuildCommand || null,
      })
      return
    }

    const created = await createRepo({
      name: repoName,
      path: repoPath,
      baseBranch: repoBaseBranch,
      buildCommand: repoBuildCommand || null,
    })
    setSelectedRepoKey(String(created.id))
  }

  async function handleDeleteRepo() {
    if (!selectedRepo) return
    const deletedId = selectedRepo.id
    await deleteRepo(deletedId)
    const nextRepo = repos.find((repo) => repo.id !== deletedId)
    setSelectedRepoKey(nextRepo ? String(nextRepo.id) : 'new')
  }

  return (
    <>
      <div className={`effort-scroll ${styles['manage-scroll']}`}>
        {section === 'repos' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-repos']}`}>
            <section className={`${styles['manage-panel']} ${styles['manage-panel-wide']}`}>
              <div className={styles['manage-panel-header']}>
                <div>
                  <h3>repos</h3>
                </div>
              </div>
              <div className={styles['repo-workspace']}>
                <div className={styles['repo-rail']}>
                  <button
                    type="button"
                    className={`${styles['repo-select-button']} ${selectedRepoKey === 'new' ? styles.selected : ''}`}
                    onClick={() => setSelectedRepoKey('new')}
                  >
                    <span className={styles['repo-select-heading']}>
                      <strong>new repo</strong>
                      <Plus size={14} />
                    </span>
                  </button>

                  <div className={styles['repo-list']}>
                    {repos.map((repo) => (
                      <button
                        key={repo.id}
                        type="button"
                        className={`${styles['repo-select-button']} ${selectedRepo?.id === repo.id ? styles.selected : ''}`}
                        onClick={() => setSelectedRepoKey(String(repo.id))}
                        title={repo.path}
                      >
                        <span className={styles['repo-select-heading']}>
                          <strong>{repo.name}</strong>
                          <span>{repo.shortRef}</span>
                        </span>
                        <small>{repo.baseBranch}</small>
                        <p>{repo.path}</p>
                      </button>
                    ))}

                    {repos.length === 0 ? <p className="empty-state">no repos</p> : null}
                  </div>
                </div>

                <form className={`${styles['repo-form']} ${styles['manage-form']}`} onSubmit={(event) => void handleRepoSubmit(event)}>
                  <div className={styles['repo-editor-header']}>
                    <div className={styles['repo-editor-title']}>
                      <span className={styles['repo-editor-label']}>{selectedRepo ? `${selectedRepo.name} repo` : 'new repo'}</span>
                      {selectedRepo ? <small>{selectedRepo.shortRef}</small> : null}
                    </div>
                    <div className={styles['manage-repo-actions']}>
                      {selectedRepo ? (
                        <button type="button" onClick={resetRepoEditor} disabled={!repoDirty || isUpdatingRepo}>
                          reset
                        </button>
                      ) : null}
                      {selectedRepo ? (
                        <button type="button" className={styles['repo-delete-button']} onClick={() => void handleDeleteRepo()} disabled={isDeletingRepo}>
                          <Trash2 size={14} />
                          <span>{isDeletingRepo ? 'deleting' : 'delete'}</span>
                        </button>
                      ) : null}
                      <button type="submit" disabled={!repoReady || !repoDirty || (selectedRepo ? isUpdatingRepo : isCreatingRepo)}>
                        {selectedRepo ? (isUpdatingRepo ? 'saving' : 'save repo') : isCreatingRepo ? 'creating' : 'add repo'}
                      </button>
                    </div>
                  </div>

                  <div className={styles['repo-field-group']}>
                    <span className={styles['repo-field-label']}>identity</span>
                    <input
                      aria-label="repo name"
                      placeholder="repo name"
                      value={repoName}
                      onChange={(event) => setRepoName(event.target.value)}
                    />
                  </div>

                  <div className={styles['repo-field-group']}>
                    <span className={styles['repo-field-label']}>location</span>
                    <PathPicker
                      ariaLabel="repo path"
                      placeholder="repo path"
                      value={repoPath}
                      onChange={setRepoPath}
                    />
                  </div>

                  <div className={styles['repo-form-row']}>
                    <label className={styles['repo-field-group']}>
                      <span className={styles['repo-field-label']}>base branch</span>
                      <input
                        aria-label="repo base branch"
                        placeholder="base branch"
                        value={repoBaseBranch}
                        onChange={(event) => setRepoBaseBranch(event.target.value)}
                      />
                    </label>
                    <label className={styles['repo-field-group']}>
                      <span className={styles['repo-field-label']}>build command</span>
                      <input
                        aria-label="repo build command"
                        placeholder="build command"
                        value={repoBuildCommand}
                        onChange={(event) => setRepoBuildCommand(event.target.value)}
                      />
                    </label>
                  </div>
                </form>
              </div>
            </section>
          </section>
        ) : section === 'profiles' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-profiles']}`}>
            <section className={`${styles['manage-panel']} ${styles['manage-panel-wide']}`}>
              <div className={styles['manage-panel-header']}>
                <div>
                  <h3>environment profiles</h3>
                </div>
              </div>
              <AgentProfileTab
                profiles={agentProfiles}
                createProfile={createAgentProfile}
                updateProfile={updateAgentProfile}
                deleteProfile={deleteAgentProfile}
                isCreating={isCreatingAgentProfile}
                isUpdating={isUpdatingAgentProfile}
                isDeleting={isDeletingAgentProfile}
              />
            </section>
          </section>
        ) : section === 'instructions' ? (
          <section className={`${styles['manage-surface']} ${styles['manage-surface-instructions']}`}>
            <section className={`${styles['manage-panel']} ${styles['manage-panel-wide']}`}>
              <div className={styles['manage-panel-header']}>
                <div>
                  <h3>instructions</h3>
                </div>
              </div>
              <InstructionsTab
                repos={repos}
                instructions={instructions}
                setInstructions={setInstructions}
                deleteInstructions={deleteInstructions}
                isSaving={isSavingInstructions}
                isClearing={isClearingInstructions}
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
              currentTheme={currentTheme ?? 'system'}
              onUpdateTheme={onUpdateTheme ?? (() => {})}
            />
          </section>
        ) : null}
      </div>
    </>
  )
}
