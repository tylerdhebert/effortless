import { memo, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Diff, Hunk, parseDiff, tokenize } from 'react-diff-view'
import type { FileData, ViewType } from 'react-diff-view'
import 'react-diff-view/style/index.css'
import { refractor as rawRefractor } from 'refractor'
import { Play, SquareTerminal } from 'lucide-react'
import type {
  AgentProfile,
  AgentRun,
  Task,
  Repo,
  Review,
  TaskBuildResult,
  TaskComment,
  TaskDiffView,
  TaskCommitView,
  TaskConflictView,
} from '../../../core/types'
import { CommentStream } from './CommentStream'
import { ReviewHistory } from './ReviewHistory'
import { ReviewRecord } from './ReviewRecord'
import { reviewSummary } from '../../lib/helpers'
import { PillSwitcher } from '../ui/PillSwitcher'
import { ToggleSwitch } from '../ui/ToggleSwitch'
import styles from './TaskDetailPane.module.css'

type TaskDetailPaneProps = {
  task: Task | null
  repos: Repo[]
  reviews: Review[]
  comments: TaskComment[]
  latestBuild: TaskBuildResult | null
  runs: AgentRun[]
  agentProfiles: AgentProfile[]
  commitView: TaskCommitView | null
  conflictView: TaskConflictView | null
  onRunBuild: (taskId: number) => void
  onPrepareTaskRun: (taskId: number) => void
  onOpenRunFile: (filePath: string) => void
  onMergeTask: (taskId: number) => void
  onApplyReview: (reviewId: number) => void
  onRequestReviewChanges: (input: { reviewId: number; body: string }) => void
  onUpdateTaskRequiresReview: (taskId: number, requiresReview: boolean) => void
  onUpdateTaskReviewRequiresReview: (taskId: number, reviewRequiresReview: boolean) => void
  onUpdateTaskAutoMerge: (taskId: number, autoMerge: boolean) => void
  isRunningBuild: boolean
  isPreparingRun: boolean
  isMergingTask: boolean
  isApplyingReview: boolean
  isRequestingReviewChanges: boolean
}

