import { listAgentProfiles } from '../../../core/agentProfiles'
import { listAgentRuns, listTaskRuns, prepareTaskRun } from '../../../core/agentRuns'
import { option, requiredOption } from '../args'
import { db, resolveTask } from '../context'
import { printAgentProfile, printAgentRun } from '../render'

export async function handleRun(surface: string, command: string): Promise<boolean> {
  if (surface !== 'run') return false

  if (command === 'profiles') {
    for (const profile of listAgentProfiles(db)) {
      printAgentProfile(profile)
    }
    return true
  }

  if (command === 'prepare') {
    const task = resolveTask(db, requiredOption('--task'))
    const profileId = resolveProfileId()
    const prepared = await prepareTaskRun(db, {
      taskId: task.id,
      profileId,
      label: option('--label') ?? undefined,
    })
    printAgentRun(prepared.run)
    console.log(`profile ${prepared.profile.shortRef} ${prepared.profile.name}`)
    console.log(`context ${prepared.run.contextPath}`)
    console.log(`bootstrap ${prepared.run.bootstrapPath}`)
    console.log(`transcript ${prepared.run.transcriptPath}`)
    console.log('')
    console.log('env')
    for (const [name, value] of Object.entries(prepared.env)) {
      console.log(`${name}=${value}`)
    }
    return true
  }

  if (command === 'list') {
    const taskRef = option('--task')
    const runs = taskRef
      ? listTaskRuns(db, resolveTask(db, taskRef).id)
      : listAgentRuns(db)
    for (const run of runs) {
      printAgentRun(run)
    }
    return true
  }

  return false
}

function resolveProfileId(): number | null {
  const value = option('--profile')
  if (!value) return null

  const profileId = Number(value)
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new Error('--profile must be a positive numeric id')
  }
  return profileId
}
