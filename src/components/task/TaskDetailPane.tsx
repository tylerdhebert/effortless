import { Play } from 'lucide-react'
import { useState } from 'react'
import type { Task, Repo, Review, TaskBuildResult, TaskComment } from '../../../core/types'
import { CommentStream } from './CommentStream'
import { ReviewHistory } from './ReviewHistory'
import { reviewSummary } from '../../lib/helpers'
import styles from './TaskDetailPane.module.css'

type TaskDetailPaneProps = {
  task: Task | null
  repos: Repo[]
  reviews: Review[]
  comments: TaskComment[]
  latestBuild: TaskBuildResult | null
  onRunBuild: (taskId: number) => void
  onApplyReview: (reviewId: number) => void
  onRequestReviewChanges: (input: { reviewId: number; body: string }) => void
  isRunningBuild: boolean
  isApplyingReview: boolean
  isRequestingReviewChanges: boolean
}

export function TaskDetailPane({
  task,
  repos,
  reviews,
  comments,
  latestBuild,
  onRunBuild,
  onApplyReview,
  onRequestReviewChanges,
  isRunningBuild,
  isApplyingReview,
  isRequestingReviewChanges,
}: TaskDetailPaneProps) {
  const [reviewFeedback, setReviewFeedback] = useState('')

  const taskRepo = repos.find((repo) => repo.id === (task?.repoId ?? null)) ?? null
  const latestReview = reviews[0] ?? null
  const pendingReview = reviews.find((review) => !review.appliedAt) ?? null

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
            <h3>{task.title}</h3>
            <div className={styles['expanded-meta']}>
              <div className={styles['chip-group']}>
                <small>ref</small>
                <span>{task.shortRef}</span>
              </div>
              <div className={styles['chip-group']}>
                <small>status</small>
                <span>{task.status}</span>
              </div>
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
        </div>
      </div>

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
        <h4>review</h4>
        <p className={styles['task-review-summary']}>{reviewSummary(task, latestReview)}</p>

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
          </article>
        ) : null}

        <ReviewHistory reviews={reviews} />
      </section>

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
    </div>
  )
}
