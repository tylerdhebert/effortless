import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { getAppPaths } from './appPaths'
import type { AppDatabase } from './db'
import { getEffort } from './efforts'
import { listInputRequests } from './inputs'
import { resolveMandateText } from './mandates'
import { listPlans } from './plans'
import { getRepo } from './repos'
import { listTaskComments, listTasks } from './tasks'
import type { AgentProfile, AgentRun, Task } from './types'

export type PreparedTaskRunContext = {
  runDir: string
  prompt: string
}

type TaskRunPaths = Omit<PreparedTaskRunContext, 'prompt'>

export async function writeTaskRunContext(
  db: AppDatabase,
  run: AgentRun,
  task: Task,
  profile: AgentProfile,
): Promise<PreparedTaskRunContext> {
  const paths = getRunPaths(run.shortRef)
  const prompt = renderTaskBootstrap(db, run, task, profile)
  await mkdir(paths.runDir, { recursive: true })
  return { ...paths, prompt }
}

export async function writeEffortRunContext(
  db: AppDatabase,
  run: AgentRun,
  profile: AgentProfile,
): Promise<PreparedTaskRunContext> {
  const paths = getRunPaths(run.shortRef)
  const prompt = renderEffortBootstrap(db, run, profile)
  await mkdir(paths.runDir, { recursive: true })
  return { ...paths, prompt }
}

export function getRunPaths(runRef: string): TaskRunPaths {
  const runDir = path.join(getAppPaths().home, 'runs', runRef)
  return {
    runDir,
  }
}

function renderTaskContext(db: AppDatabase, task: Task): string {
  const effort = getEffort(db, task.effortId)
  const plans = listPlans(db, effort.id)
  const acceptedPlan = plans.find((plan) => plan.accepted) ?? null
  const comments = listTaskComments(db, task.id)
  const inputs = listInputRequests(db, effort.id).filter((input) =>
    input.status === 'pending' && (input.taskId === task.id || input.taskId == null)
  )
  const runMandate = resolveMandateText(db, 'run', task.repoId)
  const taskMandate = resolveMandateText(db, 'task', task.repoId)
  const repo = task.repoId ? getRepo(db, task.repoId) : null

  const sections = [
    heading('Run Mandate', runMandate ?? 'No run mandate is configured.'),
    heading('Task Mandate', taskMandate ?? 'No task mandate is configured.'),
    heading('Effort', [
      `${effort.shortRef} ${effort.template} ${effort.status}`,
      effort.title,
      effort.description,
      effort.summary ? `summary\n${effort.summary}` : null,
    ]),
    heading('Task', [
      `${task.shortRef} ${task.status}`,
      task.title,
      task.description,
      task.handoffSummary ? `handoff\n${task.handoffSummary}` : null,
      task.artifact ? `artifact\n${task.artifact}` : null,
    ]),
    heading('Repository', repo
      ? [
          `${repo.shortRef} ${repo.name}`,
          `path ${repo.path}`,
          `base ${repo.baseBranch}`,
          `task branch ${task.branchName ?? '(not assigned)'}`,
          `task base ${task.baseBranch ?? repo.baseBranch}`,
          `worktree ${task.worktreePath ?? '(not prepared)'}`,
          repo.buildCommand ? `build ${repo.buildCommand}` : null,
        ]
      : 'No repository is attached to this task.'),
    heading('Accepted Plan', acceptedPlan ? acceptedPlan.summary ?? acceptedPlan.body : 'No accepted plan.'),
    heading('Pending Inputs', inputs.length > 0
      ? inputs.map((input) => `${input.shortRef} ${input.status} ${input.prompt}`).join('\n')
      : 'No task or effort inputs are pending.'),
    heading('Recent Task Comments', comments.length > 0
      ? comments.slice(-12).map((comment) => `${comment.createdAt} ${comment.kind} ${comment.author}: ${comment.body}`).join('\n\n')
      : 'No task comments yet.'),
  ]

  return sections.filter(Boolean).join('\n\n').trimEnd() + '\n'
}

