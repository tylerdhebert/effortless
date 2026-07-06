# Stage-First Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved stage-first design (docs/superpowers/plans/2026-07-05-stage-first — visual plan artifact, decisions D1–D6): visible tab strip, one full-width task page, drawers demoted to lists, inline input cards that demote to a title-bar needs-you cluster, description folded into the header.

**Architecture:** React renderer. The stage (center pane) hosts two tab kinds: terminal sessions and task pages. `src/App.tsx` owns tab state; `AgentRunTerminal.tsx` hosts the stage; the phosphor identity (Ref/Stamp components, `--font-*` and semantic color tokens) is already shipped and every new element must use it.

**Tech Stack:** React 18, CSS custom properties, existing IPC (one new global-attention endpoint in Task 3).

## Global Constraints

- Branch `main-v2`, commit per task. UI labels lowercase. All colors via theme tokens (`--accent`, `--live`, `--ok`, `--danger`, `--muted`, surfaces/lines); all type via `--font-body/display/mono`. Refs render with the `Ref` component; statuses/verdicts with `Stamp`.
- Verification per task: `bunx tsc` + `bunx vite build`. Implementers must NOT run the live app — the orchestrator screenshots every change and will send back nit lists; expect fix rounds.
- Terminals never unmount while runs are attached (CSS hide only).
- Do not commit anything under `.superpowers/` or `.codex-subagents/`.
- Resolved design calls that bind this plan: page tabs are labeled by ref (`▹ task-2`) with the task title as tooltip; plans stay in the drawer (exactly two stage tab kinds); input cards demote (never auto-dismiss); text-labeled terminal tabs.

---

### Task 1: Visible stage tab strip (D1)

**Files:** Modify `src/components/task/AgentRunTerminal.tsx` + its module CSS; possibly `src/App.css`.

The `(0) ▾` dropdown stops being primary navigation. AgentRunTerminal's header top row becomes a persistent strip:

