# monolith split plan

Refactor targets for the next session - files that have grown monolithic, with suggested split boundaries.

1. `src/App.tsx` (~1740 lines) - conflates routing, global query orchestration, theme application, run/tab state, task-page lifecycle, notifications, drawers, and effort CRUD. Split: extract hooks `src/app/useEffortWorkspace.ts`, `src/app/useRunTabs.ts`, `src/app/useAgentRunActions.ts`; move JSX to `EffortSurface.tsx`, `EffortHeader.tsx`, `EffortDrawer.tsx`, `CollapsedSidebar.tsx`, `EffortModals.tsx`.

2. `src/App.css` (~1543 lines) - global shell, collapsed sidebar, effort header, terminal stage, rail/drawer, task drawer, modals, empty states. Split into component-scoped CSS modules alongside the `App.tsx` extraction: shell, effort header, drawer/rail, collapsed sidebar, modals.

3. `src/components/task/AgentRunTerminal.tsx` (~1443 lines) - xterm lifecycle/sizing, tab strip, create/run menus, input dock hosting, work-pane hosting, idle wordmark art. Split: `useXtermSessions.ts`, `useTerminalFit.ts`, `TerminalTabStrip.tsx`, `CreateRunMenu.tsx`, `RunSwitcherMenu.tsx`, `IdleTerminalArt.ts`.

4. `src/components/task/TaskPage.tsx` (~834 lines) - task launch header, review gate, build/diff workbench, comments/artifacts, popovers, diff parsing, syntax highlighting. Split: `TaskPageHeader.tsx`, `TaskReviewGate.tsx`, `TaskImplementationWorkbench.tsx`, `TaskActivityRail.tsx`; move `DiffFile` and helpers to `src/components/diff/`.

5. `core/agentRuns.ts` (~629 lines) - run repository ops, preparation workflows, provider command expansion, cwd/env resolution, status transitions. Split: `agentRunRepository.ts`, `agentRunPreparation.ts`, `runEnvironment.ts`, `providerRunCommands.ts`.

6. `core/db.ts` (~467 lines) - schema creation, legacy resets, provider migrations, app state, notification settings, default instruction seeding. Split: `schema.ts`, `migrations.ts`, `appState.ts`, `notificationSettings.ts`, `seedDefaults.ts`.

7. `electron/runManager.ts` (~411 lines) - PTY sessions, WSL/Windows shell script construction, cwd validation, sentinel parsing, generated wrappers. Split: keep `RunManager` for sessions; extract `shellLaunch.ts`, `wslLauncher.ts`, `providerSentinel.ts`.

8. `electron/main.ts` (~348 lines) - app bootstrap, DB/run manager setup, all IPC routes, notifications, debug screenshots, window controls. Split: `electron/window.ts`, `electron/ipc/register*.ts`, `electron/debugCapture.ts`, `electron/notifications.ts`.

9. `cli/native/efl/main.go` (~330 lines) - native CLI transport, server-state discovery, env forwarding, command posting, wait loops for input/task approvals. Split: `client.go`, `state.go`, `wait.go`, `env.go`.
