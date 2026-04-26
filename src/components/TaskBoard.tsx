import { useState, useEffect, type FormEvent } from 'react'
import type { Task, Repo, Review, TaskBuildResult, TaskComment } from '../../core/types'
import { CommentStream } from './CommentStream'
import { ExpandedCard } from './ExpandedCard'
import { ReviewHistory } from './ReviewHistory'
import { reviewSummary } from './helpers'

type ExpandedCardState = {
  taskId: number
  type: 'task' | 'review'
}

type TaskBoardProps = {
  tasks: Task[]
  repos: Repo[]
  selectedTaskId: number | null
  onSelectTask: (taskId: number) => void
  expandedCard: ExpandedCardState | null
  onSetExpandedCard: (card: ExpandedCardState | null) => void
  comments: TaskComment[]
  reviews: Review[]
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

export function TaskBoard({
  tasks,
  repos,
  selectedTaskId,
  onSelectTask,
  expandedCard,
  onSetExpandedCard,
  comments,
  reviews,
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
}: TaskBoardProps) {
  const [taskRepoId, setTaskRepoId] = useState('')
  const [taskBranchName, setTaskBranchName] = useState('')
  const [taskBaseBranch, setTaskBaseBranch] = useState('')
  const [taskHandoffSummary, setTaskHandoffSummary] = useState('')
  const [taskArtifact, setTaskArtifact] = useState('')
  const [reviewVerdict, setReviewVerdict] = useState<'approve' | 'request-changes'>('approve')
  const [reviewBody, setReviewBody] = useState('')
  const [reviewAgentId, setReviewAgentId] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState('')

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0]

  useEffect(() => {
    setReviewVerdict('approve')
    setReviewBody('')
    setReviewAgentId('')
    setReviewFeedback('')
    setTaskRepoId(selectedTask?.repoId ? String(selectedTask.repoId) : '')
    setTaskBranchName(selectedTask?.branchName ?? '')
    setTaskBaseBranch(selectedTask?.baseBranch ?? '')
    setTaskHandoffSummary(selectedTask?.handoffSummary ?? '')
    setTaskArtifact(selectedTask?.artifact ?? '')
  }, [selectedTask?.id])

  function handleSaveTaskDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask) return
    onUpdateTaskDetails({
      taskId: selectedTask.id,
      repoId: taskRepoId ? Number(taskRepoId) : null,
      branchName: taskBranchName || null,
      baseBranch: taskBaseBranch || null,
      handoffSummary: taskHandoffSummary || null,
      artifact: taskArtifact || null,
    })
  }

  useEffect(() => {
    if (!expandedCard) return
    const handle = window.requestAnimationFrame(() => {
      const selector =
        expandedCard.type === 'task'
          ? `[data-task-card="${expandedCard.taskId}"]`
          : `[data-review-card="${expandedCard.taskId}"]`
      const element = document.querySelector(selector)
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      }
    })
    return () => window.cancelAnimationFrame(handle)
  }, [expandedCard])

  return (
    <section className="task-board">
      {tasks.map((task) => {
        const isExpandedTask =
          expandedCard?.taskId === task.id && expandedCard.type === 'task'
        const isExpandedReview =
          expandedCard?.taskId === task.id && expandedCard.type === 'review'
        const taskReviews =
          selectedTask?.id === task.id ? reviews : []
        const activeRepoId =
          selectedTask?.id === task.id
            ? taskRepoId
              ? Number(taskRepoId)
              : null
            : task.repoId
        const taskRepo =
          repos.find((repo) => repo.id === (activeRepoId ?? task.repoId)) ?? null
        const build =
          selectedTask?.id === task.id ? latestBuild ?? null : null
        const latestReview = taskReviews[0] ?? null
        const pendingReview = taskReviews.find((review) => !review.appliedAt) ?? null

        return (
          <article
            className={`task-column ${
              expandedCard?.taskId === task.id ? 'has-expanded-card' : ''
            }`}
            key={task.id}
          >
            <div className="card-slot">
              <button
                className="task-pane card-face"
                data-status={task.status}
                onClick={() => {
                  onSelectTask(task.id)
                  onSetExpandedCard({ taskId: task.id, type: 'task' })
                }}
                type="button"
              >
                <div className="task-card-topline">
                  <span>{task.shortRef}</span>
                  <small>{task.status}</small>
                </div>
                <h3>{task.title}</h3>
                <p>{task.description}</p>
                <div className="card-footer-meta">
                  <span>{taskRepo?.name ?? 'no repo'}</span>
                  <span>{task.branchName ?? 'no branch'}</span>
                </div>
              </button>

              {isExpandedTask ? (
                <ExpandedCard
                  title={task.title}
                  variant="task"
                  dataKey={`task-${task.id}`}
                  onClose={() => onSetExpandedCard(null)}
                >
                  <div className="expanded-meta">
                    <span>{task.shortRef}</span>
                    <span>{task.status}</span>
                    <span>{taskRepo?.name ?? 'no repo'}</span>
                    <span>{task.branchName ?? 'no branch'}</span>
                  </div>
                  <section>
                    <h4>repo</h4>
                    <form className="task-detail-form" onSubmit={handleSaveTaskDetails}>
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
                  <section>
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
                  <section>
                    <h4>handoff</h4>
                    <textarea
                      aria-label="task handoff"
                      value={taskHandoffSummary}
                      onChange={(event) => setTaskHandoffSummary(event.target.value)}
                      rows={4}
                    />
                  </section>
                  <section>
                    <h4>artifact</h4>
                    <textarea
                      aria-label="task artifact"
                      value={taskArtifact}
                      onChange={(event) => setTaskArtifact(event.target.value)}
                      rows={5}
                    />
                  </section>
                  <section>
                    <h4>build</h4>
                    {build ? (
                      <div className="build-result">
                        <div className="expanded-meta">
                          <span>{build.shortRef}</span>
                          <span>{build.status}</span>
                        </div>
                        <pre>{build.output || 'no output'}</pre>
                      </div>
                    ) : (
                      <p>no builds yet</p>
                    )}
                  </section>
                  <section>
                    <h4>comments</h4>
                    <CommentStream comments={comments} />
                  </section>
                </ExpandedCard>
              ) : null}
            </div>

            <div className="card-slot">
              <button
                className="review-pane card-face"
                data-status={task.status}
                onClick={() => {
                  onSelectTask(task.id)
                  onSetExpandedCard({ taskId: task.id, type: 'review' })
                }}
                type="button"
              >
                <div className="review-heading">
                  <span>review</span>
                  <small>{task.status}</small>
                </div>
                <p>{reviewSummary(task, latestReview)}</p>
                <div className="card-footer-meta">
                  <span>{pendingReview ? pendingReview.shortRef : 'no active review'}</span>
                  <span>
                    {task.reviewRequiresReview ? 'human pass required' : 'auto apply'}
                  </span>
                </div>
              </button>

              {isExpandedReview ? (
                <ExpandedCard
                  title="review"
                  variant="review"
                  dataKey={`review-${task.id}`}
                  onClose={() => onSetExpandedCard(null)}
                >
                  <div className="expanded-meta">
                    <span>{task.shortRef}</span>
                    <span>{task.status}</span>
                    <span>{task.reviewRequiresReview ? 'human review on' : 'human review off'}</span>
                  </div>

                  {task.status !== 'reviewing' &&
                  task.status !== 'accepted' &&
                  task.status !== 'merged' ? (
                    <div className="review-actions single">
                      <button
                        type="button"
                        onClick={() => onReadyTask(task.id)}
                        disabled={isReadyingTask}
                      >
                        ready for review
                      </button>
                    </div>
                  ) : null}

                  <section>
                    <h4>submit review</h4>
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
                          onChange={(event) =>
                            setReviewVerdict(event.target.value as 'approve' | 'request-changes')
                          }
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
                  </section>

                  {pendingReview ? (
                    <section>
                      <h4>pending review</h4>
                      <article className="review-record pending">
                        <div className="review-record-header">
                          <div>
                            <span>{pendingReview.shortRef}</span>
                            <strong>{pendingReview.verdict}</strong>
                          </div>
                          <small>{pendingReview.authorAgentId ?? pendingReview.createdAt}</small>
                        </div>
                        <p>{pendingReview.body}</p>

                        <div className="review-actions single">
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
                          <button
                            type="submit"
                            disabled={isRequestingReviewChanges}
                          >
                            request review changes
                          </button>
                        </form>
                      </article>
                    </section>
                  ) : null}

                  <section>
                    <h4>history</h4>
                    <ReviewHistory reviews={taskReviews} />
                  </section>

                  <section>
                    <h4>comments</h4>
                    <CommentStream comments={comments} />
                  </section>
                </ExpandedCard>
              ) : null}
            </div>
          </article>
        )
      })}
    </section>
  )
}