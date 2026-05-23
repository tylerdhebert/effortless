import { resolveResumableEffortRun } from '../../../core/agentRuns'
import { getEffortByRef } from '../../../core/efforts'
import { option } from '../args'
import { db, resolveRunRef } from '../context'
import { getResumeCommand } from '../provider'
import type { AgentRun } from '../../../core/types'

export async function handleResume(surface: string): Promise<boolean> {
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

  const resumeCommand = getResumeCommand(run)

  if (!resumeCommand) {
    throw new Error(
      `Provider "${run.provider}" does not support resume.`,
    )
  }

  console.log(resumeCommand)
  return true
}
