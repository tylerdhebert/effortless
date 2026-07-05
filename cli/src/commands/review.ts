import { getReviewByRef, listReviews, submitReview } from '../../../core/reviews'
import { getLatestTaskBuild } from '../../../core/builds'
import { getEffort } from '../../../core/efforts'
import { getRepo } from '../../../core/repos'
import { getTask, listTaskComments } from '../../../core/tasks'
import { requiredOption, bodyArg, isBrief } from '../args'
import { db, resolveTask } from '../context'
import {
  printArtifactPreview,
  printComments,
  printInstructions,
  printSummary,
  printLatestUpdate,
  printSection,
  endSection,
} from '../contextSections'
import { printReview } from '../render'

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
    })
    printReview(review)

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
      console.log(`${review.shortRef} ${review.verdict}`)
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
    const brief = isBrief()
    const review = getReviewByRef(db, requiredOption('--review'))
    const task = getTask(db, review.taskId)
    const effort = getEffort(db, task.effortId)
    printReview(review)
    printInstructions(db, task.repoId, { brief })
    printSummary(review.summary)
    printArtifactPreview(review.body, `efl review show --review ${review.shortRef}`)

    printSection('task')
    console.log(`${task.shortRef}`)
    console.log(`${task.status} ${task.title}`)
    console.log(task.description)
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
    if (!brief) {
      printComments(comments)
    }

    return true
  }

  if (command === 'ready') {
    const review = getReviewByRef(db, requiredOption('--review'))
    printReview(review)
    return true
  }

  if (command === 'wait') {
    const review = getReviewByRef(db, requiredOption('--review'))
    printReview(review)
    return true
  }

  return false
}
