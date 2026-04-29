#!/usr/bin/env -S node --import tsx
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase } from '../core/db'
import { getAppPaths } from '../core/appPaths'
import { createDiscussionMessage } from '../core/discussion'
import { acceptPlan, createPlan, markPlanReady, requestPlanChanges } from '../core/plans'
import { applyReview, submitReview } from '../core/reviews'
import { checkpointTask, createTask, markTaskReady, updateTaskDetails } from '../core/tasks'
import { answerInputRequest, createInputRequest } from '../core/inputs'
import { createMandate } from '../core/mandates'
import { createReference } from '../core/references'
import { createRepo } from '../core/repos'
import { worktreePath } from '../core/git'
import type { AppDatabase } from '../core/db'
import type { Effort, Plan, Repo, Task } from '../core/types'

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
    seedMandates(db, repos)
    const discussionEffort = seedDiscussionEffort(db)
    const investigationEffort = seedInvestigationEffort(db)
    const bugfixEffort = await seedBugfixEffort(db, repos)
    const deliveryEffort = await seedDeliveryEffort(db, repos)

    seedReferences(db, deliveryEffort, bugfixEffort)

    touchEffort(db, deliveryEffort.id)

    console.log('seed complete')
    console.log(`db ${paths.databasePath}`)
    console.log(`effort ${deliveryEffort.shortRef} delivery demo`)
    console.log(`effort ${bugfixEffort.shortRef} bugfix demo`)
    console.log(`effort ${investigationEffort.shortRef} investigation demo`)
    console.log(`effort ${discussionEffort.shortRef} discussion demo`)
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

function seedDiscussionEffort(db: AppDatabase): Effort {
  const effort = insertEffort(db, {
    title: 'choose initial notification defaults',
    description:
      'Decide which notification channels should ship enabled in the first install experience.',
    template: 'discussion',
    planRequiresReview: false,
    needsTasks: false,
    summary: 'Default notification posture: banner + badge. Sound remains opt-in.',
  })

  createDiscussionMessage(db, {
    effortId: effort.id,
    author: 'agent',
    agentId: 'planner-peer',
    body: 'I see three sensible defaults: banner only, banner plus sound, or all channels off.',
  })
  createDiscussionMessage(db, {
    effortId: effort.id,
    author: 'user',
    body: 'I want something noticeable but not annoying for first launch.',
  })
  createDiscussionMessage(db, {
    effortId: effort.id,
    author: 'agent',
    agentId: 'planner-peer',
    body: 'Banner plus badge looks like the safest initial posture. Sound can remain opt-in.',
  })

  const input = createInputRequest(db, {
    effortId: effort.id,
    agentId: 'planner-peer',
    type: 'choice',
    prompt: 'Which default notification posture should effortless use?',
    choices: [
      { value: 'banner-badge', label: 'banner + badge' },
      { value: 'banner-only', label: 'banner only' },
      { value: 'all-off', label: 'all off' },
    ],
  })
  answerInputRequest(db, {
    inputRequestId: input.id,
    answer: 'banner + badge',
  })

  return effort
}

