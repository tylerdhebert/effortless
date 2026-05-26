import {
  checkpointTask,
  claimTask,
  createTask,
  ensureTaskWorktree,
  getTaskByRef,
  listTaskComments,
  listTasks,
  markTaskReady,
  mergeTask,
  updateTaskDetails,
} from '../../../core/tasks'
import { getLatestTaskBuild } from '../../../core/builds'
import { getEffort } from '../../../core/efforts'
import { listPlans } from '../../../core/plans'
import { getRepo } from '../../../core/repos'
import { listReferences } from '../../../core/references'
import { option, requiredOption, bodyArg, isBrief } from '../args'
import { db, resolveTask, wait } from '../context'
import {
  printArtifactPreview,
  printComments,
  endSection,
  printExpandedReferences,
  printLatestUpdate,
  printRelatedMandates,
  printSection,
  printSurfaceMandate,
  printTemplatePlaybook,
  printTemplateWorkflow,
} from '../contextSections'
import { printTask } from '../render'
import type { Task } from '../../../core/types'

export async function handleTask(surface: string, command: string): Promise<boolean> {
  if (surface !== 'task') return false

  if (command === 'create') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const { getRepoByRef } = await import('../../../core/repos')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const title = requiredOption('--title')
    const description = option('--description') ?? title
    const repoRef = option('--repo')
    const repo = repoRef ? getRepoByRef(db, repoRef) : null
    const task = createTask(db, {
      effortId: effort.id,
      title,
      description,
      repoId: repo?.id ?? null,
      branchName: option('--branch'),
      baseBranch: option('--base-branch') ?? repo?.baseBranch ?? null,
    })
    printTask(task)
    return true
  }

  if (command === 'list') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const tasks = listTasks(db, effort.id)

    if (tasks.length === 0) {
      console.log('no tasks')
      return true
    }

    for (const task of tasks) {
      console.log(`${task.shortRef} ${task.status} ${task.title}`)
    }
    return true
  }

  if (command === 'show') {
    const task = resolveTask(db, resolveTaskRef())
    printTask(task)
    console.log(task.title)
    console.log(task.description)
    if (task.artifact) {
      console.log('artifact')
      console.log(task.artifact)
    }
    const comments = listTaskComments(db, task.id)
    for (const comment of comments) {
      console.log(`${comment.kind} ${comment.author}: ${comment.body}`)
    }
    return true
  }

  if (command === 'context') {
    const brief = isBrief()
    const task = resolveTask(db, resolveTaskRef())
    const effort = getEffort(db, task.effortId)
    const plans = listPlans(db, effort.id)
    const effortTasks = listTasks(db, effort.id)
    printTask(task)
    console.log(task.title)
    printTemplatePlaybook(db, effort.template, { brief })
    printSurfaceMandate(db, 'task', task.repoId, { brief })
    printTemplateWorkflow(effort, {
      plans: plans.length,
      acceptedPlans: plans.filter((plan) => plan.accepted).length,
      tasks: effortTasks.length,
      acceptedTasks: effortTasks.filter((candidate) => candidate.status === 'accepted').length,
      mergedTasks: effortTasks.filter((candidate) => candidate.status === 'merged').length,
    })
    printRelatedMandates(db, ['effort', 'review'], task.repoId, { brief })
    console.log('')
    console.log('description')
    console.log(task.description)

    const comments = listTaskComments(db, task.id)
    printLatestUpdate(comments)
    printArtifactPreview(task.artifact, `efl task show --task ${task.shortRef}`)

    if (task.repoId) {
      const repo = getRepo(db, task.repoId)
      printSection('repo')
      console.log(`${repo.shortRef} ${repo.name}`)
      console.log(`path ${repo.path}`)
      console.log(`base ${repo.baseBranch}`)
      console.log(`task base ${task.baseBranch ?? repo.baseBranch}`)
      if (repo.buildCommand) {
        console.log(`build ${repo.buildCommand}`)
      }
      endSection('repo')
    }

    const acceptedPlan = plans.find((plan) => plan.accepted)
    if (acceptedPlan) {
      console.log('')
      console.log(`accepted plan ${acceptedPlan.shortRef}`)
      console.log(acceptedPlan.summary ?? acceptedPlan.body)
    }

    const latestBuild = getLatestTaskBuild(db, task.id)
    if (latestBuild) {
      console.log('')
      console.log('latest build')
      console.log(`${latestBuild.shortRef} ${latestBuild.status}`)
      if (latestBuild.completedAt) {
        console.log(`completed ${latestBuild.completedAt}`)
      }
    }

    const references = listReferences(db, 'task', task.id)
    printExpandedReferences(db, references, { brief })
    if (!brief) {
      printComments(comments)
    }

    return true
  }

  if (command === 'claim') {
    const task = resolveTask(db, resolveTaskRef())
    const agentId = resolveAgentId()
    const updated = await claimTask(db, { taskId: task.id, agentId })
    printTask(updated)
    return true
  }

  if (command === 'checkpoint') {
    const task = resolveTask(db, resolveTaskRef())
    const agentId = resolveAgentId()
    const body = bodyArg()
    const comment = checkpointTask(db, { taskId: task.id, agentId, body })
    console.log(`${task.shortRef} checkpoint ${comment.id}`)
    return true
  }

  if (command === 'artifact') {
    const task = resolveTask(db, resolveTaskRef())
    const agentId = resolveAgentId()
    const updated = updateTaskDetails(db, {
      taskId: task.id,
      artifact: bodyArg(),
    })
    checkpointTask(db, {
      taskId: task.id,
      agentId,
      body: 'artifact updated',
    })
    printTask(updated)
    return true
  }

  if (command === 'ready') {
    const task = resolveTask(db, resolveTaskRef())
    const updated = await markTaskReady(db, task.id)
    printTask(updated)

    if (updated.status === 'reviewing' && process.env.EFFORTLESS_CLIENT_WAIT !== '1') {
      await waitForTask(updated)
    }

    return true
  }

  if (command === 'merge') {
    const task = resolveTask(db, resolveTaskRef())
    const updated = await mergeTask(db, task.id)
    printTask(updated)
    return true
  }

  if (command === 'wait') {
    const task = resolveTask(db, resolveTaskRef())
    await waitForTask(task)
    return true
  }

  if (command === 'worktree') {
    const task = resolveTask(db, resolveTaskRef())
    const updated = await ensureTaskWorktree(db, task.id)
    printTask(updated)
    if (updated.worktreePath) {
      console.log(`worktree ${updated.worktreePath}`)
    }
    return true
  }

  return false
}

