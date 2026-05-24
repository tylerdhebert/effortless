# Effortless V2 Checklist

All development work for this refactor happens on the `main-v2` branch.

## North Star

Effortless V2 is a local workbench for a single primary coding agent plus optional bounded side runs.

The core loop is:

1. Select an effort and task.
2. Click `Start`.
3. Effortless builds an effort context prompt and launches the configured main agent in the effort terminal.
4. Let the agent read generated context and update Effortless through `efl`.
5. Review diffs, builds, conflicts, inputs, reviews, and merge state in the app.
6. Keep durable state in efforts, plans, tasks, reviews, inputs, references, mandates, and runs.

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
- [x] Remove discussion mandates/playbooks from built-in defaults.
- [x] Validate effort templates at runtime.
- [x] Validate mandate work surfaces at runtime.
- [x] Update seed and migration scripts away from discussion rows.
- [x] Replace `ORCHESTRATOR-effortless.md` with `AGENT-effortless.md`.
- [x] Build verification: `bun run build`.
- [x] Commit: `b2eead3 refactor: shift to single agent workflow`.

## Phase 2A: Run Foundation

- [x] Add `AgentProfile` types.
- [x] Add `AgentRun` types.
- [x] Add nullable future session fields for provider resume identity and terminal tab identity.
- [x] Add `agent_profiles` table.
- [x] Add `agent_runs` table.
- [x] Seed a default agent profile.
- [x] Add profile list/create/update core service.
- [x] Add prepared task-run core service.
- [x] Add effort-level main-run core service.
- [x] Generate task run startup prompts.
- [x] Generate effort run startup prompts.
- [x] Expand command templates with run variables.
- [x] Return run environment variables for launched agents.
- [x] Include profile-level environment variables in prepared run env.
- [x] Expose profile and run APIs through Electron IPC.
- [x] Expose profile and run APIs through preload types.
- [x] Add `efl run profiles`.
- [x] Add `efl run prepare --task task-1`.
- [x] Add `efl run prepare --effort eff-1`.
- [x] Add `efl run list`.
- [x] Improve `efl run profiles` output readability.
- [x] Validate `--profile` CLI input.
- [x] Let task/build/input CLI commands infer task/agent from run environment variables.
- [x] Keep task status unchanged during prepare.
- [x] Move task status to `in-flight` when a run is marked started.
- [x] Build verification: `bun run build`.
- [x] Smoke verification: `efl run profiles`.
- [x] Commit: `194a7d8 feat: add prepared agent runs`.

## Phase 2B: Run UI Foundation

- [x] Query agent profiles in the renderer.
- [x] Query task runs for the selected task.
- [x] Add task detail `start` action.
- [x] Show runs in the task detail pane.
- [x] Show default profile in task detail.
- [x] Show run cwd.
- [x] Build verification: `bun run build`.
- [x] Commit: `604f6a4 feat: show prepared task runs`.
- [x] Build verification after file-open follow-up: `bun run build`.
- [x] Commit current runner/schema/UI batch.

## Phase 2B.5: Schema Trim

- [x] Remove task ownership/review policy/auto-merge/conflict cache/merge timestamp fields from active model.
- [x] Remove effort plan-review and needs-tasks flags from active model.
- [x] Remove plan author/ready/accepted timestamp fields from active model.
- [x] Remove review author/applied timestamp fields from active model.
- [x] Scope input requests to effort/task/run.
- [x] Remove plan/review/context/bootstrap fields from active run model.
- [x] Collapse plan/task comment storage into `activity_events`.
- [x] Clean removed fields out of renderer UI and CLI output.
- [x] Keep the schema free of removed columns and tables.
- [x] Remove pre-v2 migration code.
- [x] Build verification: `bun run build`.
- [x] Smoke verification: `efl run prepare --effort eff-4 --label trim-smoke`.

## Phase 2C: Agent Profile Management UI

- [x] Add an Agent Profiles section to Manage.
- [x] List profiles with name, command template, environment, cwd mode, and env count.
- [x] Create profile form.
- [x] Edit profile form.
- [x] Delete profile support only after handling runs that reference the profile.
- [x] Let an effort choose its default profile.
- [x] Show the selected effort profile in the effort header.
- [x] Use the effort default profile when starting the main effort run.
- [x] Let a task choose terminal target and profile before launch.
- [x] Let a task start a dedicated task run with the chosen profile.
- [x] Let a task send context into the main effort terminal while still choosing the profile used for new launches.
- [x] Choose environment: `windows` or `wsl`.
- [x] Configure WSL distro.
- [x] Configure cwd mode: task worktree, repo root, custom.
- [x] Configure custom cwd with path picker.
- [x] Configure command template.
- [x] Configure environment variables.
- [x] Show supported command-template variables.
- [x] Show `{prompt}` as the primary startup variable.
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
- [x] Document native rebuild notes in repo docs.
- [x] Keep the runner UI guarded when PTY initialization fails.
- [x] Build verification: `bun run build`.

## Phase 2E: Electron Run Manager

