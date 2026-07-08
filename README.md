# effortless

effortless is a local desktop workbench for coding-agent work that spans multiple sessions, branches, reviews, and human decisions.

You keep using your agent. effortless keeps durable state: what was requested, what is in flight, what is blocked on you, what is ready to merge, and what shipped. Everything stays on your machine: one SQLite database, one Electron app, and one `efl` CLI so agents and the UI share the same record.

## workflow

1. Create an effort with the `bugfix`, `delivery`, or `investigation` template.
2. Add repo-backed tasks when the work needs branches, worktrees, builds, reviews, or merges.
3. Start a run from the app. effortless launches the selected provider in an embedded terminal.
4. The agent reads context with `efl`, records checkpoints, asks for input when blocked, and writes task artifacts.
5. Review task diffs, build status, comments, input requests, and merge state in the app.
6. Complete the effort with a summary of the work.

## surfaces

| surface | use |
| --- | --- |
| effort | request, summary, status, tasks, plans, inputs, and runs |
| plan | approach and decomposition for delivery or investigation work |
| task | repo/worktree-backed implementation |
| review | explicit assessment before merge |
| input | blocking human decisions |
| run | live provider execution in the terminal |

See `docs/agent-definitions/AGENT-effortless.md` for the active-agent operating guide.

## development

```bash
bun install
bun run dev
```

Isolated Electron debugging uses a seeded demo database, separate app data, and CDP on port 9222:

```bash
bun run dev:playwright
```

The app supports `system`, `dark`, and `light` appearance settings.

## cli

The running app hosts the command server used by `efl`. During development, run commands through the package script:

```bash
bun run efl -- effort list
bun run efl -- task context task-1
bun run efl -- context eff-1
bun run efl -- instructions show
```

Useful command families:

```bash
bun run efl -- run providers
bun run efl -- run prepare task-1
bun run efl -- run show run-1
bun run efl -- session set --run run-1
bun run efl -- resume --run run-1
```

## build and seed

```bash
bun run build
bun run seed -- --replace
```

## docs

- `AGENTS.md` - repo guidance for development agents
- `docs/agent-definitions/AGENT-effortless.md` - operating guide for agents running inside effortless
- `docs/electron-ui-debugging.md` - Electron renderer debugging and screenshot workflow
- `docs/native-deps.md` - native dependency and packaging notes
- `docs/monolith-split-plan.md` - current refactor targets for large files
