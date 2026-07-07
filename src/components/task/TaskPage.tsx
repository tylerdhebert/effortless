import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Diff, Hunk, parseDiff, tokenize } from 'react-diff-view'
import type { FileData, ViewType } from 'react-diff-view'
import 'react-diff-view/style/index.css'
import { refractor as rawRefractor } from 'refractor'
import { ChevronDown, ChevronsLeft, ChevronsRight, Play, RotateCcw, Send } from 'lucide-react'
import type {
  ActivityEvent,
  AgentProfile,
  AgentProvider,
  AgentRun,
  Repo,
  Review,
  Task,
  TaskBuildResult,
  TaskCommitView,
  TaskConflictView,
  TaskDiffView,
} from '../../../core/types'
import { listAgentProviders } from '../../../core/agentProviders'
import { resolveRunBadgeLabel } from '../../lib/runStatus'
import { Ref } from '../ui/Ref'
import { Stamp, statusTone } from '../ui/Stamp'
import { PillSwitcher } from '../ui/PillSwitcher'
import { CommentStream } from './CommentStream'
import styles from './TaskPage.module.css'

type TaskPageProps = {
  task: Task
  repos: Repo[]
  profiles: AgentProfile[]
  defaultProvider: AgentProvider
  defaultProfileId: number | null
  mainRunLive: boolean
  taskRuns?: AgentRun[]
  liveSessionIds?: Set<number>
  providerLiveRunIds?: Set<number>
  reviews: Review[]
  comments: ActivityEvent[]
  latestBuild: TaskBuildResult | null
  commitView: TaskCommitView | null
  conflictView: TaskConflictView | null
  onRunBuild: (taskId: number) => void
  onWorkOnTask: (input: { task: Task; provider: AgentProvider; profileId: number | null }) => void
  onStartTaskRun: (input: { task: Task; provider: AgentProvider; profileId: number | null }) => void
  onRerunTaskRun: (input: { task: Task; provider: AgentProvider; profileId: number | null }) => void
  onMergeTask: (taskId: number) => void
  onApplyReview: (reviewId: number) => void
  onRequestReviewChanges: (input: { reviewId: number; body: string }) => void
  isRunningBuild: boolean
  isLaunchingTask: boolean
  isRerunningTask: boolean
  isMergingTask: boolean
  isApplyingReview: boolean
  isRequestingReviewChanges: boolean
}

