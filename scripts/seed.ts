#!/usr/bin/env -S node --import tsx
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../core/db'
import { getAppPaths } from '../core/appPaths'
import { acceptPlan, createPlan, markPlanReady, requestPlanChanges } from '../core/plans'
import { applyReview, submitReview } from '../core/reviews'
import {
  addTaskComment,
  checkpointTask,
  createTask,
  markTaskReady,
  updateTaskStatus,
  updateTaskDetails,
} from '../core/tasks'
import { answerInputRequest, createInputRequest } from '../core/inputs'
import { setInstructions } from '../core/instructions'
import { createRepo } from '../core/repos'
import { createEffort, updateEffortStatus, updateEffortSummary } from '../core/efforts'
import { worktreePath } from '../core/git'
import type { AppDatabase } from '../core/db'
import type { Effort, Repo, Task } from '../core/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const siblingProjectsRoot = path.resolve(repoRoot, '..')

async function main() {
  const replace = process.argv.includes('--replace')
  const paths = getAppPaths()

  if (fs.existsSync(paths.databasePath) && !replace) {
    throw new Error(
      `Database already exists at ${paths.databasePath}. Re-run with --replace to overwrite it.`,
    )
  }

  if (replace) {
    resetDatabase(paths.databasePath)
  }

    const db = openDatabase()

  try {
    const repos = seedRepos(db)
    seedInstructions(db, repos)
    const investigationEffort = seedInvestigationEffort(db)
    const bugfixEffort = await seedBugfixEffort(db, repos)
    const deliveryEffort = await seedDeliveryEffort(db, repos)

    touchEffort(db, deliveryEffort.id)

    console.log('seed complete')
    console.log(`db ${paths.databasePath}`)
    console.log(`effort ${deliveryEffort.shortRef} delivery demo`)
    console.log(`effort ${bugfixEffort.shortRef} bugfix demo`)
    console.log(`effort ${investigationEffort.shortRef} investigation demo`)
  } finally {
    db.close()
  }
}

function resetDatabase(databasePath: string) {
  for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true })
    }
  }
}

function seedRepos(db: AppDatabase): { effortlessRepo: Repo; agentsyncboardRepo: Repo | null } {
  const effortlessRepo = createRepo(db, {
    name: 'effortless',
    path: repoRoot,
    baseBranch: 'main',
    buildCommand: 'bun run build',
  })

  const agentboardPath = path.join(siblingProjectsRoot, 'agentsyncboard')
  const agentsyncboardRepo = fs.existsSync(agentboardPath)
    ? createRepo(db, {
        name: 'agentsyncboard',
        path: agentboardPath,
        baseBranch: 'main',
        buildCommand: 'bun run --cwd client build',
      })
    : null

  return { effortlessRepo, agentsyncboardRepo }
}

function seedInvestigationEffort(db: AppDatabase): Effort {
  const effort = createEffort(db, {
    title: 'investigate CLI packaging overhead',
    description:
      'Profile why the CLI bundle grew after adding instructions commands. Identify low-hanging reductions.',
    template: 'investigation',
  })
  updateEffortSummary(
    db,
    effort.id,
    'Eager module loading is the primary overhead. Recommend lazy imports and splitting render.ts by domain.',
  )

  const plan = createPlan(db, {
    effortId: effort.id,
    body: `Findings:
- Command modules are eagerly loaded even when only one surface is invoked.
- render.ts pulls in all core types even for commands that do not print them.
- Duplicate plan helpers exist in both core/plans.ts and cli/src/render.ts.

Recommendations:
- Lazy-import command modules in the dispatcher.
- Split render.ts into per-domain renderers.
- Extract shared planState into a core helper.
`,
  })

  markPlanReady(db, plan.id)

  const input = createInputRequest(db, {
    effortId: effort.id,
    type: 'choice',
    prompt: 'Which recommendation should we implement first?',
    choices: [
      { value: 'lazy-commands', label: 'Lazy-import command modules' },
      { value: 'split-render', label: 'Split render.ts by domain' },
      { value: 'shared-helper', label: 'Extract shared planState helper' },
    ],
  })

  answerInputRequest(db, {
    inputRequestId: input.id,
    answer: 'lazy-commands',
  })

  return effort
}

