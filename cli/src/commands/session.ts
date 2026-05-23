import { resolveRelevantEffortRun, setAgentRunProviderSessionId } from '../../../core/agentRuns'
import { getEffortByRef } from '../../../core/efforts'
import { option } from '../args'
import { db, resolveRunRef } from '../context'
import { resolveProvider, resolveSessionId } from '../provider'
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

    const provider: Provider = providerLabel
      ? resolveProvider(providerLabel)
      : run.provider

    const sessionId = resolveSessionId(run, explicitId, providerLabel ? provider : null)
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

    console.log(`${run.shortRef} ${run.provider}`)
    if (run.providerSessionId) {
      console.log(run.providerSessionId)
    } else {
      console.log('(no session id)')
    }
    return true
  }

  return false
}