- Left-to-right: terminal tabs (main first, then forks, then other run tabs), then page tabs (kind `work`), then a `+` button (opens the existing menu's "add terminal" action), then flex spacer, then a compact overflow/menu trigger (existing menu, kept for run history/recovery/start/fork actions) and the current status text right-aligned.
- Terminal tab anatomy: live dot (`--live` filled when hasLiveSession/providerLive, `--line-strong` hollow/idle otherwise) + label (existing tab label, ellipsis-truncate at ~16ch, full label in `title`). Page tab anatomy: `▹` glyph in `--accent` + `<Ref value="task-2"/>`-style mono ref + close `×` on hover/always (small target, `aria-label="close task-2"`); title tooltip.
- Active tab: `--surface` background, `--text-strong`, 2px `--accent` bottom border. Inactive: muted, transparent, hover brightens. Strip bottom edge: 1px `--line` under the whole row; tabs sit flush on it.
- The `work views` group is removed from the dropdown menu (pages are on the strip now); terminal rows may remain in the menu as overflow/recovery.
- The old `h4` title ("terminal" / tab label) is replaced by the strip; keep the status line (run ref + status stamp) right-aligned in the strip or directly under it — implementer picks the cleaner fit, orchestrator will nit.
- Keyboard: strip tabs focusable, Enter/Space selects; keep the menu's existing keyboard behavior.

Verify (`bunx tsc; bunx vite build`), commit exactly:
`ui: persistent stage tab strip; dropdown demoted to overflow`

---

### Task 2: The task page + drawer demotion (D2 + D3)

**Files:** Create `src/components/task/TaskPage.tsx` + `TaskPage.module.css` (grown from TaskWorkPane). Delete `src/components/task/TaskDetailPane.tsx` + its module CSS after merging. Modify `src/App.tsx`, `src/components/task/TaskList.tsx`, `src/components/task/TaskWorkPane.tsx` (absorbed → delete), CSS.

**TaskPage layout (top to bottom):**
1. Header: task title (`--font-display` 600), meta line (`Ref` · `Stamp status` · repo · branch · worktree-with-tooltip · run badges), action row: `work on this` (primary), `start task run`, `run build`, `merge`, and the launch selects (terminal/provider/profile) kept compact; close `×` top-right (closes the page tab).
2. Gate strip (conditional): when a review verdict is pending application OR task status is `reviewing`: amber-bordered row (`--accent` at low mix) with `Stamp`, the latest review summary, `apply verdict` + `request changes` (textarea expands inline on click). This is the top of the page because the verdict is the page's point.
3. `implementation` section, full width: build stamp in the section header (`build-2 · passed` with Stamp), diff type/view pills, file list + diff (all moved from TaskWorkPane, including GitViewEmpty error states).
4. Two-column row: `commits · conflicts` card; `comments · artifact` card (CommentStream, artifact text, moved from TaskDetailPane).
5. Description sits under the header as a muted paragraph (it's short).

**Wiring:**
- `openTaskPage(taskId)` replaces `openWorkView` (same tab keys `work-task-<id>`); TaskPage receives everything TaskDetailPane + TaskWorkPane received (union of props); queries stay keyed to the active page task as today.
- TaskList rows (drawer): row = `Ref` + `Stamp` + title + `→`; clicking opens the task page. Delete the drawer's embedded TaskDetailPane; drawer keeps the task strip/list, repo filter, and new-task form only.
- `AgentRunTerminal`'s `onOpenTask` → `openTaskPage`. The `open work view` button is gone with TaskDetailPane.
- Review mutations (`applyReview`, `requestReviewChanges`) wire into the gate strip; run-launch mutations wire into the action row — all exist in App already.
- `selectedTaskId` survives only if the task-create flow needs it; prefer deriving everything from the active page tab. Report what remains and why.

Verify, commit exactly:
`ui: full-width task page replaces detail pane and work view; drawer is a list`

---

### Task 3: Needs-you cluster + inline input cards (D5 + D4)

**Files:** Create `src/components/notifications/NeedsYou.tsx` + module CSS, `src/components/task/InputDock.tsx` + module CSS. Modify `core/inputs.ts`, `core/tasks.ts` (or a new `core/attention.ts`), `electron/main.ts`, `electron/preload.ts`, `src/vite-env.d.ts`, `src/components/ui/TitleBar.tsx`, `src/App.tsx`, `src/components/task/AgentRunTerminal.tsx`.

**Core/IPC:** new `listAttention(db)` (put it in a new `core/attention.ts`): returns `{ inputs: Array<{ id, shortRef, effortId, effortRef, taskId, taskRef, prompt, type, choices, requestedAt }>, verdicts: Array<{ taskId, taskRef, effortId, effortRef, title, reviewSummary }> }` where inputs = all pending input requests across efforts (join efforts for shortRef) and verdicts = tasks with status `reviewing` plus their latest review summary if any. IPC `attention:list`, bridge `listAttention()`, mirrored in vite-env.d.ts. Renderer polls it with the existing app-state invalidation pattern (`queryKey: ['attention']`, invalidate where inputs/reviews/tasks invalidate).

**NeedsYou (title bar):** rendered inside TitleBar between the mode switch and window controls (TitleBar gains an optional `attention` prop or NeedsYou queries itself — prefer self-contained component querying `['attention']`). Amber Stamp-style chips: `N inputs`, `M verdicts`; hidden when zero. Click opens an anchored popover (portal) with rows grouped by effort: effort ref header, then rows (`Ref input-3` + prompt preview + `→`). Row click: `onNavigate({ effortId, taskId?, inputId? })` — App switches effort, opens the inputs drawer with `focusedInputId` for inputs, or opens the task page for verdicts. A `pulse` imperative: when an input card demotes (Task 3b below), the chip plays a single CSS pulse animation (`@keyframes` scale/glow, respect `prefers-reduced-motion`).

**InputDock (stage):** rendered inside AgentRunTerminal's stage area, absolutely positioned top-right (below the strip), max-width ~420px, stacking up to 2 cards (older collapse into a `+n more` link that opens the inputs drawer). Shows pending inputs whose `runId` or `taskId` matches the active terminal tab's run; only on terminal tabs (never over task pages). Card: amber left border + 2px timer bar animating width 100%→0 over 10s; `Stamp needs you` + `Ref` meta; prompt; answer affordances by type (yesno → two buttons; choice → per-choice buttons; text → input + send). Timer: starts on mount, **pauses on hover/focus-within, cancels permanently on any interaction** (typing/click makes it pinned). On expiry: card animates out toward the top-right and the NeedsYou chip pulses — the input is NOT dismissed or answered, it just leaves the dock. Answering uses the existing `answerInput` mutation; answered cards leave immediately.

Verify, commit exactly:
`feat: needs-you attention cluster and inline input dock`

---

### Task 4: Description folds into the header (D6)

**Files:** Modify `src/App.tsx`, `src/App.css`; `src/components/effort/EffortSummarySection.tsx` usage moves.

- Effort header gains a one-line description preview under the meta line: first line of the description ellipsis-truncated (~140ch max-width), with an `expand` affordance (mono, `--accent`) that toggles the full description inline (and the effort summary section for complete/archived efforts, which currently lives in the description drawer).
- Delete the description drawer: `EffortRailDrawer` becomes `'inputs' | 'plan' | 'tasks'`; remove the rail entry, drawer block, title case, and default-width case for `description`.
- Rail order: inputs, tasks, plan.

Verify, commit exactly:
`ui: effort description folds into the header; description drawer removed`

---

### Task 5: Acceptance (orchestrator)

- Full `bun run build`.
- Screenshot suite: strip with mixed tabs; task page (gate visible); drawer as list; input dock card with timer; demote pulse into needs-you; popover open; folded description (collapsed + expanded); one non-phosphor theme sanity check.
- Nit rounds until the orchestrator is satisfied; tabulated review for Tyler.
