# Task 2 Report

## Status

DONE_WITH_CONCERNS

## What I implemented

- Collapsed the old per-surface mandates and per-template playbooks into one `instructions` concept.
- Added `core/instructions.ts` with list, set/upsert, delete, and repo-over-global resolution behavior.
- Added `core/defaultInstructions.ts` with the exact default body from the brief.
- Reworked schema initialization to drop the pruned tables, create the `instructions` table and unique repo scope index, and seed one default global instructions row.
- Updated generated run context and CLI context output to print one instructions section.
- Replaced `efl mandate` and `efl playbook` with `efl instructions show|set|clear|list`.
- Replaced Electron IPC channels and renderer preload/types with `instructions:list`, `instructions:set`, and `instructions:delete`.
- Replaced the manage surface tabs with one lowercase `instructions` tab supporting global scope and one optional override per repo, with text/file source modes.
- Updated seed/default reseed scripts and docs to use the single instructions concept.

## Files created

- `core/instructions.ts`
- `core/defaultInstructions.ts`
- `cli/src/commands/instructions.ts`
- `src/hooks/useInstructionsMutations.ts`
- `src/components/manage/InstructionsTab.tsx`
- `src/components/manage/InstructionsTab.module.css`
- `.superpowers/sdd/task-2-report.md`

## Files deleted

- `core/mandates.ts`
- `core/defaultMandates.ts`
- `core/templatePlaybooks.ts`
- `core/defaultTemplatePlaybooks.ts`
- `cli/src/commands/mandate.ts`
- `cli/src/commands/playbook.ts`
- `src/hooks/useMandateMutations.ts`
- `src/components/manage/MandateTab.tsx`
- `src/components/manage/MandateTab.module.css`
- `src/components/manage/TemplatePlaybookTab.tsx`
- `src/components/manage/TemplatePlaybookTab.module.css`

## Files changed

- `core/types.ts`
- `core/db.ts`
- `core/contextPacks.ts`
- `cli/src/index.ts`
- `cli/src/help.ts`
- `cli/src/contextSections.ts`
- `cli/src/render.ts`
- `cli/src/commands/task.ts`
- `cli/src/commands/plan.ts`
- `cli/src/commands/effort.ts`
- `cli/src/commands/review.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `src/vite-env.d.ts`
- `src/App.tsx`
- `src/lib/manageSections.tsx`
- `src/components/manage/ManageSurface.tsx`
- `src/components/manage/ManageSurface.module.css`
- `scripts/seed.ts`
- `scripts/reseed-defaults.cjs`
- `docs/agent-definitions/AGENT-effortless.md`
- `docs/run-profiles.md`
- `docs/v2-checklist.md`

## Verification

- `bunx tsc` passed.
- `node scripts/build-cli.mjs` first failed with the expected Go cache permission error: `Access is denied`.
- `$env:GOCACHE = Join-Path (Get-Location) '.gocache'; node scripts/build-cli.mjs` passed.
- `bunx vite build` passed. Vite printed existing-style bundle/chunk warnings, but exited successfully.
- Skipped live `dev:playwright` smoke per task constraints.

## Sweep result

- Active sweep with the plan-file exemption passed with zero hits:
  - `rg -in "mandate|playbook" core cli electron src scripts docs README.md -g "!docs/superpowers/plans/**"`
- The exact unfiltered command reports only the exempt plan file:
  - `docs/superpowers/plans/2026-07-05-prune-effortless.md`

## Self-review findings

- Confirmed `src/vite-env.d.ts` mirrors `electron/preload.ts` for the new IPC API.
- Confirmed `EffortRailDrawer` remains `description | inputs | plan | tasks`.
- Confirmed `cli/src/contextSections.ts` has a single `printInstructions` path and no expanded-reference path was reintroduced.
- Confirmed the manage section label is lowercase `instructions`.
- Confirmed the old table drops still happen while keeping the stale-term sweep clean.
- No code changes were needed after self-review.

## Concerns

- External `tyler-review` attempts did not complete: OpenCode failed on `PRAGMA journal_mode = WAL`, and Cursor failed creating a folder under `.cursor/chats` after retries.
- A workspace-local `.gocache/` directory was created for the successful CLI build retry. It remains untracked because deletion was blocked by policy; it was not staged.
