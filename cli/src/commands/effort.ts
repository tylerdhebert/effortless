import { createEffort, getEffortByRef, listEfforts, updateEffortStatus, updateEffortSummary } from '../../../core/efforts'
import { listDiscussionMessages } from '../../../core/discussion'
import { listInputRequests } from '../../../core/inputs'
import { resolveMandateText } from '../../../core/mandates'
import { listPlans } from '../../../core/plans'
import { listReferences } from '../../../core/references'
import { listTasks } from '../../../core/tasks'
import { bodyArg, option, requiredOption } from '../args'
import { db } from '../context'
import { planState, printReference } from '../render'

export async function handleEffort(surface: string, command: string): Promise<boolean> {
  if (surface !== 'effort') return false

  if (command === 'create') {
    const template = (option('--template') ?? 'bugfix') as 'bugfix' | 'delivery' | 'investigation' | 'discussion'
    const effort = createEffort(db, {
      title: requiredOption('--title'),
      description: requiredOption('--description'),
      template,
    })
    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    return true
  }

  if (command === 'list') {
    const efforts = listEfforts(db)

    if (efforts.length === 0) {
      console.log('no efforts')
      return true
    }

    for (const effort of efforts) {
      console.log(`${effort.shortRef} ${effort.template} ${effort.status} ${effort.title}`)
    }
    return true
  }

  if (command === 'show') {
    const effort = getEffortByRef(db, requiredOption('--effort'))
    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    console.log(effort.description)
    if (effort.summary) {
      console.log('')
      console.log('summary')
      console.log(effort.summary)
    }
    return true
  }

  if (command === 'context') {
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const plans = listPlans(db, effort.id)
    const acceptedPlan = plans.find((plan) => plan.accepted) ?? null
    const tasks = listTasks(db, effort.id)
    const references = listReferences(db, 'effort', effort.id)
    const inputs = listInputRequests(db, effort.id)
    const messages = listDiscussionMessages(db, effort.id)
    const effortMandate = resolveMandateText(db, 'effort')
    const planMandate = resolveMandateText(db, 'plan')
    const taskMandate = resolveMandateText(db, 'task')
    const reviewMandate = resolveMandateText(db, 'review')
    const discussionMandate = resolveMandateText(db, 'discussion')

    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    console.log('')
    console.log('description')
    console.log(effort.description)

    if (effort.summary) {
      console.log('')
      console.log('summary')
      console.log(effort.summary)
    }

    if (acceptedPlan) {
      console.log('')
      console.log(`accepted plan ${acceptedPlan.shortRef}`)
      console.log(acceptedPlan.summary ?? acceptedPlan.body)
    } else if (plans.length > 0) {
      console.log('')
      console.log('plans')
      for (const plan of plans) {
        console.log(`${plan.shortRef} ${planState(plan)} ${plan.summary ?? firstLine(plan.body)}`)
      }
    }

    if (tasks.length > 0) {
      console.log('')
      console.log('tasks')
      for (const task of tasks) {
        console.log(`${task.shortRef} ${task.status} ${task.title}`)
        if (task.branchName) {
          console.log(`branch ${task.branchName}`)
        }
        if (task.ownerAgentId) {
          console.log(`owner ${task.ownerAgentId}`)
        }
      }
    }

    if (inputs.length > 0) {
      console.log('')
      console.log('inputs')
      for (const input of inputs) {
        console.log(`${input.shortRef} ${input.status} ${input.prompt}`)
      }
    }

    if (references.length > 0) {
      console.log('')
      console.log('references')
      for (const reference of references) {
        printReference(reference)
      }
    }

    if (messages.length > 0) {
      const latest = messages[0]
      console.log('')
      console.log('latest discussion')
      console.log(`${latest.author}${latest.agentId ? `:${latest.agentId}` : ''}`)
      console.log(latest.body)
    }

    const mandates = [
      ['effort', effortMandate],
      ['plan', planMandate],
      ['task', taskMandate],
      ['review', reviewMandate],
      ['discussion', discussionMandate],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]))

    if (mandates.length > 0) {
      console.log('')
      console.log('mandates')
      for (const [surface, mandate] of mandates) {
        console.log(`${surface}`)
        console.log(mandate)
      }
    }

    return true
  }

  if (command === 'complete') {
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const updated = updateEffortStatus(db, effort.id, 'complete')
    console.log(`${updated.shortRef} ${updated.status}`)
    return true
  }

  if (command === 'summary') {
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const summary = bodyArg()
    const updated = updateEffortSummary(db, effort.id, summary)
    console.log(`${updated.shortRef} summary updated`)
    return true
  }

  console.log('effort commands: create, list, show, context, summary, complete')
  return true
}

function firstLine(value: string): string {
  return value.split('\n').map((line) => line.trim()).find(Boolean) ?? ''
}
