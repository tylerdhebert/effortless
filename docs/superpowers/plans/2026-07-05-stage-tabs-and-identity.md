# Stage Tabs + Identity Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the meta/work action-at-a-distance by making task work views first-class tabs on the center stage, then give effortless its own visual identity: phosphor palette, IBM Plex type system, ref treatment, and status stamps.

**Architecture:** React renderer (`src/`), theme tokens in `src/themes.ts` applied as CSS custom properties, terminal stage in `src/components/task/AgentRunTerminal.tsx` fed a tab list from `src/App.tsx:355`. Work views join that tab list as a new tab kind; identity changes flow through the token system so all existing themes keep working.

**Tech Stack:** React 18, CSS custom properties, @fontsource (self-hosted fonts), xterm.

## Global Constraints

- Branch `main-v2`, commit per task. UI labels lowercase; no marketing copy.
- Verification per task: `bunx tsc` + `bunx vite build`. Live visual verification is done by the orchestrator via `bun run dev:playwright` + CDP screenshots; implementers must NOT run the live app.
- Terminals must never unmount while runs are attached — hide with CSS only.
- `src/themes.ts` `THEME_VARIABLES` is derived from the `grass` palette's keys: **any new CSS variable must be added to every palette in `THEME_PALETTES`** or theme switching leaves stale values.
- Every change in this plan must be listed in the final tabulated review (Task 5) — area, what changed, why, commit.
- Do not commit anything under `.superpowers/` or `.codex-subagents/` (gitignored).

---

### Task 1: Work views become stage tabs

The meta/work pill (drawer-side control mutating the center pane) dies. The center stage's existing tab system gains a second tab kind: `work`.

**Files:**
- Modify: `src/App.tsx` (tab memo ~line 355, centerView removal, work-tab state, TaskDetailPane/TaskWorkPane wiring ~1070-1130 and ~1290-1310)
- Modify: `src/components/task/AgentRunTerminal.tsx` (TerminalTab type ~57, strip/menu rendering ~465-660, stack rendering ~649+)
- Modify: `src/components/task/TaskDetailPane.tsx` (remove pill + workView/onWorkViewChange props; add "open work view" button)
- Modify: `src/components/task/TaskWorkPane.tsx` (no structural change; onClose semantics change)
- Modify: `src/App.css`, `src/components/task/AgentRunTerminal.module.css` (or its CSS file) for work-tab styling

**Interfaces:**
- Produces: `TerminalTab` gains `kind: 'terminal' | 'work'` and optional `workTaskId: number | null`. Work tab keys are `work-task-<taskId>`. `AgentRunTerminal` gains props `workPane?: React.ReactNode` (rendered in place of the terminal stack when the active tab kind is `work`) and `onCloseWorkTab?: (key: string) => void`.
- Consumes: `TaskWorkPane` as built in the prior refactor.

- [ ] **Step 1: App-side tab model.** Add state `const [openWorkTaskIds, setOpenWorkTaskIds] = useState<number[]>([])`. In the `terminalTabs` memo, after building terminal tabs (each gets `kind: 'terminal' as const, workTaskId: null`), append one tab per open work task:

```ts
const workTabs = openWorkTaskIds
  .map((taskId) => {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) return null
    return {
      key: `work-task-${taskId}`,
      label: `${task.shortRef} work`,
      run: null,
      hasLiveSession: false,
      providerLive: false,
      profileLabel: null,
      taskId,
      purpose: null,
      branchLabel: task.branchName ?? 'no branch',
      kind: 'work' as const,
      workTaskId: taskId,
    }
  })
  .filter(Boolean)
```

Add `openWorkTaskIds` to the memo deps. Remove stale work tabs when their task disappears (filter against tasks). Keep the existing "reset to main when active key vanishes" effect — it already covers closed work tabs.

- [ ] **Step 2: Open/close actions.** `openWorkView(taskId)`: add to `openWorkTaskIds` (dedupe) and `setActiveTerminalTabKey('work-task-' + taskId)`. `closeWorkView(key)`: remove the id, and if it was active, activate `'main'`. Delete the `centerView` state, its reset effect, and the Task-8 dual-canvas arrangement in the stage block: `AgentRunTerminal` goes back to a single always-rendered canvas div (no `hidden` class juggling in App), and `TaskWorkPane` is now passed INTO it:

