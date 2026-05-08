# Effortless V2 Checklist

All development work for this refactor happens on the `main-v2` branch.

## North Star

Effortless V2 is a local workbench for a single primary coding agent plus optional bounded side runs.

The core loop is:

1. Select an effort and task.
2. Prepare the task worktree and run context.
3. Launch the configured agent in an embedded terminal.
4. Let the agent read generated context and update Effortless through `efl`.
5. Review diffs, builds, conflicts, inputs, reviews, and merge state in the app.
6. Keep durable state in efforts, plans, tasks, reviews, inputs, references, mandates, runs, and transcripts.

## Phase 1: Single-Agent Cleanup

- [x] Create `main-v2` branch for this refactor.
- [x] Replace standing orchestrator guidance with active-agent guidance.
- [x] Remove first-class discussion UI.
- [x] Remove `efl discuss`.
- [x] Remove discussion service code.
- [x] Remove `discussion` from effort templates.
- [x] Remove `discussion` from default template playbooks.
- [x] Remove `discussion` from default mandates.
- [x] Add `run` as a mandate surface.
- [x] Hide deprecated discussion mandates/playbooks from normal lists.
- [x] Refresh legacy built-in defaults when they still match old built-in text.
- [x] Keep legacy `discussion_messages` tables in existing databases for compatibility.
- [x] Validate effort templates at runtime.
- [x] Validate mandate work surfaces at runtime.
- [x] Update seed and migration scripts away from discussion rows.
- [x] Replace `ORCHESTRATOR-effortless.md` with `AGENT-effortless.md`.
- [x] Build verification: `bun run build`.
- [x] Commit: `b2eead3 refactor: shift to single agent workflow`.

## Phase 2A: Prepared Run Foundation

- [x] Add `AgentProfile` types.
- [x] Add `AgentRun` types.
- [x] Add `agent_profiles` table.
- [x] Add `agent_runs` table.
- [x] Seed a default agent profile.
- [x] Add profile list/create/update core service.
- [x] Add prepared task-run core service.
- [x] Add context/bootstrap/transcript path generation.
- [x] Write task run `context.md`.
- [x] Write task run `bootstrap.md`.
- [x] Create empty `transcript.txt`.
- [x] Expand command templates with run variables.
- [x] Return run environment variables for launched agents.
- [x] Include profile-level environment variables in prepared run env.
- [x] Expose profile and run APIs through Electron IPC.
- [x] Expose profile and run APIs through preload types.
- [x] Add `efl run profiles`.
- [x] Add `efl run prepare --task task-1`.
- [x] Add `efl run list`.
- [x] Improve `efl run profiles` output readability.
- [x] Validate `--profile` CLI input.
- [x] Let task/build/input CLI commands infer task/agent from run environment variables.
- [x] Keep task status unchanged during prepare.
- [x] Move task status to `in-flight` when a run is marked started.
- [x] Build verification: `bun run build`.
- [x] Smoke verification: `efl run profiles`.
- [x] Commit: `194a7d8 feat: add prepared agent runs`.

## Phase 2B: Prepared Run UI

- [x] Query agent profiles in the renderer.
- [x] Query task runs for the selected task.
- [x] Add task detail `prepare run` action.
- [x] Show prepared runs in the task detail pane.
- [x] Show default profile in task detail.
- [x] Show run cwd and context path.
- [x] Build verification: `bun run build`.
- [x] Commit: `604f6a4 feat: show prepared task runs`.
- [x] Open generated `context.md` from a run row.
- [x] Open generated `bootstrap.md` from a run row.
- [x] Open generated `transcript.txt` from a run row.
- [x] Build verification after file-open follow-up: `bun run build`.
- [ ] Commit open-file run-row follow-up.

## Phase 2C: Agent Profile Management UI

- [x] Add an Agent Profiles section to Manage.
- [x] List profiles with name, command template, environment, cwd mode, and env count.
- [x] Create profile form.
- [x] Edit profile form.
- [ ] Delete profile support only after handling runs that reference the profile.
- [x] Choose environment: `windows` or `wsl`.
- [x] Configure WSL distro.
- [x] Configure cwd mode: task worktree, repo root, custom.
- [x] Configure custom cwd with path picker.
- [x] Configure command template.
- [x] Configure environment variables.
- [x] Show supported command-template variables.
- [x] Validate command templates before saving.
- [x] Add profile validation action.
- [x] Build verification: `bun run build`.

## Phase 2D: Embedded Terminal Dependencies

