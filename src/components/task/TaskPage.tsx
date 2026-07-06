import { memo, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Diff, Hunk, parseDiff, tokenize } from 'react-diff-view'
import type { FileData, ViewType } from 'react-diff-view'
import 'react-diff-view/style/index.css'
import { refractor as rawRefractor } from 'refractor'
import { Play, RotateCcw, Send, X } from 'lucide-react'
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
  onClose: () => void
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
  onClose,
}: TaskPageProps) {
  const [diffType, setDiffType] = useState<'uncommitted' | 'branch' | 'combined'>('combined')
  const [diffViewType, setDiffViewType] = useState<ViewType>('unified')
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [showChangeRequest, setShowChangeRequest] = useState(false)
  const [launchTarget, setLaunchTarget] = useState<'main' | 'task'>('main')
  const [launchProvider, setLaunchProvider] = useState<AgentProvider>(defaultProvider)
  const [launchProfileId, setLaunchProfileId] = useState<number | null>(defaultProfileId)

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

  useEffect(() => {
    setLaunchTarget('main')
    setLaunchProvider(defaultProvider)
    setLaunchProfileId(defaultProfileId ?? profiles[0]?.id ?? null)
    setReviewFeedback('')
    setShowChangeRequest(false)
  }, [task.id, defaultProvider, defaultProfileId, profiles])

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
          <button
            type="button"
            className="icon-btn"
            aria-label="close task page"
            title="close"
            onClick={onClose}
          >
            <X size={14} />
          </button>
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
              className={`${styles['task-header-action']} ${launchTarget === 'main' ? styles.primary : ''}`}
              title="send task context to the main effort terminal"
              onClick={() => onWorkOnTask({ task, provider: launchProvider, profileId })}
              disabled={launchBusy}
            >
              <Send size={14} aria-hidden="true" />
              <span>{launchBusy && launchTarget === 'main' ? 'sending' : 'work on this'}</span>
            </button>
            <button
              type="button"
              className={`${styles['task-header-action']} ${launchTarget === 'task' ? styles.primary : ''}`}
              title="start a dedicated task terminal run"
              onClick={() => onStartTaskRun({ task, provider: launchProvider, profileId })}
              disabled={launchBusy || profiles.length === 0}
            >
              <Play size={14} aria-hidden="true" />
              <span>{launchBusy && launchTarget === 'task' ? 'starting' : 'start task run'}</span>
            </button>
            {canRerun ? (
              <button
                type="button"
                className={styles['task-header-action']}
                title="prepare a fresh task run with updated context"
                onClick={() => onRerunTaskRun({ task, provider: launchProvider, profileId })}
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
              <span>{isRunningBuild ? 'building' : 'run build'}</span>
            </button>
            <button
              type="button"
              className={styles['task-header-action']}
              title="merge task branch"
              onClick={() => onMergeTask(task.id)}
              disabled={isMergingTask || task.status !== 'accepted' || !taskRepo || !task.branchName}
            >
              <span>{isMergingTask ? 'merging' : 'merge'}</span>
            </button>
          </div>
        </div>
        {launchTarget === 'main' && mainRunLive ? (
          <p className={styles['task-launch-note']}>
            main is already live, so work on this sends context into the current session without changing provider or profile.
          </p>
        ) : null}
      </header>

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
        <div className={styles['implementation-section-header']}>
          <h4 className={styles['implementation-eyebrow']}>implementation</h4>
          <div className={styles['implementation-build-cluster']}>
            {latestBuild ? (
              <span className="meta-line">
                <Ref value={latestBuild.shortRef} />{' '}
                <Stamp label={latestBuild.status} tone={statusTone(latestBuild.status)} />
              </span>
            ) : (
              <span className="meta-line">no builds yet</span>
            )}
            <button
              type="button"
              onClick={() => onRunBuild(task.id)}
              disabled={isRunningBuild || !taskRepo || !task.worktreePath}
            >
              run build
            </button>
          </div>
        </div>

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

        {diffView?.error ? (
          <GitViewEmpty error={diffView.error} />
        ) : fileEntries.length > 0 ? (
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
        ) : diffView?.output ? (
          <pre>{diffView.output}</pre>
        ) : (
          <p className="empty-state">no diff output</p>
        )}
      </section>

      <div className={styles['supporting-grid']}>
        <article className={styles['supporting-card']}>
          <div className={styles['supporting-card-section']}>
            <div className={styles['supporting-card-header']}>
              <strong>commits</strong>
            </div>
            {commitView?.error ? (
              <GitViewEmpty error={commitView.error} />
            ) : commitView?.output ? (
              <pre>{commitView.output}</pre>
            ) : (
              <p>no commits ahead of base</p>
            )}
          </div>

          <div className={styles['supporting-card-section']}>
            <div className={styles['supporting-card-header']}>
              <strong>conflicts</strong>
              {conflictView ? (
                <small>
                  {conflictView.error
                    ? 'merge status unavailable'
                    : conflictView.hasConflicts
                      ? 'conflicts found'
                      : 'merge is clean'}
                </small>
              ) : null}
            </div>
            {conflictView?.error ? (
              <GitViewEmpty error={conflictView.error} />
            ) : conflictView?.hasConflicts ? (
              <div className={styles['conflict-block']}>
                {conflictView.files.length > 0 ? (
                  <p>{conflictView.files.join(', ')}</p>
                ) : null}
                {conflictView.details ? <pre>{conflictView.details}</pre> : null}
              </div>
            ) : (
              <p>no conflicts detected</p>
            )}
          </div>
        </article>

        <article className={styles['supporting-card']}>
          <div className={styles['supporting-card-section']}>
            <div className={styles['supporting-card-header']}>
              <strong>comments</strong>
            </div>
            <CommentStream comments={comments} />
          </div>

          <div className={styles['supporting-card-section']}>
            <div className={styles['supporting-card-header']}>
              <strong>artifact</strong>
            </div>
            <p className={styles['artifact-readout']}>{task.artifact ?? 'no artifact yet'}</p>
          </div>
        </article>
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