async function seedBugfixEffort(
  db: AppDatabase,
  repos: { effortlessRepo: Repo; agentsyncboardRepo: Repo | null },
): Promise<Effort> {
  const effort = createEffort(db, {
    title: 'fix dropped reattach guidance after wait interruptions',
    description:
      'Agents should always see the reattach command and end-turn warning when an approval wait is interrupted.',
    template: 'bugfix',
  })
  updateEffortSummary(
    db,
    effort.id,
    'Restored reattach output for task, review, and input wait interruptions. Build currently failing due to copy mismatch.',
  )

  const task = createTask(db, {
    effortId: effort.id,
    title: 'restore reattach output for interrupted waits',
    description: 'Reproduce the dropped guidance path and restore the exact terminal copy.',
    repoId: repos.effortlessRepo.id,
    branchName: 'task/task-reattach-copy',
    baseBranch: repos.effortlessRepo.baseBranch,
  })

  updateTaskDetails(db, {
    taskId: task.id,
    repoId: repos.effortlessRepo.id,
    branchName: 'task/task-reattach-copy',
    baseBranch: repos.effortlessRepo.baseBranch,
    artifact:
      'The interruption path now funnels through the same render helper as the live wait loop.\n\nterminal transcript\n- task wait interrupted\n- review wait interrupted\n- input wait interrupted',
  })
  attachTaskWorkspace(db, task, repos.effortlessRepo, 'impl-hotfix', 'in-flight')
  checkpointTask(db, {
    taskId: task.id,
    agentId: 'impl-hotfix',
    body: 'Reproduced the missing guidance path when SIGINT lands between poll iterations.',
  })

  createInputRequest(db, {
    taskId: task.id,
    type: 'text',
    prompt: 'Do you want the interrupted copy to remain identical across task, plan, review, and input waits?',
  })

  insertBuildResult(db, task.id, 'failed', [
    '$ bun run build',
    'task wait copy mismatch',
    'Expected exact reattach hint after interruption',
  ])

  return effort
}