```tsx
<AgentRunTerminal
  ...existing props...
  workPane={activeWorkTask ? (
    <TaskWorkPane
      task={activeWorkTask}
      ...same data props as today...
      onClose={() => closeWorkView(`work-task-${activeWorkTask.id}`)}
    />
  ) : null}
  onCloseWorkTab={closeWorkView}
/>
```

where `activeWorkTask` is derived from the active tab's `workTaskId`. The build/commits/conflicts queries stay in App keyed to the active work task (they currently key off `selectedTask` — change their `queryKey`/`queryFn`/`enabled` to use the active work task id so a work tab keeps working when the drawer selection changes; simplest correct form: keep the existing selectedTask-based queries AND pass data for the active work task by pointing those queries at `activeWorkTask` instead of `selectedTask`).

- [ ] **Step 3: AgentRunTerminal renders work tabs.** Extend its local `TerminalTab` type with `kind` and `workTaskId`. In the strip/menu grouping (~line 465): work tabs form their own group after fork tabs, labeled `work views`, each row shows the tab label and a small close (×) affordance calling `onCloseWorkTab(tab.key)` (stop propagation from row select). When `activeTab?.kind === 'work'`: render `workPane` in the stack area and add a `hidden` CSS class to the terminal stack container (`display: none`) — terminal hosts stay mounted. Header for work tabs: show the tab label + branchLabel, hide run status/start/stop/fork controls (they're meaningless for a work tab).

- [ ] **Step 4: TaskDetailPane.** Remove the meta/work `PillSwitcher` and the `workView`/`onWorkViewChange` props. Add a header action button `open work view` (icon: `Hammer` or `Diff`-ish from lucide, lowercase label) wired to a new prop `onOpenWorkView: () => void`; App passes `() => openWorkView(task.id)`. The drawer no longer controls the center pane in any way.

- [ ] **Step 5: Verify + commit.**

Run: `bunx tsc; bunx vite build`
Expected: pass. Commit:

```
git add -A
git commit -m "ui: task work views are stage tabs; drawer no longer remote-controls the center"
```

---

### Task 2: Phosphor palette + semantic tokens

New default theme: warm charcoal + phosphor amber. Color becomes semantic: amber = needs a human, green = live, red = conflict/failure.

**Files:**
- Modify: `src/themes.ts` (new `phosphor` palette first in the map; add `--live`, `--danger`, `--ok` to EVERY palette; default fallback)
- Modify: `core/db.ts` (app_state theme default `'grass'` → `'phosphor'`, plus one-time `UPDATE app_state SET theme = 'phosphor' WHERE theme = 'grass'` — grass was the shipped default, not a user choice; tabulate this)
- Modify: `src/App.tsx` / `src/components/manage/AppearanceSettingsPanel.tsx` (any `?? 'grass'` fallbacks → `'phosphor'`)
- Modify: `src/lib/helpers.ts` (`effortStatusColor` returns semantic var references instead of hardcoded colors — check its current body and map: active→`var(--live)`, complete→`var(--ok)`, archived→`var(--muted)`)

**Interfaces:**
- Produces: CSS vars `--live`, `--ok`, `--danger` available in all themes; theme id `'phosphor'` as default. Task 4's Stamp component consumes these.

- [ ] **Step 1: Add the phosphor palette** (exact values; ThemeId union gains `'phosphor'`, THEME_LABELS gets `phosphor: 'phosphor'`):

```ts
phosphor: {
  '--body-bg': '#151210',
  '--body-text': '#eae3d2',
  '--main': '#151210',
  '--sidebar': '#0f0d0b',
  '--surface': '#1c1814',
  '--panel': '#231e18',
  '--field': '#12100d',
  '--button': '#1f1a15',
  '--line': '#332c23',
  '--line-strong': '#4a4033',
  '--text': '#ddd5c2',
  '--text-strong': '#f5efe0',
  '--muted': '#94897a',
  '--accent': '#e8a33d',
  '--live': '#8fbf6a',
  '--ok': '#9dbb7e',
  '--danger': '#d96a5b',
  '--placeholder': '#6b6152',
  '--focus-shadow': 'rgba(232, 163, 61, 0.18)',
  '--diff-insert-bg': 'rgba(143, 191, 106, 0.16)',
  '--diff-delete-bg': 'rgba(217, 106, 91, 0.16)',
  '--diff-gutter-insert-bg': 'rgba(143, 191, 106, 0.65)',
  '--diff-gutter-delete-bg': 'rgba(217, 106, 91, 0.7)',
  '--diff-text-color': '#d8d0bd',
  '--diff-gutter-insert-bg-solid': '#2a3a1e',
  '--diff-gutter-insert-text': '#a4ce85',
  '--diff-gutter-delete-bg-solid': '#3a221c',
  '--diff-gutter-delete-text': '#e08a7c',
  '--diff-code-insert-bg': '#1a2212',
  '--diff-code-delete-bg': '#221410',
  '--diff-code-insert-edit-bg': '#2e4a1e',
  '--diff-code-delete-edit-bg': '#4a2a1e',
  '--diff-code-selected-bg': 'rgba(232, 163, 61, 0.12)',
  '--diff-omit-gutter-line': '#7c7160',
},
```

- [ ] **Step 2: Add `--live`, `--ok`, `--danger` to every other palette** with theme-appropriate values (for existing themes derive from each theme's own greens/reds: e.g. grass: live `#8ccf62`, ok `#8ccf62`, danger `#e05d50`; gruvbox: live `#b8bb26`, ok `#b8bb26`, danger `#fb4934`; light themes use their darker greens/reds). `THEME_VARIABLES` derives from `grass` — since phosphor is now canonical, change `THEME_VARIABLES = Object.keys(THEME_PALETTES.phosphor)` and make sure every palette has all phosphor keys.

- [ ] **Step 3: Defaults.** `applyTheme` fallback → `THEME_PALETTES.phosphor`; `core/db.ts` schema default + migration UPDATE; sweep `rg -n "'grass'" src core electron scripts` and update fallbacks (the grass palette itself stays available in the picker).

- [ ] **Step 4: Verify + commit.**

Run: `bunx tsc; bunx vite build`
Expected: pass. Commit: `git add -A; git commit -m "ui: phosphor default theme with semantic live/ok/danger tokens"`

---

### Task 3: IBM Plex type system

One family, three voices: Plex Sans (body), Plex Sans Condensed semibold (titles/wordmark), Plex Mono (refs, meta, data, diffs). Rationale: terminal-heritage family designed for machine-human interfaces; cohesion across roles.

**Files:**
- Modify: `package.json` (bun add `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-sans-condensed`, `@fontsource/ibm-plex-mono`)
- Modify: `src/main.tsx` (font imports)
- Modify: `src/index.css` (font stacks + `--font-body`, `--font-display`, `--font-mono` custom properties; `--diff-font-family`)
- Modify: `src/App.css` and component CSS that hardcode font families (`rg -n "font-family" src`)

- [ ] **Step 1: Install fonts.** `bun add @fontsource/ibm-plex-sans @fontsource/ibm-plex-sans-condensed @fontsource/ibm-plex-mono`. In `src/main.tsx` add imports for weights 400/500/600 (sans), 600 (condensed), 400/600 (mono). Self-hosted — no network fetch at runtime.

- [ ] **Step 2: Token the stacks in `src/index.css`:**

```css
:root {
  --font-body: 'IBM Plex Sans', 'Segoe UI', sans-serif;
  --font-display: 'IBM Plex Sans Condensed', 'Bahnschrift', sans-serif;
  --font-mono: 'IBM Plex Mono', 'Cascadia Code', Consolas, monospace;
}
```

body → `var(--font-body)`. The three Bahnschrift rules (index.css:62,71,79 — headings/wordmark) → `var(--font-display)`, weight 600. `--diff-font-family` → `var(--font-mono)`. App.css:833 mono rule → `var(--font-mono)`. Sweep every remaining `font-family` in `src/` into one of the three tokens.

- [ ] **Step 3: Title treatment.** Effort title `h2` and task titles (`h3` in drawer + work pane header): `font-family: var(--font-display); font-weight: 600; letter-spacing: 0.01em;`. Title-bar wordmark `effortless`: `var(--font-display)` 600 with the accent-colored dot it already has.

- [ ] **Step 4: Verify + commit.** `bunx tsc; bunx vite build` → pass. Commit: `git add -A; git commit -m "ui: ibm plex type system (sans body, condensed display, mono data)"`

---

### Task 4: Ref treatment + status stamps

The two identity anchors. Refs become typographic objects; statuses become stamps.

**Files:**
- Create: `src/components/ui/Ref.tsx` + `Ref.module.css`
- Create: `src/components/ui/Stamp.tsx` + `Stamp.module.css`
- Modify: render sites: `src/App.tsx` (effort header meta line, drawer meta), `src/components/sidebar/Sidebar.tsx` (effort rows), `src/components/task/TaskDetailPane.tsx` + `TaskWorkPane.tsx` (meta lines, build status, review verdicts), `src/components/task/TaskList.tsx` (strip chips), `src/components/task/ReviewRecord.tsx` / `ReviewHistory.tsx` (verdicts), `src/components/task/AgentRunTerminal.tsx` (run refs/status in header + menu rows)
- Modify: `src/lib/helpers.ts` / `src/lib/runStatus.ts` (status→tone mapping helper)

**Interfaces:**

```tsx
// Ref.tsx
export function Ref({ value }: { value: string }) // <span class=ref>{value}</span>

// Stamp.tsx
export type StampTone = 'neutral' | 'live' | 'gate' | 'ok' | 'danger'
export function Stamp({ label, tone }: { label: string; tone: StampTone })
export function statusTone(status: string): StampTone
```

`statusTone` mapping: `in-flight`/`running` → live; `reviewing`/`pending`/`prepared` → gate; `accepted`/`merged`/`passed`/`approve`/`complete`/`answered` → ok; `conflicted`/`failed`/`request-changes`/`orphaned` → danger; everything else (`open`/`exited`/`cancelled`/`active`/`archived`) → neutral.

- [ ] **Step 1: Ref component.**

```css
.ref {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--muted);
}
```

Apply at: sidebar effort rows, effort header + drawer meta lines, task meta lines (TaskDetailPane + TaskWorkPane headers), TaskList strip, AgentRunTerminal header/menu run refs. Refs read identically everywhere.

- [ ] **Step 2: Stamp component.**

```css
.stamp {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.09em;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 3px;
  border: 1px solid color-mix(in srgb, var(--stamp-color) 55%, transparent);
  color: var(--stamp-color);
  background: color-mix(in srgb, var(--stamp-color) 8%, transparent);
}
```

Tone sets `--stamp-color`: neutral→`var(--muted)`, live→`var(--live)`, gate→`var(--accent)`, ok→`var(--ok)`, danger→`var(--danger)`.

- [ ] **Step 3: Apply stamps** at: effort header status (replacing the colored word in the meta line — meta line becomes `<Ref eff-3/> · delivery · <Stamp complete/>`), task meta line status, TaskList badges (status + run badge), build status in TaskWorkPane (`build-2 <Stamp passed/>`), review verdicts in ReviewRecord/ReviewHistory, run status in AgentRunTerminal header and menu rows. Replace `effortStatusColor` glow/boxShadow styling wherever it still exists with Stamp; delete `effortStatusColor` if no longer referenced.

- [ ] **Step 4: Verify + commit.** `bunx tsc; bunx vite build` → pass. Commit: `git add -A; git commit -m "ui: ref treatment and status stamps as identity anchors"`

---

### Task 5: Acceptance + tabulated review

- [ ] **Step 1:** Full `bun run build` passes.
- [ ] **Step 2 (orchestrator):** fresh `dev:playwright` run; screenshots: effort view (phosphor + stamps + refs + type), work tab open next to terminal tab, tab menu with work views group, manage/instructions view, one non-default theme (e.g. gruvbox) to prove semantic tokens didn't break theme switching.
- [ ] **Step 3 (orchestrator):** produce the tabulated change review for Tyler: every change (area | what | why | commit), including judgment calls (default theme migration, pill removal, font licensing note: IBM Plex is OFL).
- [ ] **Step 4:** Commit any acceptance fixes; ledger.