- [x] Add `node-pty`.
- [x] Add `@xterm/xterm`.
- [x] Add `@xterm/addon-fit`.
- [x] Confirm whether extra typings are needed.
- [x] Verify Vite/Electron build compiles with native dependency imports.
- [x] Verify packaged app includes `node-pty` Win x64 prebuilds.
- [x] Configure Electron Builder to skip Bun-driven native rebuilds.
- [x] Configure ASAR unpack rules for `better-sqlite3` and `node-pty` native files.
- [ ] Document native rebuild notes in repo docs.
- [ ] Keep the runner UI guarded when PTY initialization fails.
- [x] Build verification: `bun run build`.

## Phase 2E: Electron Run Manager

- [x] Add `electron/runManager.ts`.
- [x] Start a prepared run in a PTY.
- [x] Mark run `running` when the process starts.
- [x] Stream PTY output to renderer.
- [x] Append PTY output to transcript file.
- [x] Accept terminal input from renderer.
- [x] Resize PTY from renderer.
- [x] Stop a running process.
- [x] Mark run `exited` with exit code.
- [x] Mark run `failed` with error message.
- [x] Mark run `cancelled` when stopped by user.
- [x] Clean up PTY processes on window close/app quit.
- [x] Prevent two active PTY processes for the same run.
- [ ] Decide whether multiple simultaneous task runs are allowed in the first implementation.
- [x] Build verification: `bun run build`.

## Phase 2F: Terminal IPC And Preload

- [x] Add `agentRuns:start`.
- [x] Add `agentRuns:write`.
- [x] Add `agentRuns:resize`.
- [x] Add `agentRuns:stop`.
- [ ] Add `agentRuns:openExternal`.
- [x] Add terminal-output event subscription in preload.
- [x] Add terminal-status event subscription in preload.
- [x] Add unsubscribe handling for renderer event listeners.
- [x] Type all run IPC payloads in `src/vite-env.d.ts`.
- [x] Build verification: `bun run build`.

## Phase 2G: Task Run Terminal UI

- [ ] Add `src/components/run/RunPanel.tsx`.
- [ ] Add `src/components/run/RunTerminal.tsx`.
- [ ] Add `src/components/run/RunPanel.module.css`.
- [ ] Render xterm terminal for selected run.
- [ ] Fit terminal to panel size.
- [ ] Focus terminal after start.
- [ ] Support keyboard input, paste, Ctrl+C, Escape, arrows, and Tab.
- [ ] Show run status.
- [ ] Show run command.
- [ ] Show run cwd.
- [ ] Start selected prepared run.
- [ ] Stop running run.
- [ ] Rerun from existing task context by preparing a new run.
- [ ] Open external terminal fallback.
- [ ] Show transcript-open action.
- [ ] Show context/bootstrap-open actions.
- [ ] Keep task detail layout stable on narrow screens.
- [ ] Build verification: `bun run build`.

## Phase 2H: Windows Profiles

- [ ] Launch Windows profile commands in the task worktree.
- [ ] Pass run env vars into the child process.
- [ ] Pass profile env vars into the child process.
- [ ] Quote command/bootstrap/context paths safely.
- [ ] Support command templates such as `codex`, `claude`, and `opencode`.
- [ ] Validate default profile can start a shell or configured agent CLI.
- [ ] Add useful failure message when the command is missing.
- [ ] Build verification: `bun run build`.

## Phase 2I: WSL Profiles

- [ ] Launch `wsl.exe` through the PTY for WSL profiles.
- [ ] Support selected distro.
- [ ] Translate worktree path to WSL path.
- [ ] Translate context path to WSL path.
- [ ] Translate bootstrap path to WSL path.
- [ ] Translate transcript path where needed.
- [ ] Prefer `wslpath` for translation.
- [ ] Add fallback Windows-to-WSL path converter.
- [ ] Generate per-run WSL `efl` wrapper.
- [ ] Put generated wrapper directory on PATH inside WSL run.
- [ ] Ensure wrapper calls the Windows `efl.cmd` against the same database.
- [ ] Handle wrapper quoting safely.
- [ ] `chmod +x` generated wrapper when needed.
- [ ] Validate `efl task checkpoint` works from WSL.
- [ ] Validate UI updates after WSL-side `efl` writes state.
- [ ] Add profile validation command for WSL.
- [ ] Build verification: `bun run build`.

## Phase 2J: Run-Aware CLI Polish

