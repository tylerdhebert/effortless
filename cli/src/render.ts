import type { AgentProviderConfig } from '../../core/agentProviders'
import type { AgentProfile, AgentRun, InputRequest, Plan, Repo, Review, Task } from '../../core/types'
import type { runTaskBuild } from '../../core/builds'

export function printTask(task: Task): void {
  console.log(`${task.shortRef} ${task.status}`)
  if (task.branchName) {
    console.log(`branch ${task.branchName}`)
  }
  if (task.worktreePath) {
    console.log(`worktree ${task.worktreePath}`)
  }
}

export function printPlan(plan: Plan): void {
  console.log(`${plan.shortRef} ${planState(plan)}`)
}

export function printReview(review: Review): void {
  console.log(`${review.shortRef} ${review.verdict}`)
  console.log(`task ${review.taskId}`)
}

export function printRepo(repo: Repo): void {
  console.log(`${repo.shortRef} ${repo.name}`)
  console.log(`path ${repo.path}`)
  console.log(`base ${repo.baseBranch}`)
  if (repo.buildCommand) {
    console.log(`build ${repo.buildCommand}`)
  }
}

export function printBuild(build: Awaited<ReturnType<typeof runTaskBuild>>): void {
  console.log(`${build.shortRef} ${build.status}`)
  console.log(`task ${build.taskId}`)
  if (build.output) {
    console.log(build.output)
  }
}

export function printInputRequest(inputRequest: InputRequest): void {
  console.log(`${inputRequest.shortRef} ${inputRequest.status}`)
  console.log(`type ${inputRequest.type}`)
  console.log(inputRequest.prompt)
  if (inputRequest.answer) {
    console.log(`answer ${inputRequest.answer}`)
  }
}

export function printAgentProfile(profile: AgentProfile): void {
  console.log(`${profile.shortRef}  ${profile.name}`)
  console.log('')
  console.log(`  environment  ${profile.environment}${profile.wslDistro ? `/${profile.wslDistro}` : ''}`)
  console.log(`  cwd          ${profile.defaultCwdKind}${profile.customCwd ? ` ${profile.customCwd}` : ''}`)
  if (Object.keys(profile.env).length > 0) {
    console.log('  env')
    for (const [name, value] of Object.entries(profile.env)) {
      console.log(`    ${name}=${value}`)
    }
  }
  console.log('')
}

export function printAgentProvider(provider: AgentProviderConfig): void {
  console.log(`${provider.key}  ${provider.name}`)
  console.log(`  command  ${provider.commandTemplate}`)
  console.log(`  resume   ${provider.resumeCommandTemplate}`)
  if (provider.forkCommandTemplate) {
    console.log(`  fork     ${provider.forkCommandTemplate}`)
  }
  console.log('')
}

export function printAgentRun(run: AgentRun, options: { brief?: boolean; verbose?: boolean } = {}): void {
  if (options.brief) {
    printAgentRunBrief(run)
    return
  }

  const verbose = options.verbose ?? false
  console.log(`${run.shortRef} ${run.status} ${run.purpose} ${run.label}`)
  console.log(`provider ${run.provider}`)
  console.log(`task ${run.taskId ?? 'none'}`)
  if (verbose) {
    console.log(`cwd ${run.cwd}`)
    console.log(`command ${truncateCommand(run.command)}`)
  }
}

export function printAgentRunBrief(run: AgentRun): void {
  const scope = run.taskId != null ? `task#${run.taskId}` : 'effort'
  console.log(`${run.shortRef}  ${run.status.padEnd(9)}  ${run.label}  ${run.provider}  ${scope}`)
}

export function printAgentRunDetail(run: AgentRun, options: { brief?: boolean } = {}): void {
  if (options.brief) {
    printAgentRunBrief(run)
    return
  }

  printAgentRun(run, { verbose: true })
  console.log(`profile ${run.profileId}`)
  console.log(`effort ${run.effortId}`)
  console.log(`environment ${run.environment}`)
  if (run.providerSessionId) {
    console.log(`provider session ${run.providerSessionId}`)
  }
  if (run.command) {
    console.log(`command ${truncateCommand(run.command)}`)
  }
  console.log(`context dir  ~/.effortless/runs/${run.shortRef}/`)
  if (run.exitCode !== null) {
    console.log(`exit ${run.exitCode}`)
  }
  if (run.error) {
    console.log(`error ${run.error}`)
  }
}

function truncateCommand(command: string, limit = 240): string {
  const trimmed = command.trim()
  if (!trimmed) return '(not expanded)'
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit).trimEnd()}… (truncated — see context pack, not the full shell line)`
}

export function planState(plan: Plan): string {
  if (plan.accepted) {
    return 'accepted'
  }
  return 'draft'
}
