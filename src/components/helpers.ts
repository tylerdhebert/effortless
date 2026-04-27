import type { DiscussionMessage, EffortTemplate, InputRequest, Plan } from '../../core/types'

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

export function effortSupportsPlans(template: EffortTemplate) {
  return template === 'delivery' || template === 'investigation'
}

export function effortSupportsTasks(template: EffortTemplate) {
  return template === 'delivery' || template === 'bugfix'
}

export function effortSupportsDiscussion(template: EffortTemplate) {
  return template === 'delivery' || template === 'investigation' || template === 'discussion'
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

export function preferredDiscussionSummary(messages: DiscussionMessage[], inputs: InputRequest[]) {
  const answeredInput = [...inputs].reverse().find((input) => input.status === 'answered') ?? null

  if (answeredInput?.answer?.trim()) {
    return {
      label: 'latest answered input',
      body: answeredInput.answer.trim(),
    }
  }

  const agentMessage = [...messages].reverse().find((message) => message.author === 'agent') ?? null
  if (agentMessage?.body.trim()) {
    return {
      label: 'latest agent takeaway',
      body: agentMessage.body.trim(),
    }
  }

  const latestMessage = messages[messages.length - 1] ?? null
  if (latestMessage?.body.trim()) {
    return {
      label: `latest ${latestMessage.author} note`,
      body: latestMessage.body.trim(),
    }
  }

  return null
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
