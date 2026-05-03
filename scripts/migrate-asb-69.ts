import { openDatabase, bumpAppState } from '../core/db'

const db = openDatabase()
const now = new Date().toISOString()

const title = 'semantic aliases (ASB job 69)'

const existing = db.prepare<{ id: number; short_ref: string }>(
  `SELECT id, short_ref FROM efforts WHERE title = ?`,
).get(title)

if (existing) {
  console.log(`${existing.short_ref} already exists`)
  process.exit(0)
}

const repoId = ensureRepo()
const effortId = insertEffort()
const planId = insertPlan()
const taskId = insertTask()
const review1Id = insertReview(
  taskId,
  'request-changes',
  'review-prop-variants-72',
  `## Verdict

Request Changes

The schema-variant extractor is close, but it misses one approved-plan requirement in a way that can duplicate indexed terms and change document hashes unnecessarily.

## Must Fix

ToolSchemaPropertyVariantExtractor dedupes with a case-sensitive comparer, so composed schemas that surface the same logical property with different casing can index duplicate raw terms and churn content hashes. Tighten dedupe to be case-insensitive and add regression coverage.`,
  `- verdict: REQUEST CHANGES
- blocking: change ToolSchemaPropertyVariantExtractor dedupe to be case-insensitive and add regression coverage; equivalent properties that differ only by casing can both be indexed, adding duplicate schema terms and content-hash churn contrary to the approved plan
- concern: tests pass locally, but there is no assertion covering the case-insensitive dedupe requirement
- scope: reviewed the code and tests added in the implementation task plus plan alignment; Azure Search retrieval/regression workflows were outside this pass`,
)
const review2Id = insertReview(
  taskId,
  'approve',
  'review-prop-variants-73',
  `## Verdict

Approve

The follow-up correctly restores case-insensitive schema-term dedupe and adds focused regression coverage for casing-only duplicate properties. The implementation is aligned with the approved minimal-first plan and is ready to merge after the normal conflict check.`,
  `- verdict: APPROVE
- scope: reviewed ToolSchemaPropertyVariantExtractor, targeted tests, and local test/build output
- caveat: Azure Search end-to-end retrieval/regression workflows were not rerun in this review pass`,
)

db.prepare(`UPDATE efforts SET accepted_plan_id = ?, updated_at = ? WHERE id = ?`).run(planId, now, effortId)

insertDiscussion(effortId, 'orch-69', 'Decomposed ASB job #69 into an accepted plan, one accepted implementation task, and two review passes.')
insertDiscussion(effortId, 'orch-69', 'Created second-pass review for the implementation after requested changes were applied.')

insertTaskComment(taskId, 'impl-prop-variants-71', 'checkpoint', 'Implemented ToolSchemaPropertyVariantExtractor, appended schema terms into the full-text/filter-text path, added focused test coverage, and committed the changes.')
insertTaskComment(taskId, 'review-prop-variants-72', 'comment', 'Review requested changes: dedupe schema terms case-insensitively and add regression coverage for casing-only duplicate properties.')
insertTaskComment(taskId, 'orch-69', 'comment', 'Sent the implementation task back through the same branch/worktree for the requested review fix.')
insertTaskComment(taskId, 'impl-prop-variants-71', 'checkpoint', 'Addressed review findings: schema terms now dedupe case-insensitively, regression coverage was added, and build/tests passed.')
insertTaskComment(taskId, null, 'approval', 'lgtm')

insertPlanComment(planId, 'orch-69', 'comment', 'Planning guidance: use the supplied ToolSchemaPropertyVariantExtractor design as the baseline and refine it against local main.')
insertPlanComment(planId, 'plan-prop-variants-70', 'comment', 'Drafted the minimal-first plan: extractor plus FilterText enrichment, keeping DiscoveryQueryNormalizer exception-only.')
insertPlanComment(planId, null, 'approval', 'accepted')