function resolveTaskRef(): string {
  return option('--task') ?? process.env.EFFORTLESS_TASK ?? requiredOption('--task')
}

function resolveAgentId(): string {
  return process.env.EFFORTLESS_RUN_LABEL ?? 'main'
}

async function waitForTask(task: Task): Promise<void> {
  const started = Date.now()
  let interrupted = false

  process.on('SIGINT', () => {
    interrupted = true
  })

  while (!interrupted) {
    const current = getTaskByRef(db, task.shortRef)

    if (current.status === 'accepted' || current.status === 'merged') {
      console.log(`${current.shortRef} approved`)
      return
    }

    if (current.status === 'changes-requested') {
      const feedback = latestHumanFeedback(current.id)
      if (feedback) {
        console.error(feedback)
      }
      process.exitCode = 1
      return
    }

    if (current.status !== 'reviewing') {
      printTask(current)
      return
    }

    const elapsed = Math.floor((Date.now() - started) / 1000)
    console.log(`waiting for human input, please wait - ${elapsed} seconds elapsed`)
    await wait(2000)
  }

  console.error('connection dropped while waiting for human approval')
  console.error(`reattach with: efl task wait --task ${task.shortRef}`)
  console.error('you must confirm human approval before ending turn')
  process.exitCode = 1
}

function latestHumanFeedback(taskId: number): string | null {
  const comments = listTaskComments(db, taskId)
    .filter((comment) => comment.author === 'user' && comment.kind === 'comment')
    .reverse()

  return comments[0]?.body ?? null
}
