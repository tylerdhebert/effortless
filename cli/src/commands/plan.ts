import { createPlan, getPlanByRef, listPlanComments, listPlans, markPlanReady } from '../../../core/plans'
import { getEffort } from '../../../core/efforts'
import { listTasks } from '../../../core/tasks'
import { requiredOption, bodyArg } from '../args'
import { db } from '../context'
import {
  printArtifactPreview,
  printComments,
  printExpandedReferences,
  printHandoffSummary,
  printLatestUpdate,
  printRelatedMandates,
  printSurfaceMandate,
  printTemplatePlaybook,
  printTemplateWorkflow,
} from '../contextSections'
import { printPlan } from '../render'

export async function handlePlan(surface: string, command: string): Promise<boolean> {
  if (surface !== 'plan') return false

  if (command === 'submit') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const plan = createPlan(db, {
      effortId: effort.id,
      body: bodyArg(),
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
      console.log(`${comment.kind} ${comment.author}: ${comment.body}`)
    }
    return true
  }

  if (command === 'context') {
    const plan = getPlanByRef(db, requiredOption('--plan'))
    const effort = getEffort(db, plan.effortId)
    const plans = listPlans(db, effort.id)
    const tasks = listTasks(db, effort.id)
    printPlan(plan)
    console.log(`effort ${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    printTemplatePlaybook(db, effort.template)
    printSurfaceMandate(db, 'plan')
    printTemplateWorkflow(effort, {
      plans: plans.length,
      acceptedPlans: plans.filter((candidate) => candidate.accepted).length,
      tasks: tasks.length,
      acceptedTasks: tasks.filter((task) => task.status === 'accepted').length,
      mergedTasks: tasks.filter((task) => task.status === 'merged').length,
    })
    printRelatedMandates(db, ['effort', 'task', 'review', 'run'])

    const comments = listPlanComments(db, plan.id)
    printLatestUpdate(comments)
    printHandoffSummary(plan.summary)
    printArtifactPreview(plan.body, `efl plan show --plan ${plan.shortRef}`)

    const { listReferences } = await import('../../../core/references')
    printExpandedReferences(db, listReferences(db, 'plan', plan.id))
    printComments(comments)

    return true
  }

  if (command === 'ready') {
    const plan = getPlanByRef(db, requiredOption('--plan'))
    const updated = markPlanReady(db, plan.id)
    printPlan(updated)

    return true
  }

  if (command === 'wait') {
    const plan = getPlanByRef(db, requiredOption('--plan'))
    printPlan(plan)
    return true
  }

  return false
}