- [x] Infer `--task` for task commands from `EFFORTLESS_TASK`.
- [x] Infer `--task` for build commands from `EFFORTLESS_TASK`.
- [x] Infer input target task from `EFFORTLESS_TASK`.
- [x] Infer agent id from `EFFORTLESS_RUN_LABEL` or `EFFORTLESS_AGENT_ID`.
- [ ] Add `efl run show --run run-1`.
- [ ] Add `efl run start --run run-1` if CLI-driven starts become useful.
- [ ] Add `efl run fail --run run-1 --body ...` for manual recovery.
- [ ] Add `efl run cancel --run run-1`.
- [ ] Add `efl run context --run run-1`.
- [ ] Add `efl run env --run run-1`.
- [ ] Allow `efl task checkpoint --body ...` with inferred task and agent.
- [ ] Allow `efl task artifact --body ...` with inferred task and agent.
- [ ] Allow `efl build run` with inferred task.
- [ ] Build verification: `bun run build`.

## Phase 2K: Run Status And Notifications

- [ ] Show active run badges in task list.
- [ ] Show active run count on effort.
- [ ] Show failed run state in task detail.
- [ ] Show completed run state in task detail.
- [ ] Add notification kind for failed run if useful.
- [ ] Add notification kind for waiting input tied to a run if useful.
- [ ] Keep app-state polling invalidation working for CLI updates.
- [ ] Build verification: `bun run build`.

## Phase 2L: Review Runs

- [ ] Prepare review run from a task.
- [ ] Generate review-specific context pack.
- [ ] Include task diff/build/commit context.
- [ ] Use review mandate.
- [ ] Support read-only review command profile guidance.
- [ ] Allow review run to create `Review` records.
- [ ] Show review runs in task detail.
- [ ] Build verification: `bun run build`.

## Phase 2M: Effort-Level Runs

- [ ] Prepare effort-level run.
- [ ] Generate effort-level context pack.
- [ ] Use effort and run mandates.
- [ ] Support investigation/planning runs not tied to a task.
- [ ] Show effort-level run list.
- [ ] Let effort-level run create plans, tasks, inputs, and summaries.
- [ ] Build verification: `bun run build`.

## Phase 2N: Side Runs

- [ ] Add explicit side-run purpose choices.
- [ ] Support side investigation runs.
- [ ] Support independent review runs.
- [ ] Support disjoint implementation runs only when task/worktree ownership is clear.
- [ ] Show side runs separately from main run.
- [ ] Prevent side-run UI from becoming default workflow clutter.
- [ ] Build verification: `bun run build`.

## Phase 2O: Runner Reliability

- [ ] Persist transcript incrementally.
- [ ] Survive renderer reload while run process continues.
- [ ] Reattach UI to running process after renderer reload.
- [ ] Recover run list after app restart.
- [ ] Mark orphaned running runs clearly on app start.
- [ ] Add transcript size guard.
- [ ] Add context file overwrite behavior for reruns.
- [ ] Handle missing worktree paths.
- [ ] Handle deleted repos/tasks referenced by old runs.
- [ ] Build verification: `bun run build`.

## Phase 2P: Documentation

- [ ] Update README with single-agent runner workflow.
- [ ] Document run profiles.
- [ ] Document Windows profile setup.
- [ ] Document WSL profile setup.
- [ ] Document command-template variables.
- [ ] Document environment variables.
- [ ] Document how agents update Effortless through `efl`.
- [ ] Document transcript/context/bootstrap file locations.
- [ ] Update `AGENT-effortless.md` after the real runner exists.
- [ ] Build verification: `bun run build`.

## Phase 2Q: Final Acceptance

- [ ] Fresh database initializes without discussion surfaces.
- [ ] Fresh database initializes with default agent profile.
- [ ] User can create effort.
- [ ] User can create repo-bound task.
- [ ] User can prepare a task run.
- [ ] User can inspect context/bootstrap/transcript files.
- [ ] User can start an embedded terminal run.
- [ ] Agent starts in the task worktree.
- [ ] Agent can call `efl task checkpoint`.
- [ ] UI updates after CLI state changes.
- [ ] Agent can request input.
- [ ] User can answer input.
- [ ] Agent can run build.
- [ ] User can inspect diff/commits/conflicts.
- [ ] User can mark task ready.
- [ ] User can approve/review/merge task.
- [ ] WSL profile can start in WSL and call `efl`.
- [ ] Windows profile can start on Windows and call `efl`.
- [ ] Packaged app can load native PTY dependency.
- [ ] `bun run build` passes.

## Current Open Work

- [ ] Commit the run-row file-open follow-up.
- [x] Implement profile management UI.
- [x] Add PTY dependencies and prove Electron packaging.
- [x] Build Electron run manager.
- [ ] Render embedded terminal.