- [x] Add `electron/runManager.ts`.
- [x] Start a prepared run in a PTY.
- [x] Start a task run directly from the task surface.
- [x] Move the visible terminal to the effort surface.
- [x] Mark run `running` when the process starts.
- [x] Stream PTY output to renderer.
- [x] Accept terminal input from renderer.
- [x] Resize PTY from renderer.
- [x] Stop a running process.
- [x] Mark run `exited` with exit code.
- [x] Mark run `failed` with error message.
- [x] Mark run `cancelled` when stopped by user.
- [x] Clean up PTY processes on window close/app quit.
- [x] Prevent two active PTY processes for the same run.
- [x] Keep multiple simultaneous task runs technically possible while showing one active task terminal first.
- [x] Build verification: `bun run build`.

## Phase 2F: Terminal IPC And Preload

- [x] Add `agentRuns:start`.
- [x] Add `agentRuns:write`.
- [x] Add `agentRuns:resize`.
- [x] Add `agentRuns:stop`.
- [x] Add terminal-output event subscription in preload.
- [x] Add terminal-status event subscription in preload.
- [x] Add unsubscribe handling for renderer event listeners.
- [x] Type all run IPC payloads in `src/vite-env.d.ts`.
- [x] Build verification: `bun run build`.

## Phase 2G: Effort Terminal UI

- [x] Add terminal component.
- [x] Add terminal styles.
- [x] Render xterm terminal for selected run.
- [x] Fit terminal to panel size.
- [x] Focus terminal after start.
- [x] Support keyboard input, paste, Ctrl+C, Escape, arrows, and Tab through xterm PTY input.
- [x] Show run status.
- [x] Show run command in the terminal header/details.
- [x] Show run cwd in the terminal preface.
- [x] Start a new task run.
- [x] Start a main effort run from the effort terminal.
- [x] Stop running run.
- [x] Let the effort surface choose the profile before starting main.
- [x] Rerun from existing task context by preparing a new run.
- [x] Keep task detail layout stable on narrow screens.
- [x] Build verification: `bun run build`.

## Phase 2H: Windows Profiles

- [x] Launch Windows profile commands in the task worktree.
- [x] Pass run env vars into the child process.
- [x] Pass profile env vars into the child process.
- [x] Quote injected prompt text safely.
- [x] Support command templates such as `codex {prompt}`, `claude {prompt}`, and `opencode {prompt}`.
- [x] Validate default profile command expansion through `efl run prepare`.
- [x] Add useful failure message when the command is missing.
- [ ] Build verification: `bun run build`.

## Phase 2I: WSL Profiles

- [x] Launch `wsl.exe` through the PTY for WSL profiles.
- [x] Support selected distro.
- [x] Translate worktree path to WSL path.
- [x] Add fallback Windows-to-WSL path converter.
- [x] Generate per-run WSL `efl` wrapper.
- [x] Put generated wrapper directory on PATH inside WSL run.
- [x] Ensure wrapper calls the Windows `efl.cmd` against the same database.
- [x] Handle wrapper quoting safely.
- [x] `chmod +x` generated wrapper when needed.
- [ ] Validate `efl task checkpoint` works from WSL.
- [ ] Validate UI updates after WSL-side `efl` writes state.
- [ ] Add profile validation command for WSL.
- [ ] Build verification: `bun run build`.

## Phase 2J: Run-Aware CLI Polish

- [x] Infer `--task` for task commands from `EFFORTLESS_TASK`.
- [x] Infer `--task` for build commands from `EFFORTLESS_TASK`.
- [x] Infer input target task from `EFFORTLESS_TASK`.
- [x] Infer activity author label from `EFFORTLESS_RUN_LABEL`.
- [x] Add `efl run show --run run-1`.
- [x] Add `efl run start --run run-1` if CLI-driven starts become useful.
- [x] Add `efl run fail --run run-1 --body ...` for manual recovery.
- [x] Add `efl run cancel --run run-1`.
- [x] Add `efl run env --run run-1`.
- [x] Allow `efl task checkpoint --body ...` with inferred task and activity label.
- [x] Allow `efl task artifact --body ...` with inferred task and activity label.
- [x] Allow `efl build run` with inferred task.
- [x] Add `efl input answer --input input-1 --answer ...`.
- [x] Add `efl input request --no-wait`.
- [ ] Build verification: `bun run build`.

## Phase 2J.5: App-Owned CLI Transport

- [x] Start a local authenticated command server from the Electron main process.
- [x] Run existing `efl` command handlers inside the app process against the app-owned DB handle.
- [x] Make CLI argument state injectable for app-hosted command execution.
- [x] Make CLI database access lazy so importing CLI handlers does not open a second SQLite connection.
- [x] Serialize app-hosted CLI command execution to avoid global console/env/exit-code capture bleed.
- [x] Replace Electron-as-Node `efl.cmd` execution with a tiny native Go transport client.
- [x] Forward caller cwd and run environment variables through the native client.
- [x] Forward `CODEX_THREAD_ID` through the native client for Codex session capture.
- [x] Package `efl.exe` as the helper CLI under Electron Builder extra resources.
- [x] Keep the Windows `efl.cmd` wrapper as a thin launcher for `efl.exe`.
- [x] Smoke verification: dev `efl.cmd effort list` against a running packaged app.
- [x] Smoke verification: packaged `efl.cmd effort list` against a running packaged app.
- [x] Build verification: `bun run build`.

