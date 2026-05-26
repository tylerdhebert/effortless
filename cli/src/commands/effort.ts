import { createEffort, getEffortByRef, listEfforts, parseEffortTemplate, updateEffortStatus, updateEffortSummary } from '../../../core/efforts'
import { listInputRequests } from '../../../core/inputs'
import { listPlans } from '../../../core/plans'
import { listReferences } from '../../../core/references'
import { listTasks } from '../../../core/tasks'
import { bodyArg, isBrief, option, requiredOption } from '../args'
import { db } from '../context'
import {
  printArtifactPreview,
  printExpandedReferences,
  printSummary,
  printRelatedMandates,
  printSurfaceMandate,
  printTemplatePlaybook,
  printTemplateWorkflow,
} from '../contextSections'
import { planState } from '../render'

export async function handleEffort(surface: string, command: string): Promise<boolean> {
  if (surface !== 'effort') return false

  if (command === 'create') {
    const template = parseEffortTemplate(option('--template') ?? 'bugfix')
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
    const brief = isBrief()
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const plans = listPlans(db, effort.id)
    const acceptedPlan = plans.find((plan) => plan.accepted) ?? null
    const tasks = listTasks(db, effort.id)
    const references = listReferences(db, 'effort', effort.id)
    const inputs = listInputRequests(db, effort.id)

    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    printTemplatePlaybook(db, effort.template, { brief })
    printSurfaceMandate(db, 'effort', null, { brief })
    printTemplateWorkflow(effort, {
      plans: plans.length,
      acceptedPlans: plans.filter((plan) => plan.accepted).length,
      tasks: tasks.length,
      acceptedTasks: tasks.filter((task) => task.status === 'accepted').length,
      mergedTasks: tasks.filter((task) => task.status === 'merged').length,
    })
    printRelatedMandates(db, ['plan', 'task', 'review', 'run'], null, { brief })
    console.log('')
    console.log('description')
    console.log(effort.description)

    printSummary(effort.summary)

    if (acceptedPlan) {
      printArtifactPreview(
        acceptedPlan.summary ?? acceptedPlan.body,
        `efl plan show --plan ${acceptedPlan.shortRef}`,
        `accepted plan ${acceptedPlan.shortRef}`,
      )
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
      }
    }

    if (inputs.length > 0) {
      console.log('')
      console.log('inputs')
      for (const input of inputs) {
        console.log(`${input.shortRef} ${input.status} ${input.prompt}`)
      }
    }

    printExpandedReferences(db, references, { brief })

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

  return false
}

function firstLine(value: string): string {
  return value.split('\n').map((line) => line.trim()).find(Boolean) ?? ''
}
