import { memo, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Diff, Hunk, parseDiff, tokenize } from 'react-diff-view'
import type { FileData, ViewType } from 'react-diff-view'
import 'react-diff-view/style/index.css'
import { refractor as rawRefractor } from 'refractor'
import { X } from 'lucide-react'
import type {
  AgentRun,
  Repo,
  Task,
  TaskBuildResult,
  TaskDiffView,
  TaskCommitView,
  TaskConflictView,
} from '../../../core/types'
import { resolveRunBadgeLabel } from '../../lib/runStatus'
import { PillSwitcher } from '../ui/PillSwitcher'
import styles from './TaskWorkPane.module.css'

type TaskWorkPaneProps = {
  task: Task
  repos: Repo[]
  taskRuns?: AgentRun[]
  liveSessionIds?: Set<number>
  providerLiveRunIds?: Set<number>
  latestBuild: TaskBuildResult | null
  commitView: TaskCommitView | null
  conflictView: TaskConflictView | null
  onClose: () => void
}

export function TaskWorkPane({
  task,
  repos,
  taskRuns = [],
  liveSessionIds = new Set<number>(),
  providerLiveRunIds = new Set<number>(),
  latestBuild,
  commitView,
  conflictView,
  onClose,
}: TaskWorkPaneProps) {
  const [diffType, setDiffType] = useState<'uncommitted' | 'branch' | 'combined'>('combined')
  const [diffViewType, setDiffViewType] = useState<ViewType>('unified')
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  const taskRepo = repos.find((repo) => repo.id === task.repoId) ?? null

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

  return (
    <div className={styles['work-pane']}>
      <header className={styles['work-pane-header']}>
        <div className={styles['work-pane-header-top']}>
          <h3>{task.title}</h3>
          <button
            type="button"
            className="icon-btn"
            aria-label="close work view"
            title="close"
            onClick={onClose}
          >
            <X size={14} />
          </button>
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
      </header>

      <section className="effort-zone-section">
        <h4>build</h4>
        {latestBuild ? (
          <div className={styles['build-result']}>
            <div className={styles['expanded-meta']}>
              <span className="meta-line">
                {latestBuild.shortRef} · {latestBuild.status}
              </span>
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

        <div className={styles['implementation-grid']}>
          <article className={styles['implementation-card']}>
            <div className={styles['implementation-card-header']}>
              <strong>commits</strong>
            </div>
            {commitView?.error ? (
              <GitViewEmpty error={commitView.error} />
            ) : commitView?.output ? (
              <pre>{commitView.output}</pre>
            ) : (
              <p>no commits ahead of base</p>
            )}
          </article>

          <article className={styles['implementation-card']}>
            <div className={styles['implementation-card-header']}>
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
          </article>
        </div>
      </section>
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
