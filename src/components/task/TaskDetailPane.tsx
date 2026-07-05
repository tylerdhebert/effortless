import { memo, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Diff, Hunk, parseDiff, tokenize } from 'react-diff-view'
import type { FileData, ViewType } from 'react-diff-view'
import 'react-diff-view/style/index.css'
import { refractor as rawRefractor } from 'refractor'
import { Play, RotateCcw, Send } from 'lucide-react'
import type {
  AgentProfile,
  AgentProvider,
  AgentRun,
  Task,
  ActivityEvent,
  Repo,
  Review,
  TaskBuildResult,
  TaskDiffView,
  TaskCommitView,
  TaskConflictView,
} from '../../../core/types'
import { resolveRunBadgeLabel } from '../../lib/runStatus'
import { listAgentProviders } from '../../../core/agentProviders'
import { CommentStream } from './CommentStream'
import { ReviewHistory } from './ReviewHistory'
import { ReviewRecord } from './ReviewRecord'
import { reviewSummary } from '../../lib/helpers'
import { PillSwitcher } from '../ui/PillSwitcher'
import styles from './TaskDetailPane.module.css'

type TaskDetailPaneProps = {
  task: Task | null
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

export function TaskDetailPane({
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
}: TaskDetailPaneProps) {
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [surfaceMode, setSurfaceMode] = useState<'meta' | 'work'>('meta')
  const [diffType, setDiffType] = useState<'uncommitted' | 'branch' | 'combined'>('combined')
  const [diffViewType, setDiffViewType] = useState<ViewType>('unified')
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [launchTarget, setLaunchTarget] = useState<'main' | 'task'>('main')
  const [launchProvider, setLaunchProvider] = useState<AgentProvider>(defaultProvider)
  const [launchProfileId, setLaunchProfileId] = useState<number | null>(defaultProfileId)
  const providers = useMemo(() => listAgentProviders(), [])

  useEffect(() => {
    setSurfaceMode('meta')
  }, [task?.id])

  useEffect(() => {
    setLaunchTarget('main')
    setLaunchProvider(defaultProvider)
    setLaunchProfileId(defaultProfileId ?? profiles[0]?.id ?? null)
  }, [task?.id, defaultProvider, defaultProfileId, profiles])

  const taskRepo = repos.find((repo) => repo.id === (task?.repoId ?? null)) ?? null
  const latestReview = reviews[0] ?? null
  const pendingReview = reviews[0] ?? null
  const diffViewQuery = useQuery<TaskDiffView>({
    queryKey: ['task-diff', task?.id ?? null, diffType],
    queryFn: () => {
      if (!task) {
        throw new Error('task is required')
      }
      return window.effortless.getTaskDiff(task.id, diffType)
    },
    enabled: surfaceMode === 'work' && Boolean(task?.repoId) && Boolean(task?.branchName),
  })
  const diffView = diffViewQuery.data ?? null
  const diffFiles = useMemo<FileData[]>(() => {
    if (!diffView?.output) {
      return []
    }

    try {
      return parseDiff(normalizeDiffOutput(diffView.output))
    } catch {
      return []
    }
  }, [diffView?.output])

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
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === launchProfileId) ?? null,
    [profiles, launchProfileId],
  )
  const canRerun = taskRuns.length > 0
  const launchBusy = isLaunchingTask || isRerunningTask

  if (!task) {
    return (
      <div className="effort-zone">
        <p className="empty-state">select a task</p>
      </div>
    )
  }

  return (
    <div className={`effort-zone ${styles['task-detail']}`}>
      <div className={`effort-zone-hero ${styles['task-detail-header']}`}>
        <div className={styles['task-detail-header-top']}>
          <h3>{task.title}</h3>
          <PillSwitcher
            ariaLabel="task detail mode"
            options={[
              { id: 'meta', label: 'meta' },
              { id: 'work', label: 'work' },
            ]}
            value={surfaceMode}
            onChange={setSurfaceMode}
          />
        </div>

        <div className={styles['expanded-meta']}>
          <span className="meta-line">
            {task.shortRef} · {task.status} · {taskRepo?.name ?? 'no repo'} · {task.branchName ?? 'no branch'} ·{' '}
            <span title={task.worktreePath ?? 'no worktree yet'}>
              {task.worktreePath ? task.worktreePath.split(/[\\/]/).pop() : 'no worktree yet'}
            </span>
            {taskRuns.length > 0 ? (
              <>
                {' · '}
                {taskRuns.slice(0, 4).map((run) => {
                  const badge = resolveRunBadgeLabel(run, liveSessionIds, providerLiveRunIds) ?? run.status
                  return `${run.shortRef} ${badge}`
                }).join(' · ')}
              </>
            ) : null}
          </span>
        </div>

        <div className={styles['task-launch-bar']}>
          <div className={styles['task-launch-controls']}>
            <label className={styles['task-launch-field']}>
              <span>terminal</span>
              <select
                aria-label="task launch terminal"
                value={launchTarget}
                onChange={(event) => setLaunchTarget(event.target.value as 'main' | 'task')}
              >
                <option value="main">main effort terminal</option>
                <option value="task">task terminal</option>
              </select>
            </label>
            <label className={styles['task-launch-field']}>
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
            <label className={styles['task-launch-field']}>
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
          <div className={styles['task-header-actions']}>
            <button
              type="button"
              className={styles['task-header-action']}
              title={launchTarget === 'task' ? 'start a dedicated task terminal run' : 'send task context to the main effort terminal'}
              onClick={() => {
                const profileId = selectedProfile?.id ?? defaultProfileId ?? null
                if (launchTarget === 'task') {
                  onStartTaskRun({ task, provider: launchProvider, profileId })
                } else {
                  onWorkOnTask({ task, provider: launchProvider, profileId })
                }
              }}
              disabled={launchBusy || (launchTarget === 'task' && profiles.length === 0)}
            >
              {launchTarget === 'task' ? <Play size={14} aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              <span>
                {launchBusy
                  ? launchTarget === 'task' ? 'starting' : 'sending'
                  : launchTarget === 'task' ? 'start task run' : 'work on this'}
              </span>
            </button>
            {canRerun ? (
              <button
                type="button"
                className={styles['task-header-action']}
                title="prepare a fresh task run with updated context"
                onClick={() => {
                  const profileId = selectedProfile?.id ?? defaultProfileId ?? null
                  onRerunTaskRun({ task, provider: launchProvider, profileId })
                }}
                disabled={launchBusy || profiles.length === 0}
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>{isRerunningTask ? 'rerunning' : 'rerun'}</span>
              </button>
            ) : null}
            <button
              type="button"
              className={styles['task-header-action']}
              title="run build"
              onClick={() => onRunBuild(task.id)}
              disabled={isRunningBuild || !taskRepo || !task.worktreePath}
            >
              <Play size={14} aria-hidden="true" />
              <span>run build</span>
            </button>
            <button
              type="button"
              className={styles['task-header-action']}
              title="merge task branch"
              onClick={() => onMergeTask(task.id)}
              disabled={isMergingTask || task.status !== 'accepted' || !taskRepo || !task.branchName}
            >
              <span>merge</span>
            </button>
          </div>
        </div>
        {launchTarget === 'main' && mainRunLive ? (
          <p className={styles['task-launch-note']}>
            main is already live, so this sends context into the current session without changing provider or profile.
          </p>
        ) : null}
      </div>

      {surfaceMode === 'meta' ? (
        <>
          <section className="effort-zone-section">
            <h4>description</h4>
            <div className="effort-zone-readout">
              <p>{task.description}</p>
            </div>
          </section>

          <section className="effort-zone-section">
            <h4>comments</h4>
            <CommentStream comments={comments} />
          </section>

          <section className="effort-zone-section">
            <h4>artifact</h4>
            <div className="effort-zone-readout">
              <p>{task.artifact ?? 'no artifact yet'}</p>
            </div>
          </section>

          <section className="effort-zone-section">
            <h4>review</h4>
            <p className={styles['task-review-summary']}>{reviewSummary(task, latestReview)}</p>

            {pendingReview ? (
              <ReviewRecord review={pendingReview}>
                <div className={styles['task-action-row']}>
                  <button
                    type="button"
                    onClick={() => onApplyReview(pendingReview.id)}
                    disabled={isApplyingReview}
                  >
                    apply verdict
                  </button>
                </div>

                <form
                  className={styles['change-request']}
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (reviewFeedback.trim()) {
                      onRequestReviewChanges({ reviewId: pendingReview.id, body: reviewFeedback })
                    }
                  }}
                >
                  <textarea
                    aria-label="review feedback"
                    value={reviewFeedback}
                    onChange={(event) => setReviewFeedback(event.target.value)}
                    rows={4}
                  />
                  <button type="submit" disabled={isRequestingReviewChanges}>
                    request review changes
                  </button>
                </form>
              </ReviewRecord>
            ) : null}

            <ReviewHistory reviews={reviews} />
          </section>
        </>
      ) : (
        <>
          <section className="effort-zone-section">
            <h4>build</h4>
            {latestBuild ? (
              <div className={styles['build-result']}>
                <div className={styles['expanded-meta']}>
                  <span>{latestBuild.shortRef}</span>
                  <span>{latestBuild.status}</span>
                </div>
                <pre>{latestBuild.output || 'no output'}</pre>
              </div>
            ) : (
              <p>no builds yet</p>
            )}
          </section>

          <section className="effort-zone-section">
            <h4>implementation</h4>
            <div className={styles['implementation-controls']}>
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

            {fileEntries.length > 0 ? (
              <div className={styles['implementation-layout']}>
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
                <div className={styles['implementation-diff-panel']}>
                  {activeFileEntry ? (
                    <DiffFile file={activeFileEntry.file} viewType={diffViewType} />
                  ) : (
                    <p className="empty-state">select a file to view its diff</p>
                  )}
                </div>
              </div>
            ) : (
              diffView?.output ? <pre>{diffView.output}</pre> : <p className="empty-state">no diff output</p>
            )}

            <div className={styles['implementation-grid']}>
              <article className={styles['implementation-card']}>
                <div className={styles['implementation-card-header']}>
                  <strong>commits</strong>
                </div>
                {commitView?.output ? <pre>{commitView.output}</pre> : <p>no commits ahead of base</p>}
              </article>

              <article className={styles['implementation-card']}>
                <div className={styles['implementation-card-header']}>
                  <strong>conflicts</strong>
                  {conflictView ? (
                    <small>
                      {conflictView.hasConflicts
                        ? 'conflicts found'
                        : conflictView.details
                          ? 'merge status unavailable'
                          : 'merge is clean'}
                    </small>
                  ) : null}
                </div>
                {conflictView?.hasConflicts ? (
                  <div className={styles['conflict-block']}>
                    {conflictView.files.length > 0 ? (
                      <p>{conflictView.files.join(', ')}</p>
                    ) : null}
                    {conflictView.details ? <pre>{conflictView.details}</pre> : null}
                  </div>
                ) : conflictView?.details ? (
                  <pre>{conflictView.details}</pre>
                ) : (
                  <p>no conflicts detected</p>
                )}
              </article>
            </div>
          </section>
        </>
      )}
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