insertReference('effort', effortId, 'plan', planId, 'approved plan')
insertReference('effort', effortId, 'task', taskId, 'approved implementation')
insertReference('task', taskId, 'effort', effortId, 'goal')
insertReference('task', taskId, 'plan', planId, 'approved plan')
insertReference('task', taskId, 'review', review1Id, 'requested changes review')
insertReference('task', taskId, 'review', review2Id, 'accepted review')
insertReference('review', review1Id, 'task', taskId, 'impl job under review')
insertReference('review', review1Id, 'plan', planId, 'approved plan')
insertReference('review', review2Id, 'task', taskId, 'impl job under review')
insertReference('review', review2Id, 'plan', planId, 'approved plan')
insertReference('review', review2Id, 'review', review1Id, 'prior review')

bumpAppState(db)

console.log(`created effort eff-${effortId}`)
console.log(`created plan plan-${planId}`)
console.log(`created task task-${taskId}`)
console.log(`created reviews rev-${review1Id}, rev-${review2Id}`)

function ensureRepo(): number {
  const existingRepo = db.prepare<{ id: number }>(`SELECT id FROM repos WHERE name = ?`).get('MCPTester')
  if (existingRepo) return existingRepo.id

  const result = db.prepare(`
    INSERT INTO repos (short_ref, name, path, base_branch, build_command, created_at, updated_at)
    VALUES (NULL, ?, ?, ?, ?, ?, ?)
  `).run('MCPTester', 'C:\\Users\\thebert\\source\\repos\\MCPTester', 'feature/semantic-aliases', 'dotnet test MCPTester.sln', now, now)
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE repos SET short_ref = ? WHERE id = ?`).run(`repo-${id}`, id)
  return id
}

function insertEffort(): number {
  const result = db.prepare(`
    INSERT INTO efforts (short_ref, title, description, template, accepted_plan_id, plan_requires_review, needs_tasks, status, summary, created_at, updated_at)
    VALUES (NULL, ?, ?, 'delivery', NULL, 1, 1, 'active', ?, ?, ?)
  `).run(
    title,
    `Migrate ASB job #69 semantic aliases into Effortless as a comparison fixture for orchestrator, plan, task, and review contexts.`,
    `- completed: Delivered ToolSchemaPropertyVariantExtractor planning, implementation, and review flow, resulting in schema-derived property variants being indexed for tool discovery while keeping DiscoveryQueryNormalizer as an exceptions-only layer.
- impl: The implementation task is approved and ready for merge into feature/semantic-aliases.
- decisions: Shipped the minimal-first rollout through the existing indexed text path, preserved query normalizer exception rules, and corrected schema-term dedupe to be case-insensitive after the first review cycle.`,
    now,
    now,
  )
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE efforts SET short_ref = ? WHERE id = ?`).run(`eff-${id}`, id)
  return id
}

function insertPlan(): number {
  const body = `## Approach

Add a schema-driven property-variant extractor that works from each runtime tool's InputSchema JSON, then feed its output into the existing FilterText path during sync. This keeps new vocabulary attached to the correct tool, reuses current weighting/embedding/index-sync plumbing, and avoids turning DiscoveryQueryNormalizer into a broad rewrite engine.

## Tasks

1. Add ToolSchemaPropertyVariantExtractor near existing schema text helpers.
2. Emit case-insensitive distinct variants per property: raw schema name, spaced/natural phrase, and compact phrase.
3. Skip obvious wrappers and qualify generic nested leaves such as id/name/status/type when useful.
4. Append extractor output to ToolRepresentationBuilder.BuildFilterHints.
5. Keep DiscoveryQueryNormalizer exception-only.
6. Add focused extractor and representation tests.
7. Run retrieval regression checks and extend the query set only if coverage is missing.

## Risks

- Generic nested property names can add noise if qualification rules are too permissive.
- InputSchema must be consumed defensively from serialized JSON.
- Existing regression data may under-cover natural schema phrases beyond tract type.`

  const summary = `- approach: derive schema property variants from each tool's runtime InputSchema and append them to the existing FilterText/indexing path so natural phrases like tract type are attached to the correct tool
