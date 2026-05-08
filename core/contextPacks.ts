import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getAppPaths } from './appPaths'
import type { AppDatabase } from './db'
import { getEffort } from './efforts'
import { listInputRequests } from './inputs'
import { resolveMandateText } from './mandates'
import { listPlans } from './plans'
import { getRepo } from './repos'
import { listTaskComments } from './tasks'
import type { AgentProfile, AgentRun, Task } from './types'

export type PreparedTaskRunContext = {
  runDir: string
  contextPath: string
  bootstrapPath: string
  transcriptPath: string
}

export async function writeTaskRunContext(
  db: AppDatabase,
  run: AgentRun,
  task: Task,
  profile: AgentProfile,
): Promise<PreparedTaskRunContext> {
  const paths = getRunPaths(run.shortRef)
  await mkdir(paths.runDir, { recursive: true })
  await writeFile(paths.contextPath, renderTaskContext(db, task), 'utf-8')
  await writeFile(paths.bootstrapPath, renderTaskBootstrap(db, run, task, profile, paths.contextPath), 'utf-8')
  await writeFile(paths.transcriptPath, '', { flag: 'a' })
  return paths
}

export function getRunPaths(runRef: string): PreparedTaskRunContext {
  const runDir = path.join(getAppPaths().home, 'runs', runRef)
  return {
    runDir,
    contextPath: path.join(runDir, 'context.md'),
    bootstrapPath: path.join(runDir, 'bootstrap.md'),
    transcriptPath: path.join(runDir, 'transcript.txt'),
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
      ? comments.slice(-12).map((comment) => `${comment.createdAt} ${comment.kind} ${comment.agentId ?? comment.author}: ${comment.body}`).join('\n\n')
      : 'No task comments yet.'),
  ]

  return sections.filter(Boolean).join('\n\n').trimEnd() + '\n'
}

function renderTaskBootstrap(
  db: AppDatabase,
  run: AgentRun,
  task: Task,
  profile: AgentProfile,
  contextPath: string,
): string {
  const effort = getEffort(db, task.effortId)
  return `# Effortless Run Bootstrap

You are running inside Effortless.

Read the context file before making changes:

${contextPath}

Current run:

- run: ${run.shortRef}
- label: ${run.label}
- purpose: ${run.purpose}
- profile: ${profile.shortRef} ${profile.name}
- effort: ${effort.shortRef}
- task: ${task.shortRef}
- cwd: ${run.cwd}

Use Effortless CLI updates as durable state:

- efl task checkpoint --task ${task.shortRef} --agent ${run.label} --body "..."
- efl task artifact --task ${task.shortRef} --agent ${run.label} --body "..."
- efl input request --task ${task.shortRef} --agent ${run.label} --type text --prompt "..."
- efl build run --task ${task.shortRef}
- efl task ready --task ${task.shortRef}

Keep the terminal transcript useful, but put durable decisions, checkpoints, and handoff notes into Effortless.
`
}

function heading(title: string, body: string | Array<string | null>): string {
  const text = Array.isArray(body) ? body.filter(Boolean).join('\n') : body
  return `## ${title}\n\n${text}`.trim()
}
