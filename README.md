# effortless

effortless is a **local workbench for coding-agent work** — the kind that spans multiple sessions, branches, reviews, and human decisions, not a single chat thread.

You keep using your agent (Codex, OpenCode, Claude Code, or whatever you configure). effortless keeps **durable state**: what was requested, what’s in flight, what’s blocked on you, what’s ready to merge, and what actually shipped.

Everything stays on your machine. One SQLite database, one desktop app, one `efl` CLI so agents and the UI never disagree about reality.

## why effortless

Agent sessions are fast. **Coordination is not.** Without a spine, you end up with:

- context that lives only in a terminal scrollback
- branches and worktrees you forgot were part of the same ask
- “done” that meant different things to you and the agent
- reviews and human choices scattered across chat

effortless treats an **effort** as the unit of work: your original request plus plans, tasks, reviews, structured input requests, runs, and a final summary. Global and per-repo **instructions** shape agent behavior; tasks are repo-backed when they need to be; runs happen in embedded terminals; agents update state through `efl` while you steer from the app.

**Good fit:** multi-step delivery, explicit review/merge discipline, human gates, local auditability.

**Not trying to be:** a replacement for your agent’s chat UI — the terminal inside effortless *is* that UI, wrapped in job control.

## how it works

1. **Open an effort** — bugfix, delivery, or investigation template sets the shape of the work.
2. **Start** — effortless builds context and launches your configured agent in the effort terminal (main or task-scoped).
3. **Work** — the agent reads context via `efl`, checkpoints progress, requests input when blocked, and records artifacts.
4. **Review** — diffs, builds, conflicts, reviews, and merge state live in the app, not in your head.
5. **Close the loop** — effort summary and task status reflect what actually happened.

Agents work in **worktrees** where it matters. You answer **input requests** (yes/no, choice, text) when a decision blocks truthful handoff. Reviews are explicit verdicts, not vibes.

## surfaces (quick map)

| surface | for |
|---------|-----|
| effort | the request, summary, overall status |
| plan | approach and decomposition (delivery / investigation) |
| task | implementation on a branch/worktree |
| review | independent assessment before merge |
| input | blocking human decisions |
| run | live agent execution in the terminal (purpose: main, fork, or extra) |

See `docs/agent-definitions/AGENT-effortless.md` for how an agent should behave inside this model.

## development

```bash
bun install
bun run dev
```

**Isolated debugging** (seeded demo DB, separate app data, CDP on port 9222):

```bash
bun run dev:playwright
```

**CLI** (same database as the running app when launched from Electron):

```bash
bun run efl -- effort list
bun run efl -- task context task-1
bun run efl -- context eff-1
bun run efl -- instructions show
```

**Build / seed:**

```bash
bun run build
bun run seed -- --replace
```

Agent and automation notes: `AGENTS.md`.

Runner docs: `docs/run-profiles.md`, `docs/native-deps.md`.

Electron UI debugging and visual verification: `docs/electron-ui-debugging.md`.
