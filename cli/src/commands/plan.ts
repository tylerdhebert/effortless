import { createPlan, getPlanByRef, listPlanComments, listPlans, markPlanReady } from '../../../core/plans'
import { requiredOption, bodyArg } from '../args'
import { db, wait } from '../context'
import { printPlan } from '../render'
import type { Plan } from '../../../core/types'

export async function handlePlan(surface: string, command: string): Promise<boolean> {
  if (surface !== 'plan') return false

  if (command === 'submit') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const plan = createPlan(db, {
      effortId: effort.id,
      body: bodyArg(),
      authorAgentId: requiredOption('--agent'),
    })
    printPlan(plan)
    return true
  }

  if (command === 'list') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const plans = listPlans(db, effort.id)

    if (plans.length === 0) {
      console.log('no plans')
      return true
    }

    for (const plan of plans) {
      printPlan(plan)
    }
    return true
  }

  if (command === 'show') {
    const plan = getPlanByRef(db, requiredOption('--plan'))
    printPlan(plan)
    console.log(plan.body)
    const comments = listPlanComments(db, plan.id)
    for (const comment of comments) {
      console.log(`${comment.kind} ${comment.agentId ?? comment.author}: ${comment.body}`)
    }
    return true
  }

  if (command === 'ready') {
    const plan = getPlanByRef(db, requiredOption('--plan'))
    const updated = markPlanReady(db, plan.id)
    printPlan(updated)

    if (!updated.accepted && updated.readyAt) {
      await waitForPlan(updated)
    }

    return true
  }

  if (command === 'wait') {
    const plan = getPlanByRef(db, requiredOption('--plan'))
    await waitForPlan(plan)
    return true
  }

  return false
}

async function waitForPlan(plan: Plan): Promise<void> {
  const started = Date.now()
  let interrupted = false

  process.on('SIGINT', () => {
    interrupted = true
  })

  while (!interrupted) {
    const current = getPlanByRef(db, plan.shortRef)

    if (current.accepted) {
      console.log(`${current.shortRef} approved`)
      return
    }

    if (current.readyAt) {
      const feedback = latestHumanPlanFeedbackSince(current.id, current.readyAt)
      if (feedback) {
        console.error(feedback)
        process.exitCode = 1
        return
      }

      const otherAccepted = anotherPlanAcceptedSince(current)
      if (otherAccepted) {
        console.error(`another plan was accepted: ${otherAccepted.shortRef}`)
        process.exitCode = 1
        return
      }
    } else {
      printPlan(current)
      return
    }

    const elapsed = Math.floor((Date.now() - started) / 1000)
    console.log(`waiting for human input, please wait - ${elapsed} seconds elapsed`)
    await wait(2000)
  }

  console.error('connection dropped while waiting for human approval')
  console.error(`reattach with: efl plan wait --plan ${plan.shortRef}`)
  console.error('you must confirm human approval before ending turn')
  process.exitCode = 1
}

function latestHumanPlanFeedbackSince(planId: number, since: string): string | null {
  const comments = listPlanComments(db, planId)
    .filter(
      (comment) =>
        comment.author === 'user' &&
        comment.kind === 'comment' &&
        new Date(comment.createdAt).getTime() >= new Date(since).getTime(),
    )
    .reverse()

  return comments[0]?.body ?? null
}

function anotherPlanAcceptedSince(plan: Plan): Plan | null {
  if (!plan.readyAt) {
    return null
  }

  const plans = listPlans(db, plan.effortId)
  return (
    plans.find(
      (candidate) =>
        candidate.id !== plan.id &&
        candidate.acceptedAt &&
        new Date(candidate.acceptedAt).getTime() >= new Date(plan.readyAt!).getTime(),
    ) ?? null
  )
}