- decision: reuse FilterText for the first rollout instead of adding a new Azure Search field
- assumption: keep DiscoveryQueryNormalizer exception-only and leave existing tract type/site id rules in place until regression evidence says they can be removed safely
- risk: nested generic names can create noisy variants unless wrapper-suppression and parent-qualification heuristics stay tight`

  const result = db.prepare(`
    INSERT INTO plans (short_ref, effort_id, body, summary, author_agent_id, created_at, ready_at, accepted_at)
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(effortId, body, summary, 'plan-prop-variants-70', now, now, now)
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE plans SET short_ref = ? WHERE id = ?`).run(`plan-${id}`, id)
  return id
}

function insertTask(): number {
  const result = db.prepare(`
    INSERT INTO tasks (
      short_ref, effort_id, title, description, status, owner_agent_id, repo_id, branch_name,
      base_branch, worktree_path, requires_review, review_requires_review, auto_merge,
      conflicted_at, conflict_details, merged_at, handoff_summary, artifact, created_at, updated_at
    )
    VALUES (NULL, ?, ?, ?, 'accepted', ?, ?, ?, ?, ?, 1, 1, 0, NULL, NULL, NULL, ?, ?, ?, ?)
  `).run(
    effortId,
    'Implement ToolSchemaPropertyVariantExtractor',
    'Implement the approved plan: add ToolSchemaPropertyVariantExtractor, enrich indexed text with schema-derived variants, preserve DiscoveryQueryNormalizer as exceptions-only, and add targeted tests in MCPTester.',
    'impl-prop-variants-71',
    repoId,
    'agent/tool-schema-property-variants',
    'feature/semantic-aliases',
    'C:\\Users\\Tyler\\Documents\\projects\\.git-worktrees\\agent\\tool-schema-property-variants',
    `- built: fixed ToolSchemaPropertyVariantExtractor so schema-derived terms dedupe case-insensitively, preventing duplicate indexed aliases and content-hash churn while keeping schema-term indexing in place
- decision: aligned expectations with the extractor's real output shape under case-insensitive dedupe
- caveat: schema signal still lives in aggregated FullText/Schema terms rather than a dedicated search field`,
    `## What was built

Tool indexing now learns schema property aliases from each tool's input schema without duplicating terms that differ only by casing.

- ToolSchemaPropertyVariantExtractor walks runtime schema JSON across properties, arrays, and composition nodes.
- The extractor emits raw and naturalized variants while suppressing wrapper-only names.
- Generic nested leaves are qualified when useful.
- Schema terms are appended into the existing indexed text path.
- Focused tests cover casing-only duplicate properties and representative schema shapes.

## Validation

- dotnet test MCPTester.sln passed.
- agentboard build passed in the source ASB run.`,
    now,
    now,
  )
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE tasks SET short_ref = ? WHERE id = ?`).run(`task-${id}`, id)
  return id
}

function insertReview(
  taskId: number,
  verdict: string,
  agentId: string,
  body: string,
  summary: string,
): number {
  const result = db.prepare(`
    INSERT INTO reviews (short_ref, task_id, verdict, body, summary, author_agent_id, created_at, applied_at)
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
  `).run(taskId, verdict, body, summary, agentId, now, now)
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE reviews SET short_ref = ? WHERE id = ?`).run(`rev-${id}`, id)
  return id
}

function insertDiscussion(effortId: number, agentId: string, body: string): void {
  db.prepare(`
    INSERT INTO discussion_messages (effort_id, author, agent_id, body, created_at)
    VALUES (?, 'agent', ?, ?, ?)
  `).run(effortId, agentId, body, now)
}

function insertTaskComment(taskId: number, agentId: string | null, kind: string, body: string): void {
  db.prepare(`
    INSERT INTO task_comments (task_id, author, agent_id, kind, body, commit_hash, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `).run(taskId, agentId ? 'agent' : 'user', agentId, kind, body, now)
}

function insertPlanComment(planId: number, agentId: string | null, kind: string, body: string): void {
  db.prepare(`
    INSERT INTO plan_comments (plan_id, author, agent_id, kind, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(planId, agentId ? 'agent' : 'user', agentId, kind, body, now)
}

function insertReference(
  ownerType: string,
  ownerId: number,
  targetType: string,
  targetId: number,
  label: string,
): void {
  const result = db.prepare(`
    INSERT INTO "references" (short_ref, owner_type, owner_id, target_type, target_id, file_path, label, created_at)
    VALUES (NULL, ?, ?, ?, ?, NULL, ?, ?)
  `).run(ownerType, ownerId, targetType, targetId, label, now)
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE "references" SET short_ref = ? WHERE id = ?`).run(`ref-${id}`, id)
}