function seedInvestigationEffort(db: AppDatabase): Effort {
  const effort = insertEffort(db, {
    title: 'investigate CLI packaging overhead',
    description:
      'Profile why the CLI bundle grew after adding mandate and reference commands. Identify low-hanging reductions.',
    template: 'investigation',
    planRequiresReview: true,
    needsTasks: false,
    summary: 'Eager module loading is the primary overhead. Recommend lazy imports and splitting render.ts by domain.',
  })

  createDiscussionMessage(db, {
    effortId: effort.id,
    author: 'agent',
    agentId: 'planner-1',
    body: 'I will start with a bundle size baseline, then look at lazy-loading opportunities for the command modules.',
  })

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
    authorAgentId: 'planner-1',
  })

  markPlanReady(db, plan.id)

  const input = createInputRequest(db, {
    planId: plan.id,
    agentId: 'planner-1',
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
  const effort = insertEffort(db, {
    title: 'fix dropped reattach guidance after wait interruptions',
    description:
      'Agents should always see the reattach command and end-turn warning when an approval wait is interrupted.',
    template: 'bugfix',
    planRequiresReview: false,
    needsTasks: true,
    summary: 'Restored reattach output for task, review, and input wait interruptions. Build currently failing due to copy mismatch.',
  })

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
    handoffSummary:
      'The interruption path now funnels through the same render helper as the live wait loop.',
    artifact:
      'terminal transcript\n- task wait interrupted\n- review wait interrupted\n- input wait interrupted',
  })
  attachTaskWorkspace(db, task, repos.effortlessRepo, 'impl-hotfix', 'in-flight')
  checkpointTask(db, {
    taskId: task.id,
    agentId: 'impl-hotfix',
    body: 'Reproduced the missing guidance path when SIGINT lands between poll iterations.',
  })

  createInputRequest(db, {
    taskId: task.id,
    agentId: 'impl-hotfix',
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
  const effort = insertEffort(db, {
    title: 'stabilize review orchestration',
    description:
      'Tighten the plan, task, review, and input loops so agents and humans see a consistent handoff model.',
    template: 'delivery',
    planRequiresReview: true,
    needsTasks: true,
    summary: 'Plan review flow, repo-backed task detail, and input requests are all wired. One task accepted, one task returned for changes, one task waiting for human review.',
  })

  createDiscussionMessage(db, {
    effortId: effort.id,
    author: 'agent',
    agentId: 'planner-1',
    body: 'I think the highest-value slice is plan review, then repo-backed task detail, then input requests.',
  })
  createDiscussionMessage(db, {
    effortId: effort.id,
    author: 'user',
    body: 'Keep the workflow plain. I care more about clear handoffs than maximum flexibility.',
  })
  createDiscussionMessage(db, {
    effortId: effort.id,
    author: 'agent',
    agentId: 'planner-1',
    body: 'Understood. I am keeping the state model local to the thing being reviewed rather than adding another orchestrator layer.',
  })

  const firstPlan = createPlan(db, {
    effortId: effort.id,
    authorAgentId: 'planner-1',
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
    planId: firstPlan.id,
    agentId: 'planner-1',
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
    authorAgentId: 'planner-1',
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
    handoffSummary:
      'Plan submissions now have ready and accepted timestamps plus a plan comment stream for feedback.',
    artifact:
      'screens checked\n- accepted plan visible\n- changes requested plan visible\n- plan wait responds to approval and feedback',
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
    agentId: 'impl-plan',
    type: 'text',
    prompt: 'Should the plan history show timestamps inline or stay terse?',
  })
  answerInputRequest(db, {
    inputRequestId: taskInput.id,
    answer: 'stay terse for now',
  })
  markTaskReady(db, acceptedTask.id)
  const acceptedReview = await submitReview(db, {
    taskId: acceptedTask.id,
    verdict: 'approve',
    body: 'Plan review flow is coherent and the wait path returns human feedback correctly.',
    authorAgentId: 'review-plan',
  })
  await applyReview(db, {
    reviewId: acceptedReview.id,
    commitHash: '6d6a2b19c2a94d1ca98755d4c99194bb8ef4fa19',
  })
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
    handoffSummary:
      'Repo metadata is visible, but the diff/commit/conflict tabs still need to be filled in.',
    artifact:
      'remaining\n- diff tab\n- commit tab\n- conflict tab',
  })
  attachTaskWorkspace(db, changesTask, changesRepo, 'impl-repo', 'in-flight')
  checkpointTask(db, {
    taskId: changesTask.id,
    agentId: 'impl-repo',
    body: 'Task overlay now shows repo metadata and latest build state.',
  })
  markTaskReady(db, changesTask.id)
  const rejectedReview = await submitReview(db, {
    taskId: changesTask.id,
    verdict: 'request-changes',
    body: 'The task detail card still needs diff and commit views before this is complete.',
    authorAgentId: 'review-repo',
  })
  const reviewInput = createInputRequest(db, {
    reviewId: rejectedReview.id,
    agentId: 'review-repo',
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
    handoffSummary:
      'The seed script should reset the local DB, create fixtures, and print the key effort refs.',
    artifact:
      'fixture targets\n- discussion\n- plans with feedback\n- accepted and rejected reviews\n- pending input request',
  })
  attachTaskWorkspace(db, waitingTask, repos.effortlessRepo, 'impl-seed', 'in-flight')
  checkpointTask(db, {
    taskId: waitingTask.id,
    agentId: 'impl-seed',
    body: 'Sketching a reset-and-seed flow that does not mutate real git worktrees.',
  })
  markTaskReady(db, waitingTask.id)
  createInputRequest(db, {
    effortId: effort.id,
    taskId: waitingTask.id,
    agentId: 'impl-seed',
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

function insertEffort(
  db: AppDatabase,
  input: {
    title: string
    description: string
    template: Effort['template']
    planRequiresReview: boolean
    needsTasks: boolean
    summary?: string
  },
): Effort {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO efforts (
        title, description, template, accepted_plan_id, plan_requires_review, needs_tasks, status, summary, created_at, updated_at
      )
      VALUES (?, ?, ?, NULL, ?, ?, 'active', ?, ?, ?)
    `,
    )
    .run(input.title, input.description, input.template, input.planRequiresReview ? 1 : 0, input.needsTasks ? 1 : 0, input.summary ?? null, now, now)

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE efforts SET short_ref = ? WHERE id = ?`).run(`eff-${id}`, id)
  return getEffortRecord(db, id)
}

function getEffortRecord(db: AppDatabase, effortId: number): Effort {
  const row = db
    .prepare<{
      id: number
      short_ref: string
      title: string
      description: string
      template: Effort['template']
      accepted_plan_id: number | null
      plan_requires_review: number
      needs_tasks: number
      status: Effort['status']
      summary: string | null
      created_at: string
      updated_at: string
    }>(`SELECT * FROM efforts WHERE id = ?`)
    .get(effortId)

  if (!row) {
    throw new Error(`Effort ${effortId} was not found`)
  }

  return {
    id: row.id,
    shortRef: row.short_ref,
    title: row.title,
    description: row.description,
    template: row.template,
    acceptedPlanId: row.accepted_plan_id,
    planRequiresReview: Boolean(row.plan_requires_review),
    needsTasks: Boolean(row.needs_tasks),
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function attachTaskWorkspace(
  db: AppDatabase,
  task: Task,
  repo: Repo,
  ownerAgentId: string,
  status: Task['status'],
) {
  const resolvedWorktreePath = worktreePath(repo.path, task.branchName ?? `task/${task.shortRef}`)

  db.prepare(
    `
    UPDATE tasks
    SET owner_agent_id = ?,
        status = ?,
        worktree_path = ?,
        updated_at = ?
    WHERE id = ?
  `,
  ).run(ownerAgentId, status, resolvedWorktreePath, new Date().toISOString(), task.id)

  db.prepare(
    `
    INSERT INTO task_comments (task_id, author, agent_id, kind, body, commit_hash, created_at)
    VALUES (?, 'agent', ?, 'comment', ?, NULL, ?)
  `,
  ).run(task.id, ownerAgentId, `claimed by ${ownerAgentId}`, new Date().toISOString())
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

function seedMandates(db: AppDatabase, repos: { effortlessRepo: Repo; agentsyncboardRepo: Repo | null }) {
  createMandate(db, {
    workSurface: 'task',
    sourceType: 'body',
    body: 'Always write tests for new features. Keep changes minimal and focused. Use conventional commit messages.',
  })

  createMandate(db, {
    workSurface: 'plan',
    sourceType: 'body',
    body: 'Plans should be numbered step lists. Each step should be a single concrete action. Include rollback notes for any risky step.',
  })

  createMandate(db, {
    workSurface: 'review',
    sourceType: 'body',
    body: 'Focus reviews on correctness and completeness. Note any missing edge cases. Approve only when the task criteria are fully met.',
  })

  createMandate(db, {
    workSurface: 'effort',
    sourceType: 'body',
    body: 'Frame each effort with a clear scope and done criteria. Prefer narrow efforts that ship over broad ones that stall.',
  })

  createMandate(db, {
    workSurface: 'discussion',
    sourceType: 'body',
    body: 'Keep discussion focused on aligning on direction before planning begins. Summarize conclusions clearly.',
  })

  if (repos.agentsyncboardRepo) {
    createMandate(db, {
      workSurface: 'task',
      repoId: repos.agentsyncboardRepo.id,
      sourceType: 'body',
      body: 'For agentsyncboard changes, run the full client build before marking ready. Check WebSocket reconnection paths.',
    })
  }
}

function seedReferences(db: AppDatabase, deliveryEffort: Effort, bugfixEffort: Effort) {
  const deliveryTasks = db
    .prepare<{ id: number; effort_id: number }>(`SELECT id, effort_id FROM tasks WHERE effort_id = ?`)
    .all(deliveryEffort.id) as { id: number; effort_id: number }[]

  const acceptedPlanRows = db
    .prepare<{ id: number }>(`SELECT id FROM plans WHERE effort_id = ? AND accepted_at IS NOT NULL`)
    .all(deliveryEffort.id) as { id: number }[]

  if (acceptedPlanRows.length > 0 && deliveryTasks.length > 0) {
    createReference(db, {
      ownerType: 'task',
      ownerId: deliveryTasks[0].id,
      targetType: 'plan',
      targetId: acceptedPlanRows[0].id,
      label: 'accepted plan',
    })
  }

  createReference(db, {
    ownerType: 'effort',
    ownerId: deliveryEffort.id,
    targetType: 'file',
    filePath: '/docs/review-orchestration.md',
    label: 'review orchestration notes',
  })

  createReference(db, {
    ownerType: 'effort',
    ownerId: bugfixEffort.id,
    targetType: 'effort',
    targetId: deliveryEffort.id,
    label: 'related delivery effort',
  })
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
