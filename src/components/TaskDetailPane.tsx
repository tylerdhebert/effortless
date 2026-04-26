import { useState, useEffect, type FormEvent } from 'react'
import type { Task, Repo, Review, TaskBuildResult, TaskComment } from '../../core/types'
import { CommentStream } from './CommentStream'
import { ReviewHistory } from './ReviewHistory'
import { reviewSummary } from './helpers'

type TaskDetailPaneProps = {
  task: Task | null
  repos: Repo[]
  reviews: Review[]
  comments: TaskComment[]
  latestBuild: TaskBuildResult | null
  onReadyTask: (taskId: number) => void
  onUpdateTaskDetails: (input: { taskId: number; repoId?: number | null; branchName?: string | null; baseBranch?: string | null; handoffSummary?: string | null; artifact?: string | null }) => void
  onEnsureTaskWorktree: (taskId: number) => void
  onRunBuild: (taskId: number) => void
  onSubmitReview: (input: { taskId: number; verdict: 'approve' | 'request-changes'; body: string; authorAgentId: string | null }) => void
  onApplyReview: (reviewId: number) => void
  onRequestReviewChanges: (input: { reviewId: number; body: string }) => void
  isReadyingTask: boolean
  isUpdatingTask: boolean
  isEnsuringWorktree: boolean
  isRunningBuild: boolean
  isSubmittingReview: boolean
  isApplyingReview: boolean
  isRequestingReviewChanges: boolean
}

