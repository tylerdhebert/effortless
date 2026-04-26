import type { Plan } from '../../core/types'

export function isPlanWaiting(plan: Plan) {
  return planStatus(plan) === 'waiting'
}

export function planStatus(plan: Plan) {
  if (plan.accepted) {
    return 'accepted'
  }

  if (plan.readyAt) {
    if (
      plan.latestFeedbackAt &&
      new Date(plan.latestFeedbackAt).getTime() >= new Date(plan.readyAt).getTime()
    ) {
      return 'changes requested'
    }

    return 'waiting'
  }

  return 'draft'
}

export function formatTemplate(template: string) {
  return template.replace('-', ' ')
}

export function reviewSummary(
  task: { status: string },
  latestReview: { verdict: string; appliedAt: string | null } | null,
) {
  if (latestReview) {
    return `${latestReview.verdict}${latestReview.appliedAt ? '' : ' pending'}`
  }

  if (task.status === 'reviewing') {
    return 'waiting for review'
  }

  if (task.status === 'changes-requested') {
    return 'changes requested'
  }

  if (task.status === 'accepted' || task.status === 'merged') {
    return 'approved'
  }

  return 'no review yet'
}