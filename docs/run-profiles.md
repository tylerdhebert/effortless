# run profiles

Agent profiles define **how** effortless starts an external agent CLI in the embedded terminal.

Configure profiles under **manage → agent profiles**. Each effort can set a default provider and profile.

## environments

| environment | runs on | notes |
|-------------|---------|--------|
| `windows` | Windows host | default; uses PowerShell wrapper around the expanded command |
| `wsl` | WSL distro | launches `wsl.exe`; cwd translated to `/mnt/...`; per-run `efl` wrapper on PATH |

## cwd modes

| mode | cwd |
|------|-----|
| `task_worktree` | task worktree when repo-bound; else effort fallback |
| `repo_root` | registered repo root |
| `custom` | path you pick |

Main effort runs use the first repo-bound task worktree when available, otherwise repo root or custom.

## command template variables

Templates are expanded when a run is prepared. Primary variables:

| variable | meaning |
|----------|---------|
| `{prompt}` | generated startup context (instructions, effort/task state, run bootstrap) |
| `{provider_session_id}` | provider resume id when known |
| `{run_ref}` | run short ref, e.g. `run-12` |

Provider defaults (Codex, Claude, OpenCode, Cursor, Copilot) live in `core/agentProviders.ts`. Profile templates override the command shape.

Examples:

```text
codex {prompt}
cursor-agent {prompt}
opencode --prompt {prompt}
```

If the template has **no** placeholders, effortless appends the prompt as a trailing argument.

## profile environment variables

Key/value pairs merged into the PTY environment together with run env:

| name | set by |
|------|--------|
| `EFFORTLESS_RUN` | run ref |
| `EFFORTLESS_RUN_ID` | numeric id |
| `EFFORTLESS_RUN_LABEL` | run label |
| `EFFORTLESS_EFFORT` | effort ref |
| `EFFORTLESS_TASK` | task ref when scoped |
| `EFFORTLESS_TASK_ID` | task id when scoped |

WSL runs also put a generated `efl` wrapper on PATH that calls the Windows `efl.cmd` against the same database.

## windows setup

1. Install the agent CLI on PATH (`codex`, `cursor-agent`, `opencode`, etc.).
2. Create a profile with environment **windows**.
3. Set command template, e.g. `codex {prompt}`.
4. Pick cwd mode (usually `task_worktree` for implementation).
5. Use **validate** on the profile before relying on it.

If start fails with “command was not found on PATH”, fix the template executable name or install the CLI.

## wsl setup

1. Install the agent CLI inside the chosen WSL distro.
2. Create a profile with environment **wsl** and select the distro.
3. Use a Linux-friendly command template.
4. Ensure the Windows effortless app is running so `efl` transport works.
5. From a WSL run, call `efl task checkpoint` via the generated wrapper to confirm shared DB access.

## agents updating state

Agents should run inside the embedded terminal (or any shell with `efl` pointed at the running app) and use the CLI documented in `docs/agent-definitions/AGENT-effortless.md`.

Minimum bootstrap after start:

```bash
efl session set --run <run-ref>
```

Then checkpoints, artifacts, inputs, and builds as needed. Run env vars supply `EFFORTLESS_*` so `--task` / `--run` can often be omitted.