export function TaskPage({
  task,
  repos,
  profiles,
  defaultProvider,
  defaultProfileId,
  mainRunLive,
  taskRuns = [],
  liveSessionIds = new Set<number>(),
  providerLiveRunIds = new Set<number>(),
  reviews,
  comments,
  latestBuild,
  commitView,
  conflictView,
  onRunBuild,
  onWorkOnTask,
  onStartTaskRun,
  onRerunTaskRun,
  onMergeTask,
  onApplyReview,
  onRequestReviewChanges,
  isRunningBuild,
  isLaunchingTask,
  isRerunningTask,
  isMergingTask,
  isApplyingReview,
  isRequestingReviewChanges,
}: TaskPageProps) {
  const [diffType, setDiffType] = useState<'uncommitted' | 'branch' | 'combined'>('combined')
  const [diffViewType, setDiffViewType] = useState<ViewType>('unified')
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [showChangeRequest, setShowChangeRequest] = useState(false)
  const [launchProvider, setLaunchProvider] = useState<AgentProvider>(defaultProvider)
  const [launchProfileId, setLaunchProfileId] = useState<number | null>(defaultProfileId)
  const [launchMenuOpen, setLaunchMenuOpen] = useState(false)
  const [launchMenuPosition, setLaunchMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [activityCollapsed, setActivityCollapsed] = useState(false)
  const [workbenchPopover, setWorkbenchPopover] = useState<'commits' | 'conflicts' | null>(null)
  const [workbenchPopoverPosition, setWorkbenchPopoverPosition] = useState<{ top: number; left: number } | null>(null)
  const launchButtonRef = useRef<HTMLDivElement | null>(null)
  const launchMenuRef = useRef<HTMLDivElement | null>(null)
  const commitsButtonRef = useRef<HTMLButtonElement | null>(null)
  const conflictsButtonRef = useRef<HTMLButtonElement | null>(null)
  const workbenchPopoverRef = useRef<HTMLDivElement | null>(null)

  const providers = useMemo(() => listAgentProviders(), [])
  const taskRepo = repos.find((repo) => repo.id === task.repoId) ?? null
  const latestReview = reviews[0] ?? null
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === launchProfileId) ?? null,
    [profiles, launchProfileId],
  )
  const canRerun = taskRuns.length > 0
  const launchBusy = isLaunchingTask || isRerunningTask
  const showGateStrip = task.status === 'reviewing'
  const profileId = selectedProfile?.id ?? defaultProfileId ?? null
  const mergePrimary = Boolean(task.status === 'accepted' && taskRepo && task.branchName)
  const commitLines = useMemo(
    () => commitView?.output.split('\n').map((line) => line.trim()).filter(Boolean) ?? [],
    [commitView?.output],
  )
  const conflictCount = conflictView?.files.length ?? 0
  const showConflictBadge = Boolean(conflictView?.hasConflicts)
  const workbenchLayoutClass = activityCollapsed
    ? `${styles['implementation-workbench']} ${styles['activity-collapsed']}`
    : styles['implementation-workbench']

  const closeLaunchMenu = useCallback(() => {
    setLaunchMenuOpen(false)
  }, [])

  const closeWorkbenchPopover = useCallback(() => {
    setWorkbenchPopover(null)
  }, [])

  const updateLaunchMenuPosition = useCallback(() => {
    const button = launchButtonRef.current
    if (!button) return
    const buttonRect = button.getBoundingClientRect()
    const menuWidth = 260
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8)
    setLaunchMenuPosition({
      top: buttonRect.bottom + 6,
      left: Math.max(8, Math.min(buttonRect.left, maxLeft)),
    })
  }, [])

  const updateWorkbenchPopoverPosition = useCallback((kind: 'commits' | 'conflicts') => {
    const button = kind === 'commits' ? commitsButtonRef.current : conflictsButtonRef.current
    if (!button) return
    const buttonRect = button.getBoundingClientRect()
    const menuWidth = 420
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8)
    setWorkbenchPopoverPosition({
      top: buttonRect.bottom + 6,
      left: Math.max(8, Math.min(buttonRect.right - menuWidth, maxLeft)),
    })
  }, [])

  useEffect(() => {
    setLaunchProvider(defaultProvider)
    setLaunchProfileId(defaultProfileId ?? profiles[0]?.id ?? null)
    setLaunchMenuOpen(false)
    setReviewFeedback('')
    setShowChangeRequest(false)
    setWorkbenchPopover(null)
  }, [task.id, defaultProvider, defaultProfileId, profiles])

  useEffect(() => {
    if (!launchMenuOpen) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        !launchButtonRef.current?.contains(target) &&
        !launchMenuRef.current?.contains(target)
      ) {
        closeLaunchMenu()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [closeLaunchMenu, launchMenuOpen])

  useEffect(() => {
    if (!workbenchPopover) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (
        !commitsButtonRef.current?.contains(target) &&
        !conflictsButtonRef.current?.contains(target) &&
        !workbenchPopoverRef.current?.contains(target)
      ) {
        closeWorkbenchPopover()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [closeWorkbenchPopover, workbenchPopover])

  useEffect(() => {
    if (!launchMenuOpen) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeLaunchMenu()
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => window.removeEventListener('keydown', handleKeydown, true)
  }, [closeLaunchMenu, launchMenuOpen])

  useEffect(() => {
    if (!workbenchPopover) return

    function handleKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closeWorkbenchPopover()
    }

    window.addEventListener('keydown', handleKeydown, true)
    return () => window.removeEventListener('keydown', handleKeydown, true)
  }, [closeWorkbenchPopover, workbenchPopover])

  useLayoutEffect(() => {
    if (!launchMenuOpen) {
      setLaunchMenuPosition(null)
      return
    }

    updateLaunchMenuPosition()
    const handle = () => updateLaunchMenuPosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [launchMenuOpen, updateLaunchMenuPosition])

  useLayoutEffect(() => {
    if (!workbenchPopover) {
      setWorkbenchPopoverPosition(null)
      return
    }

    updateWorkbenchPopoverPosition(workbenchPopover)
    const handle = () => updateWorkbenchPopoverPosition(workbenchPopover)
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [updateWorkbenchPopoverPosition, workbenchPopover])

  const diffViewQuery = useQuery<TaskDiffView>({
    queryKey: ['task-diff', task.id, diffType],
    queryFn: () => window.effortless.getTaskDiff(task.id, diffType),
    enabled: Boolean(task.repoId) && Boolean(task.branchName),
  })
  const diffView = diffViewQuery.data ?? null
  const diffFiles = useMemo<FileData[]>(() => {
    if (diffView?.error || !diffView?.output) {
      return []
    }

    try {
      return parseDiff(normalizeDiffOutput(diffView.output))
    } catch {
      return []
    }
  }, [diffView?.error, diffView?.output])

  const fileEntries = useMemo(() => {
    return diffFiles.map((file) => {
      const path = resolveDiffFilePath(file)
      const added = file.hunks.reduce(
        (count, hunk) =>
          count + hunk.changes.filter((change) => change.type === 'insert').length,
        0,
      )
      const removed = file.hunks.reduce(
        (count, hunk) =>
          count + hunk.changes.filter((change) => change.type === 'delete').length,
        0,
      )

      return { file, path, added, removed }
    })
  }, [diffFiles])

  useEffect(() => {
    if (fileEntries.length === 0) {
      setActiveFilePath(null)
      return
    }

    setActiveFilePath((current) => {
      if (current && fileEntries.some((entry) => entry.path === current)) {
        return current
      }
      return fileEntries[0].path
    })
  }, [fileEntries])

  const activeFileEntry = useMemo(() => {
    if (!activeFilePath) {
      return fileEntries[0] ?? null
    }
    return fileEntries.find((entry) => entry.path === activeFilePath) ?? fileEntries[0] ?? null
  }, [activeFilePath, fileEntries])

  const gateSummary = latestReview
    ? `${latestReview.verdict}${latestReview.summary ? ` — ${latestReview.summary}` : ''}`
    : 'waiting for review'

  return (
    <div className={styles['task-page']}>
      <header className={styles['task-page-header']}>
        <div className={styles['task-page-header-top']}>
          <h3>{task.title}</h3>
        </div>

        <div className={styles['expanded-meta']}>
          <span className="meta-line">
            <Ref value={task.shortRef} /> · <Stamp label={task.status} tone={statusTone(task.status)} /> ·{' '}
            {taskRepo?.name ?? 'no repo'} · {task.branchName ?? 'no branch'} ·{' '}
            <span title={task.worktreePath ?? 'no worktree yet'}>
              {task.worktreePath ? task.worktreePath.split(/[\\/]/).pop() : 'no worktree yet'}
            </span>
            {taskRuns.slice(0, 4).map((run) => {
              const badge = resolveRunBadgeLabel(run, liveSessionIds, providerLiveRunIds) ?? run.status
              return (
                <span key={run.id}>
                  {' · '}
                  <Ref value={run.shortRef} /> <Stamp label={badge} tone={statusTone(badge)} compact />
                </span>
              )
            })}
          </span>
        </div>

        {task.description ? (
          <p className={styles['task-description']}>{task.description}</p>
        ) : null}

        <div className={styles['task-split-row']}>
          <div ref={launchButtonRef} className={styles['task-split-action']}>
            {mergePrimary ? (
              <button
                type="button"
                className={styles['task-split-primary']}
                title="merge task branch"
                onClick={() => onMergeTask(task.id)}
                disabled={isMergingTask}
              >
                <span>{isMergingTask ? 'merging' : 'merge'}</span>
              </button>
            ) : (
              <button
                type="button"
                className={styles['task-split-primary']}
                title="send task context to the main effort terminal"
                onClick={() => onWorkOnTask({ task, provider: launchProvider, profileId })}
                disabled={launchBusy}
              >
                <Send size={14} aria-hidden="true" />
                <span>{launchBusy ? 'sending' : 'work on this'}</span>
              </button>
            )}
            <button
              type="button"
              className={styles['task-split-chevron']}
              aria-label="task actions"
              aria-expanded={launchMenuOpen}
              title="task actions"
              onClick={() => setLaunchMenuOpen((open) => !open)}
            >
              <ChevronDown size={13} aria-hidden="true" />
            </button>
          </div>
          {launchMenuOpen && launchMenuPosition
            ? createPortal(
                <div
                  ref={launchMenuRef}
                  className={styles['task-action-menu']}
                  role="menu"
                  style={{ top: launchMenuPosition.top, left: launchMenuPosition.left }}
                >
                  <div className={styles['task-action-menu-fields']}>
                    <label className={styles['task-action-menu-field']}>
                      <span>provider</span>
                      <select
                        aria-label="task launch provider"
                        value={launchProvider}
                        onChange={(event) => setLaunchProvider(event.target.value as AgentProvider)}
                      >
                        {providers.map((provider) => (
                          <option key={provider.key} value={provider.key}>{provider.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles['task-action-menu-field']}>
                      <span>profile</span>
                      <select
                        aria-label="task launch profile"
                        value={launchProfileId == null ? '' : String(launchProfileId)}
                        onChange={(event) => setLaunchProfileId(event.target.value ? Number(event.target.value) : null)}
                        disabled={profiles.length === 0}
                      >
                        {profiles.map((profile) => (
                          <option key={profile.id} value={profile.id}>{profile.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {mainRunLive ? (
                    <p className={styles['task-action-menu-hint']}>
                      main is live — work on this sends context into the current session
                    </p>
                  ) : null}
                  <div className={styles['task-action-menu-separator']} />
                  <div className={styles['task-action-menu-section']}>
                    {mergePrimary ? (
                      <button
                        type="button"
                        className={styles['task-action-menu-item']}
                        role="menuitem"
                        onClick={() => {
                          onWorkOnTask({ task, provider: launchProvider, profileId })
                          closeLaunchMenu()
                        }}
                        disabled={launchBusy}
                      >
                        <Send size={13} aria-hidden="true" />
                        <span>{launchBusy ? 'sending' : 'work on this'}</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles['task-action-menu-item']}
                      role="menuitem"
                      onClick={() => {
                        onStartTaskRun({ task, provider: launchProvider, profileId })
                        closeLaunchMenu()
                      }}
                      disabled={launchBusy || profiles.length === 0}
                    >
                      <Play size={13} aria-hidden="true" />
                      <span>start task run</span>
                    </button>
                    {canRerun ? (
                      <button
                        type="button"
                        className={styles['task-action-menu-item']}
                        role="menuitem"
                        onClick={() => {
                          onRerunTaskRun({ task, provider: launchProvider, profileId })
                          closeLaunchMenu()
                        }}
                        disabled={launchBusy || profiles.length === 0}
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        <span>{isRerunningTask ? 'rerunning' : 'rerun'}</span>
                      </button>
                    ) : null}
                    {!mergePrimary ? (
                      <button
                        type="button"
                        className={styles['task-action-menu-item']}
                        role="menuitem"
                        title={
                          task.status === 'accepted' && taskRepo && task.branchName
                            ? 'merge task branch'
                            : 'merge is available once the task is accepted'
                        }
                        onClick={() => {
                          onMergeTask(task.id)
                          closeLaunchMenu()
                        }}
                        disabled={isMergingTask || task.status !== 'accepted' || !taskRepo || !task.branchName}
                      >
                        <span>{isMergingTask ? 'merging' : 'merge'}</span>
                      </button>
                    ) : null}
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>
      </header>

      <div className={styles['task-page-body']}>
        {showGateStrip ? (
          <div className={styles['gate-strip']}>
            <Stamp label="awaiting verdict" tone="gate" />
            <p className={styles['gate-strip-summary']}>{gateSummary}</p>
            {latestReview ? (
              <div className={styles['gate-strip-actions']}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => onApplyReview(latestReview.id)}
                  disabled={isApplyingReview}
                >
                  apply verdict
                </button>
                <button
                  type="button"
                  onClick={() => setShowChangeRequest((open) => !open)}
                  disabled={isRequestingReviewChanges}
                >
                  request changes
                </button>
              </div>
            ) : null}
            {showChangeRequest && latestReview ? (
              <form
                className={styles['gate-change-request']}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (reviewFeedback.trim()) {
                    onRequestReviewChanges({ reviewId: latestReview.id, body: reviewFeedback })
                  }
                }}
              >
                <textarea
                  aria-label="review feedback"
                  value={reviewFeedback}
                  onChange={(event) => setReviewFeedback(event.target.value)}
                  rows={4}
                  placeholder="what should change before this ships?"
                />
                <button type="submit" className={styles.primary} disabled={isRequestingReviewChanges || !reviewFeedback.trim()}>
                  submit changes request
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        <section className={styles['implementation-section']}>
          <div className={styles['implementation-toolbar']}>
            <div className={styles['implementation-switchers']}>
              <PillSwitcher
                ariaLabel="implementation diff type"
                options={[
                  { id: 'uncommitted', label: 'uncommitted' },
                  { id: 'branch', label: 'branch' },
                  { id: 'combined', label: 'combined' },
                ]}
                value={diffType}
                onChange={setDiffType}
              />
              <PillSwitcher
                ariaLabel="implementation diff view type"
                options={[
                  { id: 'unified', label: 'unified' },
                  { id: 'split', label: 'split' },
                ]}
                value={diffViewType}
                onChange={setDiffViewType}
              />
            </div>

            <div className={styles['implementation-toolbar-actions']}>
              <button
                ref={commitsButtonRef}
                type="button"
                className={`${styles['workbench-chip']} ${commitLines.length === 0 ? styles.muted : ''}`}
                title={commitView?.error ? firstLine(commitView.error) : undefined}
                disabled={commitLines.length === 0}
                onClick={() => {
                  if (commitLines.length === 0) return
                  setWorkbenchPopover((current) => current === 'commits' ? null : 'commits')
                }}
              >
                {commitView?.error ? 'commits' : commitLines.length > 0 ? `${commitLines.length} commits` : 'no commits'}
              </button>
              {showConflictBadge ? (
                <button
                  ref={conflictsButtonRef}
                  type="button"
                  className={`${styles['workbench-chip']} ${styles.warning}`}
                  onClick={() => {
                    setWorkbenchPopover((current) => current === 'conflicts' ? null : 'conflicts')
                  }}
                >
                  {conflictCount > 0 ? `${conflictCount} conflicts` : 'conflicts'}
                </button>
              ) : null}
              {latestBuild ? (
                <span className="meta-line">
                  <Ref value={latestBuild.shortRef} />{' '}
                  <Stamp label={latestBuild.status} tone={statusTone(latestBuild.status)} />
                </span>
              ) : (
                <span className={styles['implementation-build-empty']}>no builds yet</span>
              )}
              <button
                type="button"
                className={styles['implementation-build-action']}
                title="run build"
                onClick={() => onRunBuild(task.id)}
                disabled={isRunningBuild || !taskRepo || !task.worktreePath}
              >
                <Play size={13} aria-hidden="true" />
                <span>{isRunningBuild ? 'building' : 'run build'}</span>
              </button>
            </div>
          </div>

          <div className={workbenchLayoutClass}>
            {fileEntries.length > 0 ? (
              <div className={styles['implementation-file-list']}>
                {fileEntries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    className={`${styles['implementation-file']} ${activeFileEntry?.path === entry.path ? styles.active : ''}`}
                    onClick={() => setActiveFilePath(entry.path)}
                  >
                    <div>
                      <strong>{entry.path.split('/').slice(-1)[0] || entry.path}</strong>
                      <span>{entry.path.split('/').slice(0, -1).join('/')}</span>
                    </div>
                    <small>
                      {entry.added > 0 ? `+${entry.added} ` : ''}{entry.removed > 0 ? `-${entry.removed}` : ''}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles['implementation-file-list']}>
                <p className="empty-state">no files</p>
              </div>
            )}
            <div className={styles['implementation-diff-panel']}>
              {diffView?.error ? (
                <GitViewEmpty error={diffView.error} />
              ) : activeFileEntry ? (
                <DiffFile file={activeFileEntry.file} viewType={diffViewType} />
              ) : diffView?.output ? (
                <pre>{diffView.output}</pre>
              ) : (
                <p className="empty-state">no diff output</p>
              )}
            </div>
            <aside className={styles['activity-rail']} aria-label="activity">
              {activityCollapsed ? (
                <button
                  type="button"
                  className={styles['activity-collapse-toggle']}
                  aria-label="expand activity"
                  title="expand activity"
                  onClick={() => setActivityCollapsed(false)}
                >
                  <ChevronsLeft size={14} aria-hidden="true" />
                </button>
              ) : (
                <>
                  <div className={styles['activity-rail-header']}>
                    <h4 className={styles['activity-eyebrow']}>activity</h4>
                    <button
                      type="button"
                      className={styles['activity-collapse-toggle']}
                      aria-label="collapse activity"
                      title="collapse activity"
                      onClick={() => setActivityCollapsed(true)}
                    >
                      <ChevronsRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <div className={styles['activity-rail-body']}>
                    <div className={styles['activity-section']}>
                      <CommentStream comments={comments} />
                    </div>
                    <div className={styles['activity-section']}>
                      <h4 className={styles['activity-eyebrow']}>artifact</h4>
                      <p className={styles['artifact-readout']}>{task.artifact ?? 'no artifact yet'}</p>
                      {reviews.length > 0 ? (
                        <details className={styles['review-history']}>
                          <summary>review history</summary>
                          <ul className={styles['review-history-list']}>
                            {reviews.map((review) => (
                              <li key={review.id} className={styles['review-history-item']}>
                                <span className={styles['review-history-meta']}>
                                  <Ref value={review.shortRef} />{' '}
                                  <Stamp label={review.verdict} tone={statusTone(review.verdict)} compact />
                                </span>
                                {review.summary ? (
                                  <span className={styles['review-history-summary']}>{review.summary}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </aside>
          </div>
          {workbenchPopover && workbenchPopoverPosition
            ? createPortal(
                <div
                  ref={workbenchPopoverRef}
                  className={styles['workbench-popover']}
                  role="dialog"
                  style={{ top: workbenchPopoverPosition.top, left: workbenchPopoverPosition.left }}
                >
                  {workbenchPopover === 'commits' ? (
                    <>
                      <h4>commits</h4>
                      <pre>{commitLines.join('\n')}</pre>
                    </>
                  ) : (
                    <>
                      <h4>conflicts</h4>
                      {conflictView?.files.length ? (
                        <p className={styles['workbench-popover-files']}>{conflictView.files.join(', ')}</p>
                      ) : null}
                      {conflictView?.details ? <pre>{conflictView.details}</pre> : null}
                    </>
                  )}
                </div>,
                document.body,
              )
            : null}
        </section>
      </div>
    </div>
  )
}

function firstLine(text: string): string {
  return text.split('\n')[0] ?? text
}

function errorDetail(text: string): string | null {
  const separator = text.indexOf('\n\n')
  if (separator === -1) return null
  const detail = text.slice(separator + 2).trim()
  return detail || null
}

function GitViewEmpty({ error }: { error: string }) {
  const detail = errorDetail(error)
  return (
    <div className={styles['git-view-empty']}>
      <p className="empty-state">{firstLine(error)}</p>
      {detail ? (
        <details className={styles['git-view-details']}>
          <summary>details</summary>
          <pre>{detail}</pre>
        </details>
      ) : null}
    </div>
  )
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  css: 'css',
  json: 'json',
  py: 'python',
  md: 'markdown',
  sh: 'bash',
  bash: 'bash',
  html: 'html',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  go: 'go',
  rs: 'rust',
  sql: 'sql',
  toml: 'toml',
  graphql: 'graphql',
  gql: 'graphql',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  cs: 'csharp',
  php: 'php',
}

type RefractorHighlighter = {
  highlight: (value: string, language: string) => unknown[]
}

const refractor: RefractorHighlighter = {
  highlight(value, language) {
    const highlighted = rawRefractor.highlight(value, language)
    if (Array.isArray(highlighted)) {
      return highlighted
    }

    if (
      highlighted &&
      typeof highlighted === 'object' &&
      'children' in highlighted &&
      Array.isArray(highlighted.children)
    ) {
      return highlighted.children
    }

    return [{ type: 'text', value }]
  },
}

function languageForPath(filePath: string): string | null {
  const ext = sanitizeDiffPath(filePath).split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_LANG[ext] ?? null
}

const DiffFile = memo(function DiffFile({ file, viewType }: { file: FileData; viewType: ViewType }) {
  const filePath = resolveDiffFilePath(file)
  const lang = languageForPath(filePath)

  const tokens = useMemo(() => {
    if (!lang || file.hunks.length === 0) {
      return undefined
    }

    try {
      return tokenize(file.hunks, { highlight: true, refractor, language: lang })
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Unable to syntax-highlight diff', { filePath, lang, error })
      }
      return undefined
    }
  }, [file.hunks, filePath, lang])

  return (
    <div className={styles['diff-file']}>
      <Diff viewType={viewType} diffType={file.type} hunks={file.hunks} tokens={tokens}>
        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
      </Diff>
    </div>
  )
})

function normalizeDiffOutput(output: string): string {
  return output.replace(/\r\n/g, '\n')
}

function sanitizeDiffPath(filePath: string): string {
  return filePath.replace(/\r/g, '').trim()
}

function resolveDiffFilePath(file: FileData): string {
  const rawPath =
    file.newPath !== '/dev/null' ? (file.newPath ?? '') : (file.oldPath ?? '')
  return sanitizeDiffPath(rawPath)
}
