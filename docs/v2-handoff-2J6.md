# Phase 2J.6 Handoff: Provider Session & Resume CLI

## Architecture decisions

### Provider abstraction lives in `cli/src/provider.ts`, not `core/`

Provider inference reads `process.env` and profile `commandTemplate` - both are CLI-layer concerns. Core doesn't know about env vars. Putting it in `core/` would create an awkward dependency on `process.env` inside what should be pure DB logic. The `providerSessionId` column is already on the table - only the mutation helper lives in `core/agentRuns.ts`.

### Two separate cascade functions instead of one

- `resolveRelevantEffortRun` - for `session set --effort` - follows the spec cascade: running main > prepared main > running any > prepared any > latest any status. This answers "which run should I bind a new session to right now?"
- `resolveResumableEffortRun` - for `session show --effort` and `resume --effort` - finds the latest run with a non-null `providerSessionId`. This answers "which run actually has a session I can show/resume?"

These differ because `session set` is about finding a live run to stamp a session onto, while show/resume only care about runs that already have a session id. Merging them would return useless results for show/resume after a new `run prepare` creates a fresh run with no session id.

### `resolveRunRef` extracted to `cli/src/context.ts`

The private `resolveRun()` in `run.ts` was duplicated logic that session.ts and resume.ts both needed (parse `--run` flag or `EFFORTLESS_RUN_ID` env var, handle `run-N` pattern and raw numeric IDs). Extracting it to a shared helper and refactoring `run.ts` to use it avoids copy-paste. The function takes an optional explicit ref parameter so callers can pass `option('--run')` directly for explicit `--run` overrides (session set/show let you specify `--run` even when the env var is set for a different run).

### Resume is print-only, not spawn

`efl resume` runs inside the Electron HTTP command server, which captures stdout/stderr by monkey-patching `console.*`. Spawning `codex resume <id>` with `stdio: 'inherit'` would:

1. Leak output to Electron's stdio (lost), not back to the Go client
2. Block the HTTP response until codex exits
3. Fail to connect to the user's actual terminal PTY

Printing the command to stdout means the Go binary forwards it to the user's terminal and the user/agent can execute it. The TODO in the checklist tracks this for future improvement (possibly by having the Go client detect the resume command and exec it directly).

### Provider inference is substring match, not exact

`commandTemplate` is `"codex {prompt}"`, `"codex exec {prompt}"`, etc. `toLowerCase().includes('codex')` catches all variants. There's no risk of false positives with current templates.

### Custom provider requires explicit `--id`

No env var fallback (no standard) and resume is unsupported (no generic `custom resume <id>` command). The user gets a clear message when they try to resume without explicit config.

### OpenCode and Claude are stubs

They accept `--id` for session set/show but resume returns an unsupported-provider message. No env vars configured - we don't know their session env var names yet.

## Startup context

Both `renderTaskBootstrap` and `renderEffortBootstrap` check if the profile's `commandTemplate` includes `codex` (case-insensitive) and conditionally inject:

```
Save your Codex session: efl session set --run run-<N>
```

This runs early in the session because it's baked into the prompt the agent reads at startup. The `CODEX_THREAD_ID` is already in the environment (forwarded by the Go client), so the agent just needs to run the command.

## Schema

No migrations or schema changes. `provider_session_id` already existed on the `agent_runs` table as a nullable column. The new `setAgentRunProviderSessionId` helper is a simple UPDATE.

## Output format

Follows the existing pattern: `shortRef value` on each line, no headers, no JSON. Matches the style of `printAgentRun`, `printTask`, etc.

## Files summary

| File | Change |
|------|--------|
| `core/agentRuns.ts` | 3 new functions (setSessionId, resolveRelevant, resolveResumable) |
| `cli/src/context.ts` | 1 new function (resolveRunRef) |
| `cli/src/commands/run.ts` | Refactored to use shared resolveRunRef |
| `cli/src/provider.ts` | New - provider config map + 4 helpers |
| `cli/src/commands/session.ts` | New - set/show handler |
| `cli/src/commands/resume.ts` | New - resume handler |
| `cli/src/index.ts` | Register 2 new handlers |
| `cli/src/render.ts` | 6 help lines |
| `core/contextPacks.ts` | Conditional Codex session-set hint |
| `docs/v2-checklist.md` | Checked off, added TODO for spawn resume |

## Follow-up Questions From Codex

1. The Go transport client currently forwards `EFFORTLESS_RUN`, while the app-created run environment uses `EFFORTLESS_RUN_ID` and `resolveRunRef()` reads `EFFORTLESS_RUN_ID`. Should the Go client forward `EFFORTLESS_RUN_ID` instead, or forward both for compatibility?

2. The handoff says `session show --effort` should use `resolveResumableEffortRun()` and only show runs that already have a session id. The original implementation prompt expected `session show --effort` to resolve the relevant effort run and print `(no session id)` when empty. Which user workflow do you want here: "show me the current relevant run's session state" or "show me the latest resumable session for this effort"?

3. Relatedly, should `resume --effort` always choose the latest run with a session id, even if a newer running/prepared main run exists without a session id? That is convenient for finding something resumable, but it can resume stale context after a fresh run has been prepared. Should it instead resolve the relevant run first and fail if that run has no session id?

4. For the Codex startup prompt, should the instruction be stronger than "Save your Codex session"? For example: "First, run `efl session set --run run-N`." The current wording may be treated as optional guidance by an agent.

## Responses

### 1. Go client env var

**Fixed.** The Go client now forwards `EFFORTLESS_RUN_ID` instead of `EFFORTLESS_RUN`. The old `EFFORTLESS_RUN` was a dead value - no TS code reads it. `EFFORTLESS_RUN_ID` is what `buildAgentRunEnvironment` sets and `resolveRunRef` reads. Forwarding both wasn't necessary.

### 2. session show --effort cascade

**Fixed.** The original spec says "session show --effort resolves the same relevant run" - same cascade as `session set --effort`. I had incorrectly used `resolveResumableEffortRun` (session-backed only). Now both set and show use `resolveRelevantEffortRun`:

- `session set --effort` -> cascade -> update the live run's session id
- `session show --effort` -> same cascade -> show that run's session state (with `(no session id)` if empty)

This keeps the two commands consistent: they always point at the same run.

### 3. resume --effort cascade

**Resume uses `resolveResumableEffortRun`** - the latest run with a non-null `providerSessionId`. This was the user's explicit decision: "resuming should only get the most recent non-null session id."

Rationale: If you're resuming, you want to re-enter an existing session. A freshly prepared run with no session id is not resumable - you can't call `codex resume` on nothing. Falling back to the last session-backed run (even if stale) is the useful behavior. If the user wants the fresh run, they call `efl session set` on it first, then resume.

### 4. Startup prompt strength

**Fixed.** Changed from "Save your Codex session: `efl session set --run run-N`" to "First, run: `efl session set --run run-N`". This makes it a procedural first step rather than a save-this-reminder.
