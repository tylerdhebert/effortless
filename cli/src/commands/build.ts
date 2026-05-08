import { getLatestTaskBuild, runTaskBuild } from '../../../core/builds'
import { option, requiredOption } from '../args'
import { db, resolveTask } from '../context'
import { printBuild } from '../render'

export async function handleBuild(surface: string, command: string): Promise<boolean> {
  if (surface !== 'build') return false

  if (command === 'run') {
    const task = resolveTask(db, resolveTaskRef())
    const build = await runTaskBuild(db, task.id)
    printBuild(build)
    return true
  }

  if (command === 'status') {
    const task = resolveTask(db, resolveTaskRef())
    const build = getLatestTaskBuild(db, task.id)

    if (!build) {
      console.log('no builds')
      return true
    }

    printBuild(build)
    return true
  }

  return false
}

function resolveTaskRef(): string {
  return option('--task') ?? process.env.EFFORTLESS_TASK ?? requiredOption('--task')
}