export function TaskDetailPane({
  task,
  repos,
  reviews,
  comments,
  latestBuild,
  runs,
  agentProfiles,
  commitView,
  conflictView,
  onRunBuild,
  onPrepareTaskRun,
  onOpenRunFile,
  onMergeTask,
  onApplyReview,
  onRequestReviewChanges,
  onUpdateTaskRequiresReview,
  onUpdateTaskReviewRequiresReview,
  onUpdateTaskAutoMerge,
  isRunningBuild,
  isPreparingRun,
  isMergingTask,
  isApplyingReview,
  isRequestingReviewChanges,
}: TaskDetailPaneProps) {
  const [reviewFeedback, setReviewFeedback] = useState('')
  const [surfaceMode, setSurfaceMode] = useState<'meta' | 'work'>('meta')
  const [diffType, setDiffType] = useState<'uncommitted' | 'branch' | 'combined'>('combined')
  const [diffViewType, setDiffViewType] = useState<ViewType>('unified')
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  useEffect(() => {
    setSurfaceMode('meta')
  }, [task?.id])

  const taskRepo = repos.find((repo) => repo.id === (task?.repoId ?? null)) ?? null
  const defaultProfile = agentProfiles[0] ?? null
  const latestReview = reviews[0] ?? null
  const pendingReview = reviews.find((review) => !review.appliedAt) ?? null
  const persistedConflict = parsePersistedConflict(task?.conflictDetails ?? null)
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

  if (!task) {
    return (
      <div className={styles['task-detail-pane']}>
        <p className="empty-state">select a task</p>
      </div>
    )
  }

  return (
    <div className={styles['task-detail-pane']}>
      <div className={styles['task-detail-header']}>
        <div className={styles['task-detail-header-row']}>
          <div className={styles['task-detail-header-copy']}>
            <div className={styles['task-title-row']}>
              <h3>{task.title}</h3>
              <ToggleSwitch
                label="human approval req"
                checked={task.requiresReview}
                onChange={(checked) => onUpdateTaskRequiresReview(task.id, checked)}
              />
            </div>
            <div className={styles['expanded-meta']}>
              <div className={styles['chip-group']}>
                <small>ref</small>
                <span>{task.shortRef}</span>
              </div>
              <div className={styles['chip-group']}>
                <small>status</small>
                <span>{task.status}</span>
              </div>
              {task.ownerAgentId ? (
                <div className={styles['chip-group']}>
                  <small>agent</small>
                  <span>{task.ownerAgentId}</span>
                </div>
              ) : null}
              <div className={styles['chip-group']}>
                <small>repo</small>
                <span>{taskRepo?.name ?? 'no repo'}</span>
              </div>
              <div className={styles['chip-group']}>
                <small>branch</small>
                <span>{task.branchName ?? 'no branch'}</span>
              </div>
              <div className={styles['chip-group']}>
                <small>worktree</small>
                <span
                  className={styles['worktree-chip']}
                  title={task.worktreePath ?? 'no worktree yet'}
                >
                  {task.worktreePath ?? 'no worktree yet'}
                </span>
              </div>
            </div>
          </div>
          <div className={styles['task-header-controls']}>
            <PillSwitcher
              ariaLabel="task detail mode"
              options={[
                { id: 'meta', label: 'meta' },
                { id: 'work', label: 'work' },
              ]}
              value={surfaceMode}
              onChange={setSurfaceMode}
            />
            <button
              type="button"
              className={styles['task-header-action']}
              title={taskRepo ? 'prepare agent run' : 'task needs a repo before preparing a run'}
              onClick={() => onPrepareTaskRun(task.id)}
              disabled={isPreparingRun || !taskRepo}
            >
              <SquareTerminal size={14} aria-hidden="true" />
              <span>prepare run</span>
            </button>
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
      </div>

      {surfaceMode === 'meta' ? (
        <>
          <section className={styles['task-detail-section']}>
            <h4>description</h4>
            <div className={styles['task-readout']}>
              <p>{task.description}</p>
            </div>
          </section>

          <section className={styles['task-detail-section']}>
            <h4>comments</h4>
            <CommentStream comments={comments} />
          </section>

          <section className={styles['task-detail-section']}>
            <div className={styles['run-section-header']}>
              <h4>runs</h4>
              <span>{runs.length} prepared</span>
            </div>
            <div className={styles['run-profile-summary']}>
              <span>default profile</span>
              <strong>{defaultProfile ? `${defaultProfile.shortRef} ${defaultProfile.name}` : 'none'}</strong>
            </div>
            {runs.length > 0 ? (
              <div className={styles['run-list']}>
                {runs.map((run) => (
                  <article key={run.id} className={styles['run-row']}>
                    <div className={styles['run-row-main']}>
                      <strong>{run.shortRef}</strong>
                      <span>{run.status} · {run.purpose} · {run.label}</span>
                    </div>
                    <div className={styles['run-row-paths']}>
                      <span title={run.cwd}>cwd {run.cwd}</span>
                      <span title={run.contextPath}>context {run.contextPath}</span>
                    </div>
                    <div className={styles['run-row-actions']}>
                      <button type="button" onClick={() => onOpenRunFile(run.contextPath)}>
                        context
                      </button>
                      <button type="button" onClick={() => onOpenRunFile(run.bootstrapPath)}>
                        bootstrap
                      </button>
                      <button type="button" onClick={() => onOpenRunFile(run.transcriptPath)}>
                        transcript
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">no runs prepared</p>
            )}
          </section>

          <div className={styles['task-detail-supporting-grid']}>
            <section className={styles['task-detail-section']}>
              <h4>handoff</h4>
              <div className={styles['task-readout']}>
                <p>{task.handoffSummary ?? 'no handoff yet'}</p>
              </div>
            </section>

            <section className={styles['task-detail-section']}>
              <h4>artifact</h4>
              <div className={styles['task-readout']}>
                <p>{task.artifact ?? 'no artifact yet'}</p>
              </div>
            </section>
          </div>

          <section className={styles['task-detail-section']}>
            <div className={styles['review-section-header']}>
              <h4>review</h4>
              <ToggleSwitch
                label="human approval req"
                checked={task.reviewRequiresReview}
                onChange={(checked) => onUpdateTaskReviewRequiresReview(task.id, checked)}
              />
            </div>
            <p className={styles['task-review-summary']}>{reviewSummary(task, latestReview)}</p>

            {pendingReview ? (
              <ReviewRecord
                review={pendingReview}
                dateLabel={pendingReview.authorAgentId ?? pendingReview.createdAt}
              >
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
          <section className={styles['task-detail-section']}>
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

          <section className={styles['task-detail-section']}>
            <h4>implementation</h4>
            <div className={styles['implementation-controls']}>
              <ToggleSwitch
                label="auto merge"
                checked={task.autoMerge}
                onChange={(checked) => onUpdateTaskAutoMerge(task.id, checked)}
              />
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
              <p className="empty-state">no diff output</p>
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
                  {conflictView || task.conflictedAt ? (
                    <small>{conflictView?.hasConflicts || task.conflictedAt ? 'conflicts found' : 'merge is clean'}</small>
                  ) : null}
                </div>
                {conflictView?.hasConflicts || task.conflictedAt ? (
                  <div className={styles['conflict-block']}>
                    {(conflictView?.files.length ? conflictView.files : persistedConflict?.files ?? []).length > 0 ? (
                      <p>{(conflictView?.files.length ? conflictView.files : persistedConflict?.files ?? []).join(', ')}</p>
                    ) : null}
                    {conflictView?.details ?? persistedConflict?.output ? <pre>{conflictView?.details ?? persistedConflict?.output}</pre> : null}
                  </div>
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
  }, [file.hunks, lang])

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

function parsePersistedConflict(value: string | null): { output: string; files: string[] } | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { output?: unknown; files?: unknown }
    return {
      output: typeof parsed.output === 'string' ? parsed.output : value,
      files: Array.isArray(parsed.files) ? parsed.files.filter((file): file is string => typeof file === 'string') : [],
    }
  } catch {
    return { output: value, files: [] }
  }
}
