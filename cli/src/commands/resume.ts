import { resolveResumableEffortRun } from '../../../core/agentRuns'
import { getAgentProfile } from '../../../core/agentProfiles'
import { getEffortByRef } from '../../../core/efforts'
import { option } from '../args'
import { db, resolveRunRef } from '../context'
import { getResumeCommand, inferProvider } from '../provider'
import type { AgentRun } from '../../../core/types'

export async function handleResume(surface: string, _command: string): Promise<boolean> {
  if (surface !== 'resume') return false

  const runRef = option('--run')
  const effortRef = option('--effort')

  if (!runRef && !effortRef) {
    throw new Error('resume requires --run or --effort')
  }

  let run: AgentRun
  if (runRef) {
    run = resolveRunRef(db, runRef)
  } else {
    const effort = getEffortByRef(db, effortRef!)
    run = resolveResumableEffortRun(db, effort.id)
  }

  if (!run.providerSessionId) {
    throw new Error('No provider session id found. Run efl session set first.')
  }

  const profile = getAgentProfile(db, run.profileId)
  const provider = inferProvider(profile)
  const resumeCommand = getResumeCommand(provider, run.providerSessionId)

  if (!resumeCommand) {
    throw new Error(
      `Provider "${provider}" does not support resume.` +
      (provider === 'opencode' ? ' OpenCode resume is not yet supported.' : '') +
      (provider === 'claude' ? ' Claude resume is not yet supported.' : '') +
      (provider === 'custom' ? ' Custom provider resume requires additional configuration.' : ''),
    )
  }

  console.log(resumeCommand)
  return true
}