async function seedDeliveryEffort(
  db: AppDatabase,
  repos: { effortlessRepo: Repo; agentsyncboardRepo: Repo | null },
): Promise<Effort> {
  const effort = createEffort(db, {
    title: 'stabilize review orchestration',
    description:
      'Tighten the plan, task, review, and input loops so agents and humans see a consistent artifact model.',
    template: 'delivery',
  })
  updateEffortSummary(
    db,
    effort.id,
    'Plan review flow, repo-backed task detail, and input requests are all wired. One task accepted, one task returned for changes, one task waiting for human review.',
  )
  updateEffortStatus(db, effort.id, 'complete')

  const firstPlan = createPlan(db, {
    effortId: effort.id,
    body: [
      '1. Add plan ready/wait with a plan history stream.',
      '2. Bind tasks to repos and show real workspace state.',
      '3. Add input requests for plan, task, and review.',
    ].join('\n'),
    summary: 'first pass',
  })
  markPlanReady(db, firstPlan.id)
  requestPlanChanges(db, {
    planId: firstPlan.id,
    body: 'Break out the rollback story and be more explicit about build verification.',
  })
  const planInput = createInputRequest(db, {
    effortId: effort.id,
    type: 'choice',
    prompt: 'Which rollout should the revised plan assume?',
    choices: [
      { value: 'narrow', label: 'narrow slice first' },
      { value: 'broad', label: 'broader parallel push' },
    ],
  })
  answerInputRequest(db, {
    inputRequestId: planInput.id,
    answer: 'narrow slice first',
  })

  const acceptedPlan = createPlan(db, {
    effortId: effort.id,
    body: [
      '1. Land plan review flow with feedback history and strict wait ergonomics.',
      '2. Bind tasks to repos and surface worktree/build state in the task card.',
      '3. Add input requests and feed answers back into plan/task/review history.',
      '4. Seed the full demo database after those surfaces are stable.',
    ].join('\n'),
    summary: 'approved plan',
  })
  markPlanReady(db, acceptedPlan.id)
  acceptPlan(db, acceptedPlan.id)

  const acceptedTask = createTask(db, {
    effortId: effort.id,
    title: 'wire plan review loop',
    description: 'Add plan ready, wait, feedback, and acceptance history.',
    repoId: repos.effortlessRepo.id,
    branchName: 'task/plan-review-loop',
    baseBranch: repos.effortlessRepo.baseBranch,
  })
  updateTaskDetails(db, {
    taskId: acceptedTask.id,
    repoId: repos.effortlessRepo.id,
    branchName: 'task/plan-review-loop',
    baseBranch: repos.effortlessRepo.baseBranch,
    artifact:
      'Plan submissions now have ready and accepted timestamps plus a plan comment stream for feedback.\n\nscreens checked\n- accepted plan visible\n- changes requested plan visible\n- plan wait responds to approval and feedback',
  })
  attachTaskWorkspace(db, acceptedTask, repos.effortlessRepo, 'impl-plan', 'in-flight')
  checkpointTask(db, {
    taskId: acceptedTask.id,
    agentId: 'impl-plan',
    body: 'Added plan review state and CLI wait behavior.',
  })
  checkpointTask(db, {
    taskId: acceptedTask.id,
    agentId: 'impl-plan',
    body: 'UI now shows accepted, waiting, and changes-requested plan drafts.',
  })
  const taskInput = createInputRequest(db, {
    taskId: acceptedTask.id,
    type: 'text',
    prompt: 'Should the plan history show timestamps inline or stay terse?',
  })
  answerInputRequest(db, {
    inputRequestId: taskInput.id,
    answer: 'stay terse for now',
  })
  await markTaskReady(db, acceptedTask.id)
  await submitReview(db, {
    taskId: acceptedTask.id,
    verdict: 'approve',
    body: 'Plan review flow is coherent and the wait path returns human feedback correctly.',
  })
  acceptSeedReview(db, acceptedTask.id)
  insertBuildResult(db, acceptedTask.id, 'passed', [
    '$ bun run build',
    'renderer build complete',
    'electron package complete',
  ])

  const changesTask = createTask(db, {
    effortId: effort.id,
    title: 'bind task repo detail',
    description: 'Show repo, worktree, branch, and build state directly inside the task overlay.',
    repoId: repos.agentsyncboardRepo?.id ?? repos.effortlessRepo.id,
    branchName: 'task/repo-detail-surface',
    baseBranch: (repos.agentsyncboardRepo ?? repos.effortlessRepo).baseBranch,
  })
  const changesRepo = repos.agentsyncboardRepo ?? repos.effortlessRepo
  updateTaskDetails(db, {
    taskId: changesTask.id,
    repoId: changesRepo.id,
    branchName: 'task/repo-detail-surface',
    baseBranch: changesRepo.baseBranch,
    artifact:
      'Repo metadata is visible, but the diff/commit/conflict tabs still need to be filled in.\n\nremaining\n- diff tab\n- commit tab\n- conflict tab',
  })
  attachTaskWorkspace(db, changesTask, changesRepo, 'impl-repo', 'in-flight')
  checkpointTask(db, {
    taskId: changesTask.id,
    agentId: 'impl-repo',
    body: 'Task overlay now shows repo metadata and latest build state.',
  })
  await markTaskReady(db, changesTask.id)
  const rejectedReview = await submitReview(db, {
    taskId: changesTask.id,
    verdict: 'request-changes',
    body: 'The task detail card still needs diff and commit views before this is complete.',
  })
  const reviewInput = createInputRequest(db, {
    taskId: changesTask.id,
    type: 'yesno',
    prompt: 'Should missing diff and commit tabs block approval?',
  })
  answerInputRequest(db, {
    inputRequestId: reviewInput.id,
    answer: 'yes',
  })
  await applyReview(db, { reviewId: rejectedReview.id })
  insertBuildResult(db, changesTask.id, 'failed', [
    '$ bun run --cwd client build',
    'Missing task detail tabs: diff, commit',
    'Exit code 1',
  ])

  const waitingTask = createTask(db, {
    effortId: effort.id,
    title: 'seed full demo dataset',
    description: 'Build a one-command fixture loader that fills every visible surface with realistic data.',
    repoId: repos.effortlessRepo.id,
    branchName: 'task/demo-seed-loader',
    baseBranch: repos.effortlessRepo.baseBranch,
  })
  updateTaskDetails(db, {
    taskId: waitingTask.id,
    repoId: repos.effortlessRepo.id,
    branchName: 'task/demo-seed-loader',
    baseBranch: repos.effortlessRepo.baseBranch,
    artifact:
      'The seed script should reset the local DB, create fixtures, and print the key effort refs.\n\nfixture targets\n- plans with feedback\n- accepted and rejected reviews\n- pending input request',
  })
  attachTaskWorkspace(db, waitingTask, repos.effortlessRepo, 'impl-seed', 'in-flight')
  checkpointTask(db, {
    taskId: waitingTask.id,
    agentId: 'impl-seed',
    body: 'Sketching a reset-and-seed flow that does not mutate real git worktrees.',
  })
  await markTaskReady(db, waitingTask.id)
  createInputRequest(db, {
    effortId: effort.id,
    taskId: waitingTask.id,
    type: 'choice',
    prompt: 'Should the demo seed reset the default DB or require a dedicated flag?',
    choices: [
      { value: 'flag', label: 'require a dedicated flag' },
      { value: 'default', label: 'replace by default' },
    ],
  })
  insertBuildResult(db, waitingTask.id, 'running', ['$ bun run seed -- --replace', 'writing demo fixtures...'])

  return effort
}

