import { listAgentProfiles } from '../../../core/agentProfiles'
import {
  buildAgentRunEnvironment,
  getAgentRun,
  listAgentRuns,
  listTaskRuns,
  markAgentRunCancelled,
  markAgentRunFailed,
  prepareEffortRun,
  prepareTaskRun,
} from '../../../core/agentRuns'
import type { AgentRun } from '../../../core/types'
import { bodyArg, isBrief, isVerbose, option } from '../args'
import { listAgentProviders, parseAgentProvider } from '../../../core/agentProviders'
import { getEffortByRef } from '../../../core/efforts'
import { db, resolveRunRef, resolveTask, startPreparedRun } from '../context'
import {
  printAgentProfile,
  printAgentProvider,
  printAgentRun,
  printAgentRunDetail,
} from '../render'

export async function handleRun(surface: string, command: string): Promise<boolean> {
  if (surface !== 'run') return false

  if (command === 'profiles') {
    for (const profile of listAgentProfiles(db)) {
      printAgentProfile(profile)
    }
    return true
  }

  if (command === 'providers') {
    for (const provider of listAgentProviders()) {
      printAgentProvider(provider)
    }
    return true
  }

  if (command === 'prepare') {
    const taskRef = option('--task')
    const effortRef = option('--effort')
    if (!taskRef && !effortRef) {
      throw new Error('run prepare requires --task or --effort')
    }
    const profileId = resolveProfileId()
    const provider = resolveProvider()
    const prepared = taskRef
      ? await prepareTaskRun(db, {
          taskId: resolveTask(db, taskRef).id,
          provider,
          profileId,
          label: option('--label') ?? undefined,
        })
      : await prepareEffortRun(db, {
          effortId: getEffortByRef(db, effortRef!).id,
          provider,
          profileId,
          label: option('--label') ?? undefined,
    })
    printAgentRunDetail(prepared.run)
    console.log(`profile ${prepared.profile.shortRef} ${prepared.profile.name}`)
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
    const verbose = isVerbose()
    for (const run of runs) {
      printAgentRun(run, { brief: !verbose, verbose })
    }
    return true
  }

  if (command === 'start') {
    const run = resolveRunRef(db)
    assertRunCanBeStarted(run)
    await startPreparedRun(run.id)
    const updated = getAgentRun(db, run.id)
    printAgentRunDetail(updated, { brief: isBrief() })
    console.log('')
    console.log('started — watch the run in the effortless terminal UI')
    return true
  }

  if (command === 'show') {
    const run = resolveRunRef(db)
    printAgentRunDetail(run, { brief: isBrief() })
    return true
  }

  if (command === 'env') {
    const run = resolveRunRef(db)
    for (const [name, value] of Object.entries(buildAgentRunEnvironment(db, run.id))) {
      console.log(`${name}=${value}`)
    }
    return true
  }

  if (command === 'fail') {
    const run = resolveRunRef(db)
    assertRunCanBeMarkedFailed(run)
    const updated = markAgentRunFailed(db, run.id, bodyArg().trim())
    printAgentRun(updated)
    return true
  }

  if (command === 'cancel') {
    const run = resolveRunRef(db)
    assertRunCanBeMarkedCancelled(run)
    const updated = markAgentRunCancelled(db, run.id)
    printAgentRun(updated)
    return true
  }

  return false
}

function assertRunCanBeMarkedFailed(run: AgentRun): void {
  if (run.status === 'failed') {
    return
  }

  if (run.status === 'exited' || run.status === 'cancelled') {
    throw new Error(`run ${run.shortRef} is already ${run.status}`)
  }
}

function assertRunCanBeStarted(run: AgentRun): void {
  if (run.status === 'running') {
    return
  }

  if (run.status !== 'prepared') {
    throw new Error(`run ${run.shortRef} is ${run.status}; only prepared runs can be started`)
  }
}

function assertRunCanBeMarkedCancelled(run: AgentRun): void {
  if (run.status === 'cancelled') {
    return
  }

  if (run.status === 'exited' || run.status === 'failed') {
    throw new Error(`run ${run.shortRef} is already ${run.status}`)
  }
}

function resolveProvider() {
  const value = option('--provider')
  return value ? parseAgentProvider(value) : null
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
