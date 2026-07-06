import type { EffortTemplate, Plan } from '../../core/types'

export function planStatus(plan: Plan) {
  if (plan.accepted) {
    return 'accepted'
  }
  return 'draft'
}

export function formatTemplate(template: string) {
  return template.replace('-', ' ')
}

export const effortStatusColors: Record<string, string> = {
  active: 'var(--live)',
  complete: 'var(--ok)',
  archived: 'var(--muted)',
}

export function effortStatusColor(status: string): string {
  return effortStatusColors[status] ?? 'inherit'
}

export function effortSupportsPlans(template: EffortTemplate) {
  return template === 'delivery' || template === 'investigation'
}

export function effortSupportsTasks(template: EffortTemplate) {
  return template === 'delivery' || template === 'bugfix'
}

function firstMeaningfulBlock(text: string) {
  const paragraph = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find(Boolean)

  if (paragraph) {
    return paragraph
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('\n')
}

export function preferredPlanSummary(plans: Plan[]) {
  const plan = plans.find((entry) => entry.accepted) ?? plans[0] ?? null

  if (!plan) {
    return null
  }

  const body = plan.summary?.trim() || firstMeaningfulBlock(plan.body)

  return {
    plan,
    body: body.trim(),
  }
}

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return timestampFormatter.format(date)
}

export function reviewSummary(
  task: { status: string },
  latestReview: { verdict: string } | null,
) {
  if (latestReview) {
    return latestReview.verdict
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