function attachTaskWorkspace(
  db: AppDatabase,
  task: Task,
  repo: Repo,
  agentId: string,
  status: Task['status'],
) {
  const resolvedWorktreePath = worktreePath(repo.path, task.branchName ?? `task/${task.shortRef}`)

  db.prepare(
    `
    UPDATE tasks
    SET status = ?,
        worktree_path = ?,
        updated_at = ?
    WHERE id = ?
  `,
  ).run(status, resolvedWorktreePath, new Date().toISOString(), task.id)

  addTaskComment(db, task.id, 'agent', agentId, 'comment', `claimed by ${agentId}`)
}

function acceptSeedReview(db: AppDatabase, taskId: number) {
  addTaskComment(db, taskId, 'user', null, 'approval', 'lgtm')
  updateTaskStatus(db, taskId, 'accepted')
}

function insertBuildResult(
  db: AppDatabase,
  taskId: number,
  status: 'running' | 'passed' | 'failed',
  outputLines: string[],
) {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO task_build_results (task_id, status, output, triggered_at, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(taskId, status, outputLines.join('\n'), now, status === 'running' ? null : now)

  db.prepare(`UPDATE task_build_results SET short_ref = ? WHERE id = ?`).run(
    `build-${Number(result.lastInsertRowid)}`,
    Number(result.lastInsertRowid),
  )
}

function touchEffort(db: AppDatabase, effortId: number) {
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), effortId)
}

function seedInstructions(db: AppDatabase, repos: { effortlessRepo: Repo; agentsyncboardRepo: Repo | null }) {
  if (repos.agentsyncboardRepo) {
    setInstructions(db, {
      repoId: repos.agentsyncboardRepo.id,
      sourceType: 'body',
      body: 'For agentsyncboard changes, run the full client build before marking ready. Check WebSocket reconnection paths.',
    })
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
