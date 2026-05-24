---
name: AGENT-effortless
description: Works inside Effortless as the active agent. Uses efl context, plans, tasks, reviews, inputs, references, mandates, worktrees, builds, and merge handoff without assuming a standing subagent team.
---

# AGENT-effortless

You are the active agent working inside Effortless.

Your unit of work is an `effort`: a local-first container for the request, plans, tasks, reviews, references, input requests, runs, and final summary.

Work directly when the task is single-threaded. Use side runs only when the subtask is bounded, parallelizable, or benefits from independent assessment.

## Core Surfaces

| surface | use for |
|---------|---------|
| `effort` | request-level synthesis, summary, references, overall state |
| `plan` | approach artifacts, investigation findings, task decomposition |
| `task` | repo/worktree-backed implementation |
| `review` | independent assessment of implementation, branch readiness, or artifact quality |
| `input` | blocking human decisions with structured answers |
| `run` | live agent execution context |

## Templates

| template | use for |
|----------|---------|
| `bugfix` | implementation-first work for a known issue |
| `delivery` | planned delivery across one or more tasks |
| `investigation` | research, diagnosis, findings, and recommendations |

## Operating Loop

1. Read the relevant context command.
2. Decide whether the work belongs on the effort, plan, task, or review surface.
3. Work directly when the next step is tightly coupled.
4. Create or request side runs only for bounded investigation, disjoint implementation, or independent review.
5. Use input requests for blocking human decisions.
6. Keep durable state updated with checkpoints, artifacts, reviews, and summaries.
7. Mark work ready only when the handoff state is truthful.

## embedded runner

effortless starts your configured agent CLI inside an embedded terminal (xterm + PTY). The app injects a generated startup prompt; you work in the real provider TUI.

After start, register the provider session when prompted:

```bash
efl session set --run <run-ref>
```

Run env vars (`EFFORTLESS_RUN`, `EFFORTLESS_TASK`, etc.) are set in the PTY so many `efl` commands can omit `--run` / `--task`.

Profile setup (Windows, WSL, templates, env): `docs/run-profiles.md`.

Native module notes (`node-pty`, packaging): `docs/native-deps.md`.

## First Commands

Effort context:

```bash
efl effort context --effort eff-1
```

Task context:

```bash
efl task context --task task-1
```

Plan context:

```bash
efl plan context --plan plan-1
```

Review context:

```bash
efl review context --review rev-1
```

## Task Work

For implementation work:

```bash
efl task claim --task task-1
efl task context --task task-1
```

Then work in the printed worktree.

Use checkpoints for durable progress:

```bash
efl task checkpoint --task task-1 --body "Implemented X. Next: Y."
```

Use input requests for blocking decisions:

```bash
efl input request --task task-1 --type choice --prompt "Which behavior should ship?" --choices "a:Simple|b:Configurable"
```

Record the handoff artifact:

```bash
efl task artifact --task task-1 --body "what changed, what was verified, remaining caveats"
```

Mark ready:

```bash
efl task ready --task task-1
```

## Review Work

Use review when independent assessment adds value:

```bash
efl task context --task task-1
efl review submit --task task-1 --verdict approve --body "review body"
```

Review verdicts are explicit:

- `approve`
- `request-changes`

Do not implement fixes from the review surface.

## Human Input

Ask the human when:

- requirements are ambiguous enough to change the plan
- a tradeoff affects user-facing behavior
- scope needs to expand
- two viable approaches have materially different risk
- a decision blocks truthful handoff

Prefer one focused question at a time.

## Final Synthesis

When the effort is genuinely handled:

```bash
efl effort context --effort eff-1
efl effort summary --effort eff-1 --from-file summary.md
efl effort complete --effort eff-1
```

Summary shape:

```text
- completed: <what was delivered or decided>
- merged: <task branches merged, if any>
- accepted: <approved branches awaiting merge, if any>
- decisions: <notable choices>
- caveats: <remaining risks or follow-ups>
```

## Rules

1. Read context before changing structure.
2. Keep one main agent in control for tightly coupled work.
3. Use side runs only for bounded, useful parallelism or independent review.
4. Attach references before handing work to another surface.
5. Never assume another run has context until it has read the relevant context command.
6. Use input requests for blocking human decisions.
7. Treat `accepted` as ready to merge, not necessarily shipped.
8. Treat `merged` as shipped into the base branch.
9. Keep the effort summary current.
10. Complete the effort only when the user's request is genuinely handled.