function renderEffortContext(db: AppDatabase, effortId: number): string {
  const effort = getEffort(db, effortId)
  const plans = listPlans(db, effort.id)
  const tasks = listTasks(db, effort.id)
  const inputs = listInputRequests(db, effort.id).filter((input) => input.status === 'pending')
  const runMandate = resolveMandateText(db, 'run', null)
  const effortMandate = resolveMandateText(db, 'effort', null)

  const sections = [
    heading('Run Mandate', runMandate ?? 'No run mandate is configured.'),
    heading('Effort Mandate', effortMandate ?? 'No effort mandate is configured.'),
    heading('Effort', [
      `${effort.shortRef} ${effort.template} ${effort.status}`,
      effort.title,
      effort.description,
      effort.summary ? `summary\n${effort.summary}` : null,
    ]),
    heading('Plans', plans.length > 0
      ? plans.map((plan) => `${plan.shortRef} ${plan.accepted ? 'accepted' : 'draft'}\n${plan.summary ?? plan.body}`).join('\n\n')
      : 'No plans yet.'),
    heading('Tasks', tasks.length > 0
      ? tasks.map((task) => [
          `${task.shortRef} ${task.status}`,
          task.title,
          task.repoId ? `repo ${task.repoId}` : null,
          task.branchName ? `branch ${task.branchName}` : null,
          task.worktreePath ? `worktree ${task.worktreePath}` : null,
          task.description,
        ].filter(Boolean).join('\n')).join('\n\n')
      : 'No tasks yet.'),
    heading('Pending Inputs', inputs.length > 0
      ? inputs.map((input) => `${input.shortRef} ${input.status} ${input.prompt}`).join('\n')
      : 'No pending inputs.'),
  ]

  return sections.filter(Boolean).join('\n\n').trimEnd() + '\n'
}

function renderTaskBootstrap(
  db: AppDatabase,
  run: AgentRun,
  task: Task,
  profile: AgentProfile,
): string {
  const effort = getEffort(db, task.effortId)
  const cwd = commandPath(profile, run.cwd)
  const context = renderTaskContext(db, task)
  return `# Effortless Run Bootstrap

You are running inside Effortless.

Current run:

- run: ${run.shortRef}
- label: ${run.label}
- purpose: ${run.purpose}
- profile: ${profile.shortRef} ${profile.name}
- effort: ${effort.shortRef}
- task: ${task.shortRef}
- cwd: ${cwd}

Use Effortless CLI updates as durable state:

- efl task checkpoint --task ${task.shortRef} --body "..."
- efl task artifact --task ${task.shortRef} --body "..."
- efl input request --task ${task.shortRef} --type text --prompt "..."
- efl build run --task ${task.shortRef}
- efl task ready --task ${task.shortRef}

Keep durable decisions, checkpoints, and handoff notes in Effortless.

## Context

${context}
`
}

function renderEffortBootstrap(
  db: AppDatabase,
  run: AgentRun,
  profile: AgentProfile,
): string {
  const effort = getEffort(db, run.effortId)
  const cwd = commandPath(profile, run.cwd)
  const context = renderEffortContext(db, run.effortId)
  return `# Effortless Main Run Bootstrap

You are running inside Effortless as the main agent for this effort.

Current run:

- run: ${run.shortRef}
- label: ${run.label}
- purpose: ${run.purpose}
- profile: ${profile.shortRef} ${profile.name}
- effort: ${effort.shortRef}
- cwd: ${cwd}

Use Effortless CLI updates as durable state. When the user asks you to focus on a task, use its task ref in CLI commands.

Useful commands:

- efl effort context --effort ${effort.shortRef}
- efl task list --effort ${effort.shortRef}
- efl task checkpoint --task task-1 --body "..."
- efl input request --effort ${effort.shortRef} --type text --prompt "..."

Keep durable decisions, checkpoints, and handoff notes in Effortless.

## Context

${context}
`
}

function commandPath(profile: AgentProfile, filePath: string): string {
  if (profile.environment !== 'wsl') return filePath
  return toWslPath(filePath)
}

function toWslPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const driveMatch = /^([A-Za-z]):\/(.*)$/.exec(normalized)
  if (!driveMatch) return normalized
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
}

function heading(title: string, body: string | Array<string | null>): string {
  const text = Array.isArray(body) ? body.filter(Boolean).join('\n') : body
  return `## ${title}\n\n${text}`.trim()
}
