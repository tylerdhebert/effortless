# effortless

effortless is a local-first Electron desktop app and CLI for coordinating agent efforts across plans, tasks, reviews, discussion, repos, and human approvals.

## commands

Install dependencies:

```bash
bun install
```

Run the desktop app in development:

```bash
bun run dev
```

Run the desktop app with an isolated Playwright-friendly profile:

```bash
bun run dev:playwright
```

This launcher:

- creates artifacts under `.playwright-mcp/{mm-dd-effortless}`
- seeds an isolated database in that folder by default
- keeps your normal app data untouched
- keeps Electron cache/session data inside that isolated folder too
- exposes the Electron renderer on `http://127.0.0.1:9222` by default for Chromium DevTools Protocol tooling

When the app is running through `dev:playwright`, the renderer also exposes `window.effortless.captureDebugScreenshot(relativePath?)`, which saves a real Electron window PNG into the active `.playwright-mcp/{mm-dd-effortless}` folder and returns the saved path plus a SHA-256 hash.

Build the desktop app:

```bash
bun run build
```

Run the CLI:

```bash
bun run efl -- task create --effort eff-1 --title "title" --description "description"
```

Seed a demo database:

```bash
bun run seed -- --replace
```

Seed an isolated demo database without touching your default app data:

```powershell
$env:EFFORTLESS_HOME='C:\path\to\temp-home'
$env:EFFORTLESS_DB='C:\path\to\temp-home\effortless.db'
bun run seed -- --replace
```

The seed loader creates:

- repo fixtures for `effortless` and `agentsyncboard` when that sibling repo exists
- a discussion effort with answered input
- a bugfix effort with an in-flight task and pending input
- a delivery effort with discussion, plan history, accepted and rejected reviews, build results, and a pending seed task
