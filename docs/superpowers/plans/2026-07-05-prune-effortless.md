# Prune Effortless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut effortless down to its value spine — remove the reference graph, collapse three instruction layers into one, simplify run purposes and the plan lifecycle, add positional-ref CLI sugar, and clean up the UI's metadata chips, git error states, and task work view.

**Architecture:** effortless is an Electron app (`electron/`), a React renderer (`src/`), a shared core layer (`core/`, better-sqlite3), and an `efl` CLI (`cli/`) that executes inside the app process via a local command server. All state flows through `core/*.ts` services; the renderer talks over IPC typed in `electron/preload.ts` + `src/vite-env.d.ts`; the CLI imports core directly. Every task here removes or reshapes one concept end-to-end across those four layers.

**Tech Stack:** TypeScript, React 18, Electron 30, better-sqlite3, Vite, bun.

## Global Constraints

- All work happens on branch `main-v2`. Commit after each task.
- UI labels are lowercase. No marketing/hero copy. (AGENTS.md)
- This is a pre-release, single-user, local app at version 0.0.0. **Destructive schema changes are acceptable**: dropping the `references`, `mandates`, and `template_playbooks` tables without data migration is the agreed approach. Defaults reseed on init.
- There is no test framework in this repo. Verification per task = `bunx tsc` (typecheck, same as the build's first step), `node scripts/build-cli.mjs` when CLI files changed, and `bunx vite build` when renderer files changed. Full `bun run build` runs once, in the final task (it includes electron-builder and is slow).
- Live smoke tests (CLI + UI screenshots) require the app running via `bun run dev:playwright` (isolated seeded DB, CDP on 9222). Follow `docs/electron-ui-debugging.md`. Never run `bun run dev` simultaneously.
- Shell is Windows PowerShell 5.1 — no `&&` chaining; use `;`.
- `src/vite-env.d.ts` mirrors `electron/preload.ts` — every IPC change must update both.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Remove references (`efl ref`, DB table, IPC, UI drawer, seed)

The polymorphic reference/link system is being deleted entirely.

**Files:**
- Delete: `core/references.ts`
- Delete: `cli/src/commands/ref.ts`
- Delete: `src/components/effort/ReferenceSection.tsx`
- Delete: `src/hooks/useReferenceMutations.ts`
- Modify: `core/types.ts` (remove `ReferenceOwnerType`, `ReferenceTargetType`, `Reference`, `CreateReferenceInput`)
- Modify: `core/db.ts` (remove `"references"` CREATE TABLE at lines ~207-217; add `DROP TABLE IF EXISTS "references";` to `initializeSchema` so existing DBs shed it)
- Modify: `core/efforts.ts`, `core/agentProfiles.ts` (remove reference cleanup/usages — grep `reference` in each)
- Modify: `cli/src/index.ts` (remove `handleRef` import + entry in `handlers`)
- Modify: `cli/src/help.ts` (remove `ref` from `HelpDomain`, `DOMAIN_ALIASES`, the root help row, and `printRefHelp`)
- Modify: `cli/src/contextSections.ts` (remove `printExpandedReferences` and its imports)
- Modify: `cli/src/commands/effort.ts`, `cli/src/commands/plan.ts`, `cli/src/commands/review.ts`, `cli/src/commands/task.ts` (remove `printExpandedReferences` / `listReferences` call sites)
- Modify: `cli/src/render.ts` (remove reference print helpers)
- Modify: `electron/main.ts`, `electron/preload.ts`, `src/vite-env.d.ts` (remove all `references:*` IPC channels and `listReferences`/`createReference`/`deleteReference` bridge functions and types)
- Modify: `src/App.tsx` (remove `referencesQuery`, `referenceMutations`, `openReference`, the `references` entry in the effort rail array at ~line 1229, the `activeEffortDrawer === 'references'` block at ~1317-1327, and `'references'` from the `EffortRailDrawer` union at line 53 and from `effortDrawerTitle`/`getDefaultDrawerWidth`)
- Modify: `scripts/seed.ts` (remove reference seeding)
- Modify: `docs/agent-definitions/AGENT-effortless.md` (remove references from surfaces table, rules 4 and 5 mentioning references)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: a codebase with zero `Reference` symbols. Later tasks assume `EffortRailDrawer = 'description' | 'inputs' | 'plan' | 'tasks'`.

- [ ] **Step 1: Delete the four files listed above.**

- [ ] **Step 2: Sweep all remaining usages.** Run and fix every hit until only incidental words remain (e.g. "short ref", React refs, `getEffortByRef`):

```
rg -n "Reference|references:|listReferences|createReference|deleteReference|handleRef|printRefHelp|printExpandedReferences|ReferenceSection|useReferenceMutations|ownerType|owner_type" core cli electron src scripts docs
```

- [ ] **Step 3: Drop the table.** In `core/db.ts` `initializeSchema`, delete the `CREATE TABLE IF NOT EXISTS "references"` block and add immediately before the big `db.exec`:

```ts
db.exec(`DROP TABLE IF EXISTS "references";`)
```

(Keep the existing `resetOldV2Schema` untouched.)

- [ ] **Step 4: Typecheck + build CLI.**

Run: `bunx tsc; node scripts/build-cli.mjs`
Expected: both succeed with no errors.

- [ ] **Step 5: Smoke.** Start `bun run dev:playwright` (background). Then: `bun run efl -- effort list` — expect the seeded efforts, no crash. `bun run efl -- ref list` — expect root help (unknown domain), not a stack trace. Stop the dev instance.

- [ ] **Step 6: Commit.**

```
git add -A
git commit -m "refactor: remove reference link system"
```

---

### Task 2: Collapse mandates + playbooks into a single `instructions` concept

One instructions text, global with optional per-repo override. No per-surface granularity, no per-template playbooks. `efl mandate` and `efl playbook` are replaced by `efl instructions`.

**Files:**
- Create: `core/instructions.ts`
- Create: `core/defaultInstructions.ts`
- Delete: `core/mandates.ts`, `core/defaultMandates.ts`, `core/templatePlaybooks.ts`, `core/defaultTemplatePlaybooks.ts`
- Delete: `cli/src/commands/mandate.ts`, `cli/src/commands/playbook.ts`
- Create: `cli/src/commands/instructions.ts`
- Delete: `src/components/manage/MandateTab.tsx`, `src/components/manage/TemplatePlaybookTab.tsx`
- Create: `src/components/manage/InstructionsTab.tsx`
- Modify: `core/types.ts`, `core/db.ts`, `core/contextPacks.ts`, `cli/src/index.ts`, `cli/src/help.ts`, `cli/src/contextSections.ts`, `cli/src/commands/{task,plan,effort,review}.ts`, `electron/main.ts`, `electron/preload.ts`, `src/vite-env.d.ts`, `src/App.tsx`, `src/hooks/useMandateMutations.ts` (rename → `useInstructionsMutations.ts`), `src/lib/manageSections.tsx`, `src/components/manage/ManageSurface.tsx`, `scripts/seed.ts`, `docs/agent-definitions/AGENT-effortless.md`

**Interfaces:**
- Consumes: Task 1's removal of references (context sections no longer print them).
- Produces:
  - `core/instructions.ts`: `listInstructions(db): Instructions[]`, `setInstructions(db, input: SetInstructionsInput): Instructions`, `deleteInstructions(db, id: number): void`, `resolveInstructionsText(db, repoId?: number | null): string | null`
  - `core/types.ts`: `Instructions = { id: number; shortRef: string; repoId: number | null; sourceType: 'body' | 'file'; body: string | null; filePath: string | null; updatedAt: string }`, `SetInstructionsInput = { repoId?: number | null; sourceType: 'body' | 'file'; body?: string | null; filePath?: string | null }`
  - Removes: `WorkSurface`, `Mandate*`, `TemplatePlaybook*`, `MandateSourceType` types; `WorkSurface` survives nowhere.
  - CLI: `efl instructions show [--repo <ref>]`, `efl instructions set --body …|--from-file …|--file <path> [--repo <ref>]`, `efl instructions clear [--repo <ref>]`, `efl instructions list`.

- [ ] **Step 1: Write `core/instructions.ts`.** One row per scope: `repo_id NULL` = global, else per-repo. `set` upserts on scope. Resolution: repo row wins if it has readable content, else global. Model it directly on the old `core/mandates.ts` (same `sourceType body|file` + `readFileSync` fallback behavior in `readMandateContent`), minus the `work_surface` dimension:

```ts
import fs from 'node:fs'
import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { Instructions, SetInstructionsInput } from './types'

type InstructionsRow = {
  id: number
  short_ref: string
  repo_id: number | null
  source_type: string
  body: string | null
  file_path: string | null
  updated_at: string
}

export function listInstructions(db: AppDatabase): Instructions[] {
  return db
    .prepare<InstructionsRow>(`SELECT * FROM instructions ORDER BY repo_id IS NOT NULL, id ASC`)
    .all()
    .map(mapInstructions)
}

export function setInstructions(db: AppDatabase, input: SetInstructionsInput): Instructions {
  const now = new Date().toISOString()
  const repoId = input.repoId ?? null
  const existing = db
    .prepare<InstructionsRow>(`SELECT * FROM instructions WHERE repo_id IS ?`)
    .get(repoId)

  if (existing) {
    db.prepare(
      `UPDATE instructions SET source_type = ?, body = ?, file_path = ?, updated_at = ? WHERE id = ?`,
    ).run(input.sourceType, input.body ?? null, input.filePath ?? null, now, existing.id)
    bumpAppState(db)
    return getInstructions(db, existing.id)
  }

  const result = db
    .prepare(
      `INSERT INTO instructions (repo_id, source_type, body, file_path, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(repoId, input.sourceType, input.body ?? null, input.filePath ?? null, now)
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE instructions SET short_ref = ? WHERE id = ?`).run(`instr-${id}`, id)
  bumpAppState(db)
  return getInstructions(db, id)
}

export function deleteInstructions(db: AppDatabase, id: number): void {
  db.prepare(`DELETE FROM instructions WHERE id = ?`).run(id)
  bumpAppState(db)
}

export function resolveInstructionsText(db: AppDatabase, repoId?: number | null): string | null {
  if (repoId != null) {
    const repoRow = db
      .prepare<InstructionsRow>(`SELECT * FROM instructions WHERE repo_id = ?`)
      .get(repoId)
    if (repoRow) {
      const text = readContent(mapInstructions(repoRow))
      if (text) return text
    }
  }
  const globalRow = db
    .prepare<InstructionsRow>(`SELECT * FROM instructions WHERE repo_id IS NULL`)
    .get()
  if (globalRow) {
    return readContent(mapInstructions(globalRow))
  }
  return null
}

function getInstructions(db: AppDatabase, id: number): Instructions {
  const row = db.prepare<InstructionsRow>(`SELECT * FROM instructions WHERE id = ?`).get(id)
  if (!row) throw new Error(`Instructions ${id} were not found`)
  return mapInstructions(row)
}

function readContent(instructions: Instructions): string | null {
  if (instructions.sourceType === 'file' && instructions.filePath) {
    try {
      return fs.readFileSync(instructions.filePath, 'utf-8')
    } catch {
      return null
    }
  }
  return instructions.body
}

function mapInstructions(row: InstructionsRow): Instructions {
  return {
    id: row.id,
    shortRef: row.short_ref,
    repoId: row.repo_id,
    sourceType: row.source_type as 'body' | 'file',
    body: row.body,
    filePath: row.file_path,
    updatedAt: row.updated_at,
  }
}
```

- [ ] **Step 2: Write `core/defaultInstructions.ts`** — one merged body distilled from the old run + task mandates (the effort/plan/review mandates restated AGENT-effortless.md and die with this change):

```ts
export const DEFAULT_INSTRUCTIONS_BODY = `# instructions

You are an active coding agent running inside effortless.

- Read the provided context before making changes.
- Work in the assigned task worktree when a task is bound to a repo.
- Keep durable state in effortless rather than terminal scrollback: checkpoints for progress, the task artifact for what changed / what was verified / what remains, the effort summary for the final outcome.
- Use input requests for blocking human decisions; prefer one focused question at a time.
- Run the repo build before marking a task ready; do not mark ready with a failing build.
- Keep scope tight to the requested work.`
```

- [ ] **Step 3: Rework `core/db.ts`.** Remove `DEFAULT_GLOBAL_MANDATES` / `DEFAULT_TEMPLATE_PLAYBOOKS` imports, the `mandates` and `template_playbooks` CREATE TABLE blocks, the `idx_mandates_surface_repo` index, `seedDefaultGlobalMandates`, `seedDefaultTemplatePlaybooks`. Add to the schema:

```sql
CREATE TABLE IF NOT EXISTS instructions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  short_ref TEXT UNIQUE,
  repo_id INTEGER,
  source_type TEXT NOT NULL,
  body TEXT,
  file_path TEXT,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_instructions_repo ON instructions(COALESCE(repo_id, -1));
```

Add before the big `db.exec`: `db.exec('DROP TABLE IF EXISTS mandates; DROP TABLE IF EXISTS template_playbooks;')`. Add a seeding function called at the end of `initializeSchema`:

```ts
function seedDefaultInstructions(db: AppDatabase): void {
  const existing = db.prepare(`SELECT id FROM instructions WHERE repo_id IS NULL`).get()
  if (existing) return
  const now = new Date().toISOString()
  const result = db
    .prepare(`INSERT INTO instructions (repo_id, source_type, body, updated_at) VALUES (NULL, 'body', ?, ?)`)
    .run(DEFAULT_INSTRUCTIONS_BODY, now)
  db.prepare(`UPDATE instructions SET short_ref = ? WHERE id = ?`).run(`instr-${Number(result.lastInsertRowid)}`, Number(result.lastInsertRowid))
}
```

- [ ] **Step 4: Update `core/contextPacks.ts`.** Replace the `resolveMandateText(db, 'run'|'task'|'effort', repoId)` pairs with a single `heading('Instructions', resolveInstructionsText(db, task.repoId) ?? 'No instructions are configured.')` section (and the effort variant with `resolveInstructionsText(db, null)`).

- [ ] **Step 5: Update the CLI.** New `cli/src/commands/instructions.ts` implementing `show|set|clear|list` per the interface above (`--repo` resolves via `getRepoByRef` from `core/repos.ts`; `set` uses `bodyArg()` or `--file <path>` for `sourceType: 'file'`). Remove `handleMandate`/`handlePlaybook` from `cli/src/index.ts`, add `handleInstructions`. In `cli/src/contextSections.ts`: delete `printTemplatePlaybook`, `printSurfaceMandate`, `printRelatedMandates`; add:

```ts
export function printInstructions(db: AppDatabase, repoId: number | null, options: { brief: boolean }): void {
  if (options.brief) return
  const text = resolveInstructionsText(db, repoId)
  if (!text) return
  console.log('')
  console.log('instructions')
  console.log(text)
}
```

Update every context command (`task.ts`, `plan.ts`, `effort.ts`, `review.ts`) to call `printInstructions` once instead of the playbook/mandate print stack. In `cli/src/help.ts`: remove `mandate` and `playbook` domains and their help printers; add an `instructions` domain:

```
efl instructions show      [--repo <repo-ref>]  print effective instructions
efl instructions set       --body … | --from-file … | --file <path> [--repo]
efl instructions clear     [--repo <repo-ref>]
efl instructions list      list configured scopes
```

Also update the root-help `--brief` description: `'compact context output (skips instructions dump)'`.

- [ ] **Step 6: Update Electron IPC + renderer.** Replace `mandates:*` and `playbooks:*` channels in `electron/main.ts` with `instructions:list`, `instructions:set`, `instructions:delete`; mirror in `electron/preload.ts` and `src/vite-env.d.ts` (`listInstructions`, `setInstructions`, `deleteInstructions`). Rename `src/hooks/useMandateMutations.ts` → `useInstructionsMutations.ts` with set/delete mutations invalidating an `['instructions']` query key. Replace `MandateTab` + `TemplatePlaybookTab` with one `InstructionsTab`: a scope list (global + one row per repo) with a textarea (body mode) or path picker (file mode), save + clear buttons — reuse the form patterns from the old `MandateTab`. In `src/lib/manageSections.tsx`: remove the `playbooks` entry, rename `mandates` → `instructions` (label lowercase `instructions`, keep an appropriate lucide icon, e.g. `ScrollText`). Update `ManageSurface.tsx` and `App.tsx` wiring (remove `templatePlaybooksQuery`, `updateTemplatePlaybook`, `resetTemplatePlaybook`).

- [ ] **Step 7: Update `scripts/seed.ts`** — remove mandate/playbook seeding (schema seeding now handles the default), and `docs/agent-definitions/AGENT-effortless.md` — replace mandate/playbook mentions with the single instructions concept.

- [ ] **Step 8: Sweep.** `rg -in "mandate|playbook" core cli electron src scripts docs README.md` — fix every functional hit (docs prose included).

- [ ] **Step 9: Typecheck + builds.**

Run: `bunx tsc; node scripts/build-cli.mjs; bunx vite build`
Expected: all pass.

- [ ] **Step 10: Smoke.** With `bun run dev:playwright` running: `bun run efl -- instructions show` prints the default body; `bun run efl -- task context --task task-1` prints a single instructions section; manage surface shows the new instructions tab (screenshot via the capture workflow).

- [ ] **Step 11: Commit.**

```
git add -A
git commit -m "refactor: collapse mandates and playbooks into single instructions concept"
```

---

### Task 3: Simplify run purposes to `main | fork | extra`

**Files:**
- Modify: `core/types.ts:249` (`AgentRunPurpose = 'main' | 'fork' | 'extra'`)
- Modify: `core/agentRuns.ts` (default at line ~121 `'implementation'` → `'extra'`; `resolveTaskRunTerminalTabKey` at ~533 loses the `review`/`side-investigation` branches — all non-fork task runs use the existing default task tab key)
- Modify: `core/db.ts` (one-time normalization after schema init)
- Modify: `src/App.tsx:623,640` (`purpose: 'implementation'` → `'extra'`)
- Modify: `scripts/seed.ts` (any seeded purposes outside the new union → `'extra'`)

**Interfaces:**
- Consumes: nothing.
- Produces: `AgentRunPurpose = 'main' | 'fork' | 'extra'`. `'main'` and `'fork'` behavior (tab grouping in `AgentRunTerminal.tsx:467-468`, main-run resolution in `agentRuns.ts:474-475`) is unchanged.

- [ ] **Step 1: Change the type and the two defaults; fix every compile error `bunx tsc` reveals.** Rule: anything that was `implementation | review | side | side-investigation` becomes `'extra'`.

- [ ] **Step 2: Normalize existing rows.** In `core/db.ts` `initializeSchema`, after table creation:

```ts
db.exec(`UPDATE agent_runs SET purpose = 'extra' WHERE purpose NOT IN ('main', 'fork', 'extra')`)
```

- [ ] **Step 3: Typecheck + build CLI.**

Run: `bunx tsc; node scripts/build-cli.mjs`
Expected: pass.

- [ ] **Step 4: Smoke.** With dev:playwright running: `bun run efl -- run list` shows normalized purposes; `bun run efl -- run prepare --task task-1 --label smoke` creates a run with purpose `extra`.

- [ ] **Step 5: Commit.**

```
git add -A
git commit -m "refactor: collapse run purposes to main, fork, extra"
```

---

### Task 4: Remove plan ready/wait choreography

Plans become: agent submits, human accepts in the UI. `markPlanReady` (which was just an alias for `acceptPlan`, letting the agent self-accept) dies.

**Files:**
- Modify: `core/plans.ts` (delete `markPlanReady` at lines 76-78)
- Modify: `cli/src/commands/plan.ts` (delete the `ready` and `wait` command blocks at lines 94-106 and the `markPlanReady` import)
- Modify: `cli/src/help.ts` (remove `efl plan ready` / `efl plan wait` rows from `printPlanHelp`)
- Modify: `electron/main.ts`, `electron/preload.ts`, `src/vite-env.d.ts` (remove any `plans:ready` channel / `readyPlan` bridge if present)
- Modify: `src/hooks/usePlanMutations.ts` (remove `readyPlan`)
- Modify: `src/components/effort/PlanSection.tsx` (remove the ready button/props `onReadyPlan`, `isReadyingPlan`; keep accept + request-changes)
- Modify: `src/App.tsx:1347-1352` (drop the removed props)
- Modify: `docs/agent-definitions/AGENT-effortless.md` and any help/docs mentioning `plan ready`/`plan wait`

**Interfaces:**
- Consumes: nothing.
- Produces: plan surface API is `submit | list | show | context` (CLI) and accept/request-changes (UI only).

- [ ] **Step 1: Make the deletions above; sweep with `rg -n "markPlanReady|readyPlan|plan ready|plan wait" core cli electron src docs` and fix all hits.**

- [ ] **Step 2: Typecheck + builds.**

Run: `bunx tsc; node scripts/build-cli.mjs; bunx vite build`
Expected: pass.

- [ ] **Step 3: Smoke.** `bun run efl -- plan help` no longer lists ready/wait; `bun run efl -- plan list --effort eff-1` still works.

- [ ] **Step 4: Commit.**

```
git add -A
git commit -m "refactor: remove plan ready/wait; acceptance is a human UI action"
```

---

### Task 5: CLI positional ref sugar

Short refs are type-prefixed, so the ref *is* the type. Add: top-level verbs `efl context <ref>`, `efl show <ref>`, `efl checkpoint <body…>`, and a general rule that a bare ref token in the first argument slot after `<domain> <command>` is rewritten to its flag.

**Files:**
- Create: `cli/src/refs.ts`
- Modify: `cli/src/index.ts` (rewrite args before dispatch)
- Modify: `cli/src/help.ts` (document the sugar)

**Interfaces:**
- Consumes: Task 4's final command list (no plan ready/wait).
- Produces: `rewriteCliArgs(args: string[]): string[]` in `cli/src/refs.ts`. Flag forms remain canonical and untouched.

- [ ] **Step 1: Write `cli/src/refs.ts`:**

```ts
const REF_DOMAINS = [
  { prefix: 'eff-', domain: 'effort', flag: '--effort' },
  { prefix: 'task-', domain: 'task', flag: '--task' },
  { prefix: 'plan-', domain: 'plan', flag: '--plan' },
  { prefix: 'rev-', domain: 'review', flag: '--review' },
  { prefix: 'run-', domain: 'run', flag: '--run' },
] as const

const REF_PATTERN = /^(eff|task|plan|rev|run)-\d+$/

function matchRef(token: string | undefined) {
  if (!token || !REF_PATTERN.test(token)) return null
  return REF_DOMAINS.find((entry) => token.startsWith(entry.prefix)) ?? null
}

// efl context task-1  -> efl task context --task task-1
// efl show rev-2      -> efl review show --review rev-2
// efl checkpoint x y  -> efl task checkpoint --body "x y" (task inferred from env)
// efl review submit task-1 ... -> efl review submit --task task-1 ...
export function rewriteCliArgs(args: string[]): string[] {
  const [first, second] = args

  if ((first === 'context' || first === 'show') && matchRef(second)) {
    const entry = matchRef(second)!
    return [entry.domain, first, entry.flag, second, ...args.slice(2)]
  }

  if (first === 'checkpoint') {
    const rest = args.slice(1)
    const ref = matchRef(rest[0])
    if (ref?.domain === 'task') {
      return ['task', 'checkpoint', ref.flag, rest[0], '--body', rest.slice(1).join(' ')]
    }
    if (rest.length > 0 && !rest[0].startsWith('--')) {
      return ['task', 'checkpoint', '--body', rest.join(' ')]
    }
    return ['task', 'checkpoint', ...rest]
  }

  // Positional ref directly after `<domain> <command>` becomes its flag,
  // unless that flag is already present.
  const entry = matchRef(args[2])
  if (entry && !args.includes(entry.flag)) {
    return [...args.slice(0, 2), entry.flag, args[2], ...args.slice(3)]
  }

  return args
}
```

- [ ] **Step 2: Wire it into `cli/src/index.ts`** — first line of `runCli` becomes `setRawArgs(rewriteCliArgs(args))` and destructure `const [surface, command] = rewriteCliArgs(args)` (call once, reuse the result).

- [ ] **Step 3: Document in `cli/src/help.ts` root help**, after the Commands block:

```
shortcuts:
  efl context <ref>     context for any ref (eff-1, task-2, plan-1, rev-1, run-3)
  efl show <ref>        show any ref
  efl checkpoint <text> task checkpoint (task from run env)
  efl task context task-1   positional refs work anywhere the flag is unambiguous
```

- [ ] **Step 4: Typecheck + build CLI.**

Run: `bunx tsc; node scripts/build-cli.mjs`
Expected: pass.

- [ ] **Step 5: Smoke.** With dev:playwright running: `bun run efl -- context task-1` matches `bun run efl -- task context --task task-1`; `bun run efl -- show eff-1` works; `bun run efl -- task context task-1` works; flag forms still work unchanged.

- [ ] **Step 6: Commit.**

```
git add -A
git commit -m "feat: positional short-ref sugar for efl"
```

---

### Task 6: Metadata chips → status line

Read-only facts become one muted text line; only interactive controls stay as controls.

**Files:**
- Modify: `src/App.tsx:1116-1172` (effort header) and `src/App.tsx:1297-1310` (description drawer meta)
- Modify: `src/components/task/TaskDetailPane.tsx:204-241` (task expanded-meta)
- Modify: `src/App.css` and `src/components/task/TaskDetailPane.module.css` (new `meta-line` style; remove now-unused chip styles)
- Modify: whatever renders the notification count badge with a hardcoded yellow (locate via `rg -n "ffc|fbbf|eab|yellow|amber|gold" src` — it is the circular badge next to the sidebar collapse control, likely `src/components/sidebar/Sidebar.tsx` or `App.css`); restyle it with theme accent variables from `src/themes.ts` conventions instead of a fixed yellow.

**Interfaces:**
- Consumes: Task 1 (references drawer gone).
- Produces: `.meta-line` CSS class used by later tasks' empty states is *not* required elsewhere; this task is self-contained.

- [ ] **Step 1: Effort header.** Replace the five `chip-group` divs (ref/type/status/runs) with a single line, keeping the provider/profile `<select>`s as compact labeled controls to its right:

```tsx
<div className="effort-header-meta">
  <span className="meta-line">
    {selectedEffort.shortRef} · {selectedEffort.template.replace('-', ' ')} ·{' '}
    <span className="meta-status" style={{ color: effortStatusColor(selectedEffort.status) }}>
      {selectedEffort.status}
    </span>
    {activeEffortRunCount > 0 ? ` · ${activeEffortRunCount} live` : ''}
  </span>
  {/* provider + profile selects stay, unchanged behavior */}
</div>
```

CSS in `App.css`:

```css
.meta-line {
  color: var(--text-muted, rgba(255, 255, 255, 0.55));
  font-size: 12px;
  letter-spacing: 0.02em;
}
.meta-line .meta-status { font-weight: 600; }
```

(Use the actual muted-text variable already defined in `App.css`/`themes.ts` — check before inventing one.)

- [ ] **Step 2: Description drawer meta (App.tsx ~1297)** — same single-line treatment, drop the three chip-groups.

- [ ] **Step 3: Task detail meta (TaskDetailPane.tsx 204-241)** — replace the chip groups with one line: `task-2 · accepted · effortless · task/plan-review-loop`, worktree basename with the full path kept as `title` tooltip, runs summary appended when present. Keep the launch bar (terminal/provider/profile selects + actions) exactly as is.

- [ ] **Step 4: Notification badge** — find the hardcoded yellow badge and restyle with the theme accent (border + accent text on dark background, consistent with the rest of the chrome). If it is genuinely a warning indicator, use the theme's warning color from `src/themes.ts` if one exists; do not leave a hex literal in the component.

- [ ] **Step 5: Verify visually.** `bunx tsc; bunx vite build`, then with dev:playwright: capture effort screen and task detail (work + meta) screenshots via `window.effortless.captureDebugScreenshot(...)`; confirm one-line meta, working selects, no orphaned chip styles.

- [ ] **Step 6: Commit.**

```
git add -A
git commit -m "ui: replace metadata chip rows with muted status lines"
```

---

### Task 7: Structured git errors + designed empty states

Stop leaking raw git stderr into diff/commits/conflicts panels.

**Files:**
- Modify: `core/types.ts` (`TaskDiffView`, `TaskCommitView`, `TaskConflictView` gain `error: string | null`; conflict view keeps `details` for real conflict output only)
- Modify: `core/tasks.ts:190-214, 272-279` (`readGitView` returns structured result; add `friendlyGitError`)
- Modify: `src/components/task/TaskDetailPane.tsx` (render `error` as designed empty state; raw detail behind `<details>`)
- Modify: `cli/src/commands/task.ts` / `cli/src/render.ts` if they print these views (sweep for `TaskDiffView` usage)

**Interfaces:**
- Consumes: nothing.
- Produces: `TaskDiffView = { taskId; type; output: string; error: string | null }`, `TaskCommitView = { taskId; output: string; error: string | null }`, `TaskConflictView = { taskId; hasConflicts: boolean; files: string[]; details: string | null; error: string | null }`. Task 8 moves this rendering; land this first so Task 8 moves the corrected version.

- [ ] **Step 1: Rework `readGitView` in `core/tasks.ts`:**

```ts
type GitViewResult<T> = { ok: true; value: T } | { ok: false; error: string; detail: string }

async function readGitView<T>(read: () => Promise<T>): Promise<GitViewResult<T>> {
  try {
    return { ok: true, value: await read() }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: friendlyGitError(message), detail: message.trim() }
  }
}

function friendlyGitError(message: string): string {
  if (/unknown revision|not a valid object name|bad revision/i.test(message)) {
    return 'branch not created yet'
  }
  if (/not a git repository/i.test(message)) {
    return 'path is not a git repository'
  }
  if (/ENOENT|no such file or directory/i.test(message)) {
    return 'repo or worktree path is missing'
  }
  return 'git command failed'
}
```

Update `getTaskDiffView`/`getTaskCommitView`/`getTaskConflictView` to populate `{ output: '', error }` on failure (conflict view: `hasConflicts: false, files: [], details: null, error`). Append the raw `detail` after the friendly message separated by `\n\n` **only** in the `error` field — the UI decides how much to show.

- [ ] **Step 2: UI rendering in `TaskDetailPane.tsx`.** For each of the three panels, when `error` is set render:

```tsx
<div className="git-view-empty">
  <p className="empty-state">{firstLine(view.error)}</p>
  {view.error.includes('\n') ? (
    <details>
      <summary>details</summary>
      <pre>{view.error}</pre>
    </details>
  ) : null}
</div>
```

with a tiny `firstLine` helper. Normal empty (no error, no output) keeps the existing friendly copy ('no commits ahead of base', 'no diff output', 'no conflicts detected').

- [ ] **Step 3: Typecheck + build; sweep `rg -n "git data unavailable" core cli src` → zero hits.**

Run: `bunx tsc; bunx vite build; node scripts/build-cli.mjs`
Expected: pass.

- [ ] **Step 4: Visual check.** With dev:playwright: open a seeded task whose branch doesn't exist (the seed has one — eff-3's task-2 per the protocol-validation screenshots); commits/conflicts panels must show 'branch not created yet' style copy, no `fatal:` text visible by default. Screenshot.

- [ ] **Step 5: Commit.**

```
git add -A
git commit -m "fix: designed git error states instead of raw stderr"
```

---

### Task 8: Task work view swaps the center pane

Reviewing a diff deserves the terminal's real estate. The drawer keeps task *meta*; the *work* mode (build/diff/commits/conflicts) renders in the center pane, with the terminal kept mounted but hidden (xterm/PTY attachment must not unmount).

**Files:**
- Create: `src/components/task/TaskWorkPane.tsx` (move the `surfaceMode === 'work'` JSX — build section, implementation/diff, commits, conflicts — plus `DiffFile`, diff parsing hooks, refractor helpers out of `TaskDetailPane.tsx`)
- Modify: `src/components/task/TaskDetailPane.tsx` (meta-only + launch bar; `surfaceMode` state lifts out; the meta/work `PillSwitcher` now drives App-level state via props `workView: boolean`, `onWorkViewChange`)
- Modify: `src/App.tsx` (new `centerView` state; hide terminal canvas with CSS when work view is active)
- Modify: `src/App.css`, `src/components/task/TaskDetailPane.module.css` (styles move with the JSX; add `.terminal-first-canvas.hidden { display: none; }` and a work-pane container)

**Interfaces:**
- Consumes: Task 7's error-aware views (move the corrected rendering).
- Produces: `TaskWorkPane` props: `{ task: Task; latestBuild: TaskBuildResult | null; commitView: TaskCommitView | null; conflictView: TaskConflictView | null; onClose: () => void }` — it owns the diff query internally (move `diffViewQuery` and related state into it). `TaskDetailPane` loses `surfaceMode` and the work-mode JSX.

- [ ] **Step 1: Extract `TaskWorkPane.tsx`.** Move the work-mode sections and all diff-related hooks/state (`diffType`, `diffViewType`, `activeFilePath`, `diffViewQuery`, `fileEntries`, `DiffFile`, `EXT_TO_LANG`, refractor wrapper, `normalizeDiffOutput`, `sanitizeDiffPath`, `resolveDiffFilePath`) verbatim from `TaskDetailPane.tsx`. Add a header row: task title, the same one-line meta from Task 6, and a close button (X) calling `onClose`. The diff query's `enabled` no longer checks `surfaceMode` (the pane only mounts when visible).

- [ ] **Step 2: App state.** In `App.tsx`:

```ts
const [centerView, setCenterView] = useState<'terminal' | 'work'>('terminal')
```

Reset to `'terminal'` when `selectedTaskId` or `selectedEffortId` changes (`useEffect`). In the `terminal-first-canvas` block:

```tsx
<div className={`terminal-first-canvas ${centerView === 'work' && selectedTask ? 'hidden' : ''}`}>
  <AgentRunTerminal ... />
</div>
{centerView === 'work' && selectedTask ? (
  <div className="terminal-first-canvas work-canvas">
    <TaskWorkPane
      task={selectedTask}
      latestBuild={latestBuildForSelectedTask}
      commitView={commitViewForSelectedTask}
      conflictView={conflictViewForSelectedTask}
      onClose={() => setCenterView('terminal')}
    />
  </div>
) : null}
```

(The build/commit/conflict queries currently feeding `TaskDetailPane` move or are shared — keep them in App and pass down, matching current wiring.)

- [ ] **Step 3: Drawer side.** `TaskDetailPane`'s pill switcher becomes `options: [{id:'meta'},{id:'work'}]` where selecting `work` calls `onWorkViewChange(true)` (sets `centerView='work'`) and the drawer stays open showing meta; selecting `meta` sets `centerView='terminal'`. The pill's `value` derives from the `workView` prop so drawer and center never disagree.

- [ ] **Step 4: CSS.** `.terminal-first-canvas.hidden { display: none; }` — the terminal component stays mounted so the PTY attachment and xterm buffer survive. `.work-canvas` scrolls vertically (`overflow-y: auto`), fills the same grid area.

- [ ] **Step 5: Verify behavior end-to-end.** `bunx tsc; bunx vite build`. With dev:playwright: (a) select a task, switch to work — diff fills the center; (b) switch back — terminal returns *with its prior buffer* (start a run first to prove the PTY survived); (c) narrow window — no layout break; (d) close drawer while in work view — work view persists with its own close button. Screenshots of each state; verify captures differ between states (AGENTS.md).

- [ ] **Step 6: Commit.**

```
git add -A
git commit -m "ui: task work view takes over the center pane; terminal stays mounted"
```

---

### Task 9: Docs sync + final acceptance

**Files:**
- Modify: `README.md` (surfaces table loses references/mandates/playbooks; mentions instructions; CLI examples use positional sugar)
- Modify: `docs/agent-definitions/AGENT-effortless.md` (final pass: no refs/mandates/playbooks/plan-ready; commands match reality)
- Modify: `cli/src/help.ts` (read every help string end-to-end against the shipped commands)
- Modify: `docs/v2-checklist.md` (append a short "v2.1 pruning" section recording what was cut and why — one line each)

- [ ] **Step 1: Update the three docs and re-read `efl` help output for stale vocabulary.** Sweep: `rg -in "mandate|playbook|efl ref|plan ready|side-investigation" README.md docs cli/src/help.ts` → zero functional hits.

- [ ] **Step 2: Full build.**

Run: `bun run build`
Expected: tsc, vite build, CLI build, electron-builder all pass.

- [ ] **Step 3: Full smoke against the packaged/dev app.** With a fresh `bun run dev:playwright` (delete the old `.playwright-mcp/{mm-dd}-effortless` runtime first so the seeded DB is rebuilt against the new schema): effort list renders; instructions tab works; task work view swap works; `efl context task-1`, `efl instructions show`, `efl run list` all succeed; no `fatal:` git text anywhere in the UI.

- [ ] **Step 4: Commit.**

```
git add -A
git commit -m "docs: sync README, agent definition, and help with pruned model"
```
