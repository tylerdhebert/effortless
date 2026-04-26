import { checkpointTask, claimTask, createTask, ensureTaskWorktree, getTaskByRef, listTaskComments, markTaskReady } from '../../../core/tasks'
import { option, requiredOption, bodyArg } from '../args'
import { db, resolveTask, wait } from '../context'
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

  if (command === 'claim') {
    const task = resolveTask(db, requiredOption('--task'))
    const agentId = requiredOption('--agent')
    const updated = await claimTask(db, { taskId: task.id, agentId })
    printTask(updated)
    return true
  }

  if (command === 'checkpoint') {
    const task = resolveTask(db, requiredOption('--task'))
    const agentId = requiredOption('--agent')
    const body = bodyArg()
    const comment = checkpointTask(db, { taskId: task.id, agentId, body })
    console.log(`${task.shortRef} checkpoint ${comment.id}`)
    return true
  }

  if (command === 'ready') {
    const task = resolveTask(db, requiredOption('--task'))
    const updated = markTaskReady(db, task.id)
    printTask(updated)

    if (updated.status === 'reviewing') {
      await waitForTask(updated)
    }

    return true
  }

  if (command === 'wait') {
    const task = resolveTask(db, requiredOption('--task'))
    await waitForTask(task)
    return true
  }

  if (command === 'worktree') {
    const task = resolveTask(db, requiredOption('--task'))
    const updated = await ensureTaskWorktree(db, task.id)
    printTask(updated)
    if (updated.worktreePath) {
      console.log(`worktree ${updated.worktreePath}`)
    }
    return true
  }

  return false
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