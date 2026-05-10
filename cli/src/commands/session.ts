import { resolveRelevantEffortRun, setAgentRunProviderSessionId } from '../../../core/agentRuns'
import { getAgentProfile } from '../../../core/agentProfiles'
import { getEffortByRef } from '../../../core/efforts'
import { option } from '../args'
import { db, resolveRunRef } from '../context'
import { inferProvider, resolveProvider, resolveSessionId } from '../provider'
import type { Provider } from '../provider'
import type { AgentRun } from '../../../core/types'

export async function handleSession(surface: string, command: string): Promise<boolean> {
  if (surface !== 'session') return false

  if (command === 'set') {
    const runRef = option('--run')
    const effortRef = option('--effort')

    if (!runRef && !effortRef) {
      throw new Error('session set requires --run or --effort')
    }

    const explicitId = option('--id')
    const providerLabel = option('--provider')

    let run: AgentRun
    if (runRef) {
      run = resolveRunRef(db, runRef)
    } else {
      const effort = getEffortByRef(db, effortRef!)
      run = resolveRelevantEffortRun(db, effort.id)
    }

    const profile = getAgentProfile(db, run.profileId)
    const provider: Provider = providerLabel
      ? resolveProvider(providerLabel)
      : inferProvider(profile)

    const sessionId = resolveSessionId(provider, explicitId)
    setAgentRunProviderSessionId(db, run.id, sessionId)

    console.log(`${run.shortRef} ${provider} session set`)
    console.log(sessionId)
    return true
  }

  if (command === 'show') {
    const runRef = option('--run')
    const effortRef = option('--effort')

    if (!runRef && !effortRef) {
      throw new Error('session show requires --run or --effort')
    }

    let run: AgentRun
    if (runRef) {
      run = resolveRunRef(db, runRef)
    } else {
      const effort = getEffortByRef(db, effortRef!)
      run = resolveRelevantEffortRun(db, effort.id)
    }

    const profile = getAgentProfile(db, run.profileId)
    const provider = inferProvider(profile)

    console.log(`${run.shortRef} ${provider}`)
    if (run.providerSessionId) {
      console.log(run.providerSessionId)
    } else {
      console.log('(no session id)')
    }
    return true
  }

  return false
}