export function TaskDetailPane({
  task,
  repos,
  reviews,
  comments,
  latestBuild,
  onReadyTask,
  onUpdateTaskDetails,
  onEnsureTaskWorktree,
  onRunBuild,
  onSubmitReview,
  onApplyReview,
  onRequestReviewChanges,
  isReadyingTask,
  isUpdatingTask,
  isEnsuringWorktree,
  isRunningBuild,
  isSubmittingReview,
  isApplyingReview,
  isRequestingReviewChanges,
}: TaskDetailPaneProps) {
  const [taskRepoId, setTaskRepoId] = useState('')
  const [taskBranchName, setTaskBranchName] = useState('')
  const [taskBaseBranch, setTaskBaseBranch] = useState('')
  const [taskHandoffSummary, setTaskHandoffSummary] = useState('')
  const [taskArtifact, setTaskArtifact] = useState('')
  const [reviewVerdict, setReviewVerdict] = useState<'approve' | 'request-changes'>('approve')
  const [reviewBody, setReviewBody] = useState('')
  const [reviewAgentId, setReviewAgentId] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')

  const taskRepo = repos.find((repo) => repo.id === (task?.repoId ?? null)) ?? null
  const latestReview = reviews[0] ?? null
  const pendingReview = reviews.find((review) => !review.appliedAt) ?? null

  useEffect(() => {
    setReviewVerdict('approve')
    setReviewBody('')
    setReviewAgentId('')
    setReviewFeedback('')
    setTaskRepoId(task?.repoId ? String(task.repoId) : '')
    setTaskBranchName(task?.branchName ?? '')
    setTaskBaseBranch(task?.baseBranch ?? '')
    setTaskHandoffSummary(task?.handoffSummary ?? '')
    setTaskArtifact(task?.artifact ?? '')
  }, [task?.id])

  if (!task) {
    return (
      <div className="task-detail-pane">
        <p className="empty-state">select a task</p>
      </div>
    )
  }

  return (
    <div className="task-detail-pane">
      <div className="task-detail-header">
        <h3>{task.title}</h3>
        <div className="expanded-meta">
          <span>{task.shortRef}</span>
          <span>{task.status}</span>
          <span>{taskRepo?.name ?? 'no repo'}</span>
          <span>{task.branchName ?? 'no branch'}</span>
        </div>
      </div>

      <section className="task-detail-section">
        <h4>description</h4>
        <p>{task.description}</p>
      </section>

      <section className="task-detail-section">
        <h4>repo</h4>
        <form className="task-detail-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          onUpdateTaskDetails({
            taskId: task.id,
            repoId: taskRepoId ? Number(taskRepoId) : null,
            branchName: taskBranchName || null,
            baseBranch: taskBaseBranch || null,
            handoffSummary: taskHandoffSummary || null,
            artifact: taskArtifact || null,
          })
        }}>
          <select
            aria-label="task repo"
            value={taskRepoId}
            onChange={(event) => setTaskRepoId(event.target.value)}
          >
            <option value="">none</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
              </option>
            ))}
          </select>
          <div className="task-detail-grid">
            <input
              aria-label="task branch"
              placeholder="branch"
              value={taskBranchName}
              onChange={(event) => setTaskBranchName(event.target.value)}
            />
            <input
              aria-label="task base branch"
              placeholder="base branch"
              value={taskBaseBranch}
              onChange={(event) => setTaskBaseBranch(event.target.value)}
            />
          </div>
          {taskRepo ? (
            <div className="task-repo-meta">
              <span>{taskRepo.path}</span>
              <span>{taskRepo.buildCommand ?? 'no build command'}</span>
            </div>
          ) : null}
          <button type="submit" disabled={isUpdatingTask}>
            save details
          </button>
        </form>
      </section>

      <section className="task-detail-section">
        <h4>workspace</h4>
        <div className="task-repo-meta">
          <span>{task.worktreePath ?? 'no worktree yet'}</span>
          <span>{task.baseBranch ?? taskRepo?.baseBranch ?? 'no base branch'}</span>
        </div>
        <div className="task-action-row">
          <button
            type="button"
            onClick={() => onEnsureTaskWorktree(task.id)}
            disabled={isEnsuringWorktree || !taskRepo}
          >
            {task.worktreePath ? 'refresh worktree' : 'create worktree'}
          </button>
          <button
            type="button"
            onClick={() => onRunBuild(task.id)}
            disabled={isRunningBuild || !taskRepo || !task.worktreePath}
          >
            run build
          </button>
        </div>
      </section>

      <section className="task-detail-section">
        <h4>handoff</h4>
        <textarea
          aria-label="task handoff"
          value={taskHandoffSummary}
          onChange={(event) => setTaskHandoffSummary(event.target.value)}
          rows={4}
        />
      </section>

      <section className="task-detail-section">
        <h4>artifact</h4>
        <textarea
          aria-label="task artifact"
          value={taskArtifact}
          onChange={(event) => setTaskArtifact(event.target.value)}
          rows={5}
        />
      </section>

      <section className="task-detail-section">
        <h4>build</h4>
        {latestBuild ? (
          <div className="build-result">
            <div className="expanded-meta">
              <span>{latestBuild.shortRef}</span>
              <span>{latestBuild.status}</span>
            </div>
            <pre>{latestBuild.output || 'no output'}</pre>
          </div>
        ) : (
          <p>no builds yet</p>
        )}
      </section>

      <section className="task-detail-section">
        <h4>review</h4>
        <p>{reviewSummary(task, latestReview)}</p>

        {task.status !== 'reviewing' && task.status !== 'accepted' && task.status !== 'merged' ? (
          <div className="task-action-row">
            <button type="button" onClick={() => onReadyTask(task.id)} disabled={isReadyingTask}>
              ready for review
            </button>
          </div>
        ) : null}

        <form
          className="review-compose"
          onSubmit={(event) => {
            event.preventDefault()
            if (reviewBody.trim()) {
              onSubmitReview({
                taskId: task.id,
                verdict: reviewVerdict,
                body: reviewBody,
                authorAgentId: reviewAgentId || null,
              })
            }
          }}
        >
          <div className="review-compose-row">
            <select
              aria-label="review verdict"
              value={reviewVerdict}
              onChange={(event) => setReviewVerdict(event.target.value as 'approve' | 'request-changes')}
            >
              <option value="approve">approve</option>
              <option value="request-changes">request changes</option>
            </select>
            <input
              aria-label="review agent id"
              value={reviewAgentId}
              onChange={(event) => setReviewAgentId(event.target.value)}
              placeholder="agent"
            />
          </div>
          <textarea
            aria-label="review body"
            value={reviewBody}
            onChange={(event) => setReviewBody(event.target.value)}
            rows={4}
          />
          <button type="submit" disabled={isSubmittingReview}>
            submit review
          </button>
        </form>

        {pendingReview ? (
          <article className="review-record pending">
            <div className="review-record-header">
              <div>
                <span>{pendingReview.shortRef}</span>
                <strong>{pendingReview.verdict}</strong>
              </div>
              <small>{pendingReview.authorAgentId ?? pendingReview.createdAt}</small>
            </div>
            <p>{pendingReview.body}</p>

            <div className="task-action-row">
              <button
                type="button"
                onClick={() => onApplyReview(pendingReview.id)}
                disabled={isApplyingReview}
              >
                apply verdict
              </button>
            </div>

            <form
              className="change-request"
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
          </article>
        ) : null}

        <ReviewHistory reviews={reviews} />
      </section>

      <section className="task-detail-section">
        <h4>comments</h4>
        <CommentStream comments={comments} />
      </section>
    </div>
  )
}