## Phase 2J.6: Provider Session And Resume CLI

- [x] Add provider session helpers that can resolve a provider session id from explicit CLI input or provider-specific environment variables.
- [x] Implement Codex session id detection from `CODEX_THREAD_ID`.
- [x] Add switch cases for future providers such as OpenCode, Claude, and custom profiles.
- [x] Add `efl session set --run run-1 [--id ...] [--provider codex]`.
- [x] Add `efl session set --effort eff-1 [--id ...] [--provider codex]`.
- [x] Resolve `efl session set --effort` to the most relevant running/prepared effort run.
- [x] Add `efl session show --run run-1`.
- [x] Add `efl session show --effort eff-1`.
- [x] Update Codex startup context to ask the agent to run `efl session set --run <run-ref>`.
- [x] Add `efl resume --run run-1`.
- [x] Add `efl resume --effort eff-1`.
- [x] Build provider-specific resume commands, starting with `codex resume <session-id>`.
- [x] Keep resume as CLI-only behavior for this phase.
- [ ] TODO: execute resume command via child_process.spawn when safe (currently print-only to avoid Electron stdio issues).

## Phase 2K: Run Status And Notifications

- [x] Show active run badges in task list.
- [x] Show active run count on effort.
- [x] Show failed run state in task detail.
- [x] Show completed run state in task detail.
- [x] Add notification kind for failed run if useful.
- [x] Add notification kind for waiting input tied to a run if useful.
- [x] Refresh run/task queries on terminal exit and error events.
- [x] Keep app-state polling invalidation working for CLI updates.
- [x] Build verification: `bun run build`.

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

- [x] Prepare true effort-level main run.
- [x] Generate effort-level context pack.
- [x] Use effort and run mandates.
- [x] Support main runs not tied to a task.
- [ ] Support investigation/planning side runs not tied to a task.
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

- [x] Survive renderer reload while run process continues.
- [x] Reattach UI to running process after renderer reload.
- [x] Recover run list after app restart.
- [x] Mark orphaned running runs clearly on app start.
- [x] Add context file overwrite behavior for reruns.
- [x] Handle missing worktree paths.
- [x] Build verification: `bun run build`.
- [x] Commit: `cbd443f feat: improve runner reliability across reloads and restarts`.

## Phase 2P: Documentation

- [x] Update README with single-agent runner workflow.
- [x] Document run profiles.
- [x] Document Windows profile setup.
- [x] Document WSL profile setup.
- [x] Document command-template variables.
- [x] Document environment variables.
- [x] Document how agents update Effortless through `efl`.
- [x] Update `AGENT-effortless.md` after the real runner exists.
- [ ] Build verification: `bun run build`.

## Phase 2P.5: CLI Help And Bare-Agent Onboarding

- [x] Rewrite top-level `efl --help` so a fresh agent can understand the main loop without already knowing Effortless vocabulary.
- [x] Add command-specific help examples for the core agent flow: session bind, effort context, task context, checkpoint, artifact, input request, run show/list, and run recovery.
- [x] Make CLI help explain which commands infer `--run`, `--effort`, and `--task` from the active run environment.
- [x] Add a concise bare-agent quickstart that teaches the intended flow: bind session, read context, work in the right surface, checkpoint durable state, request input when blocked, and summarize before handoff.
- [x] Add provider-neutral startup guidance that fits Codex, Cursor, OpenCode, and Claude Code without assuming the agent has seen Effortless before.
- [x] Keep help output compact by default, with examples and deeper explanation available through explicit help/detail commands.
- [ ] Dogfood with a fresh agent and record where it still fumbles.

## Phase 2Q: Final Acceptance

- [ ] Fresh database initializes without discussion surfaces.
- [ ] Fresh database initializes with default agent profile.
- [x] User can create effort.
- [x] User can create repo-bound task.
- [x] User can prepare an effort run.
- [ ] User can prepare a task run.
- [x] User can start an embedded terminal run.
- [x] Agent starts in the task worktree.
- [x] Agent can call `efl task checkpoint`.
- [ ] UI updates after CLI state changes.
- [x] Agent can request input.
- [x] User can answer input.
- [ ] Agent can run build.
- [ ] User can inspect diff/commits/conflicts.
- [ ] User can mark task ready.
- [ ] User can approve/review/merge task.
- [ ] WSL profile can start in WSL and call `efl`.
- [ ] Windows profile can start on Windows and call `efl`.
- [ ] Packaged app can load native PTY dependency.
- [x] `bun run build` passes.

## Current Open Work

- [x] Commit the run-row file-open follow-up.
- [x] Implement profile management UI.
- [x] Add PTY dependencies and prove Electron packaging.
- [x] Build Electron run manager.
- [x] Render embedded terminal.
- [x] Trim schema for single-agent plus bounded side-run workflow.
