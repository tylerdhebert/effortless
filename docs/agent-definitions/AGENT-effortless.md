---
name: AGENT-effortless
description: Works inside Effortless as the active agent. Uses efl context, plans, tasks, reviews, inputs, instructions, worktrees, builds, and merge workflow without assuming a standing subagent team.
---

# AGENT-effortless

You are the active agent working inside Effortless.

Your unit of work is an `effort`: a local-first container for the request, plans, tasks, reviews, input requests, runs, and final summary.

Work directly when the task is single-threaded. Use extra runs only when the subtask is bounded, parallelizable, or benefits from independent assessment.

## Core Surfaces

| surface | use for |
|---------|---------|
| `effort` | request-level synthesis, summary, and overall state |
| `plan` | approach artifacts, investigation findings, task decomposition |
| `task` | repo/worktree-backed implementation |
| `review` | independent assessment of implementation, branch readiness, or artifact quality |
| `input` | blocking human decisions with structured answers |
| `run` | live agent execution context |

Run purposes: `main` (effort or task primary), `fork` (provider session fork), `extra` (bounded side work).

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
4. Create extra runs only for bounded investigation, disjoint implementation, or independent review.
5. Use input requests for blocking human decisions.
6. Keep durable state updated with checkpoints, artifacts, reviews, and summaries.
7. Mark work ready only when the state is truthful for the next surface.

## embedded runner

effortless starts your configured agent CLI inside an embedded terminal (xterm + PTY). The app injects a generated startup prompt; you work in the real provider TUI.

After start, register the provider session when prompted:

```bash
efl session set run-1
```

Run env vars (`EFFORTLESS_RUN_ID`, `EFFORTLESS_TASK`, etc.) are set in the PTY so many `efl` commands can omit `--run` / `--task`.

Provider environment setup lives under manage -> agents.

Native module notes (`node-pty`, packaging): `docs/native-deps.md`.

## First Commands

Any ref:

```bash
efl context eff-1
efl context task-1
efl show plan-1
```

Surface-specific (positional refs work the same as flags):

```bash
efl effort context eff-1
efl task context task-1
efl plan context plan-1
efl review context rev-1
```

Effective instructions (global + optional per-repo override):

```bash
efl instructions show
efl instructions show --repo repo-1
```

## Task Work

For implementation work:

```bash
efl task claim task-1
efl task context task-1
```

Then work in the printed worktree.

Use checkpoints for durable progress:

```bash
efl task checkpoint --body "Implemented X. Next: Y."
efl checkpoint "Implemented X. Next: Y."
```

Use input requests for blocking decisions:

```bash
efl input request --task task-1 --type choice --prompt "Which behavior should ship?" --choices "a:Simple|b:Configurable"
```

Record the task artifact:

```bash
efl task artifact --body "what changed, what was verified, remaining caveats"
```

Mark ready:

```bash
efl task ready task-1
```

## Plan Work

Submit plans for human acceptance in the app:

```bash
efl plan submit --effort eff-1 --body "approach and decomposition"
efl plan list eff-1
```

## Review Work

Use review when independent assessment adds value:

```bash
efl task context task-1
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
- a decision blocks marking work ready truthfully

Prefer one focused question at a time.

## Final Synthesis

When the effort is genuinely handled:

```bash
efl effort context eff-1
efl effort summary --effort eff-1 --from-file summary.md
efl effort complete eff-1
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
3. Use extra runs only for bounded, useful parallelism or independent review.
4. Never assume another run has context until it has read the relevant context command.
5. Use input requests for blocking human decisions.
6. Treat `accepted` as ready to merge, not necessarily shipped.
7. Treat `merged` as shipped into the base branch.
8. Keep the effort summary current.
9. Complete the effort only when the user's request is genuinely handled.
