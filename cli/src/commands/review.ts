import { getReviewByRef, listReviews, submitReview } from '../../../core/reviews'
import { getLatestTaskBuild } from '../../../core/builds'
import { getEffort } from '../../../core/efforts'
import { getRepo } from '../../../core/repos'
import { getTask, listTaskComments } from '../../../core/tasks'
import { requiredOption, bodyArg } from '../args'
import { db, resolveTask, wait } from '../context'
import {
  printArtifactPreview,
  printComments,
  printExpandedReferences,
  printHandoffSummary,
  printLatestUpdate,
  printRelatedMandates,
  printSection,
  endSection,
  printSurfaceMandate,
  printTemplatePlaybook,
} from '../contextSections'
import { printReview } from '../render'
import type { Review } from '../../../core/types'

export async function handleReview(surface: string, command: string): Promise<boolean> {
  if (surface !== 'review') return false

  if (command === 'submit') {
    const task = resolveTask(db, requiredOption('--task'))
    const verdict = requiredOption('--verdict')

    if (verdict !== 'approve' && verdict !== 'request-changes') {
      throw new Error('--verdict must be approve or request-changes')
    }

    const review = await submitReview(db, {
      taskId: task.id,
      verdict,
      body: bodyArg(),
      authorAgentId: requiredOption('--agent'),
    })
    printReview(review)

    if (!review.appliedAt) {
      await waitForReview(review)
    }

    return true
  }

  if (command === 'list') {
    const task = resolveTask(db, requiredOption('--task'))
    const reviews = listReviews(db, task.id)

    if (reviews.length === 0) {
      console.log('no reviews')
      return true
    }

    for (const review of reviews) {
      console.log(
        `${review.shortRef} ${review.verdict} ${review.appliedAt ? 'applied' : 'pending'}`,
      )
    }
    return true
  }

  if (command === 'show') {
    const review = getReviewByRef(db, requiredOption('--review'))
    printReview(review)
    console.log(review.body)
    return true
  }

  if (command === 'context') {
    const review = getReviewByRef(db, requiredOption('--review'))
    const task = getTask(db, review.taskId)
    const effort = getEffort(db, task.effortId)
    printReview(review)
    printTemplatePlaybook(db, effort.template)
    printSurfaceMandate(db, 'review', task.repoId)
    printRelatedMandates(db, ['effort', 'task'], task.repoId)
    printHandoffSummary(review.summary)
    printArtifactPreview(review.body, `efl review show --review ${review.shortRef}`)

    printSection('task')
    console.log(`${task.shortRef}`)
    console.log(`${task.status} ${task.title}`)
    console.log(task.description)
    if (task.handoffSummary) {
      console.log('handoff')
      console.log(task.handoffSummary)
    }
    endSection('task')

    if (task.repoId) {
      const repo = getRepo(db, task.repoId)
      printSection('repo')
      console.log(`${repo.shortRef} ${repo.name}`)
      console.log(`path ${repo.path}`)
      console.log(`base ${task.baseBranch ?? repo.baseBranch}`)
      if (task.branchName) {
        console.log(`branch ${task.branchName}`)
      }
      if (task.worktreePath) {
        console.log(`worktree ${task.worktreePath}`)
      }
      if (repo.buildCommand) {
        console.log(`build ${repo.buildCommand}`)
      }
      endSection('repo')
    }

    console.log('')
    console.log('effort')
    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)

    const latestBuild = getLatestTaskBuild(db, task.id)
    if (latestBuild) {
      console.log('')
      console.log('latest build')
      console.log(`${latestBuild.shortRef} ${latestBuild.status}`)
      if (latestBuild.completedAt) {
        console.log(`completed ${latestBuild.completedAt}`)
      }
    }

    const comments = listTaskComments(db, task.id)
    printLatestUpdate(comments)
    const { listReferences } = await import('../../../core/references')
    printExpandedReferences(db, listReferences(db, 'review', review.id))
    printComments(comments)

    return true
  }

  if (command === 'ready') {
    const review = getReviewByRef(db, requiredOption('--review'))
    printReview(review)
    if (!review.appliedAt) {
      await waitForReview(review)
    }
    return true
  }

  if (command === 'wait') {
    const review = getReviewByRef(db, requiredOption('--review'))
    await waitForReview(review)
    return true
  }

  return false
}

async function waitForReview(review: Review): Promise<void> {
  const started = Date.now()
  let interrupted = false

  process.on('SIGINT', () => {
    interrupted = true
  })

  while (!interrupted) {
    const current = getReviewByRef(db, review.shortRef)

    if (current.appliedAt) {
      console.log(`${current.shortRef} applied`)
      return
    }

    const feedback = latestHumanFeedbackSince(current.taskId, current.createdAt)
    if (feedback) {
      console.error(feedback)
      process.exitCode = 1
      return
    }

    const elapsed = Math.floor((Date.now() - started) / 1000)
    console.log(`waiting for human input, please wait - ${elapsed} seconds elapsed`)
    await wait(2000)
  }

  console.error('connection dropped while waiting for human approval')
  console.error(`reattach with: efl review wait --review ${review.shortRef}`)
  console.error('you must confirm human approval before ending turn')
  process.exitCode = 1
}

function latestHumanFeedbackSince(taskId: number, since: string): string | null {
  const comments = listTaskComments(db, taskId)
    .filter(
      (comment) =>
        comment.author === 'user' &&
        comment.kind === 'comment' &&
        new Date(comment.createdAt).getTime() >= new Date(since).getTime(),
    )
    .reverse()

  return comments[0]?.body ?? null
}
