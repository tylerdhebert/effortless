import { useEffect, useMemo, useState } from 'react'
import { Play, RotateCcw, Send } from 'lucide-react'
import type {
  AgentProfile,
  AgentProvider,
  AgentRun,
  Task,
  ActivityEvent,
  Repo,
  Review,
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
  workView: boolean
  onWorkViewChange: (next: boolean) => void
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
  workView,
  onWorkViewChange,
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
  const [launchTarget, setLaunchTarget] = useState<'main' | 'task'>('main')
  const [launchProvider, setLaunchProvider] = useState<AgentProvider>(defaultProvider)
  const [launchProfileId, setLaunchProfileId] = useState<number | null>(defaultProfileId)
  const providers = useMemo(() => listAgentProviders(), [])

  useEffect(() => {
    setLaunchTarget('main')
    setLaunchProvider(defaultProvider)
    setLaunchProfileId(defaultProfileId ?? profiles[0]?.id ?? null)
  }, [task?.id, defaultProvider, defaultProfileId, profiles])

  const taskRepo = repos.find((repo) => repo.id === (task?.repoId ?? null)) ?? null
  const latestReview = reviews[0] ?? null
  const pendingReview = reviews[0] ?? null
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
            value={workView ? 'work' : 'meta'}
            onChange={(id) => onWorkViewChange(id === 'work')}
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
    </div>
  )
}
