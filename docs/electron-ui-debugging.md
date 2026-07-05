# electron UI debugging

This is the canonical workflow for agents that need to run, inspect, debug, and visually verify effortless UI changes.

## protocol

Use the Electron renderer as the app surface.

```bash
bun run dev:playwright
```

`dev:playwright` starts the app with:

- isolated app data under `.playwright-mcp/{mm-dd-effortless}/home`
- an isolated seeded database at `.playwright-mcp/{mm-dd-effortless}/home/effortless.db`
- Electron session data under the same isolated home
- Chromium DevTools Protocol on `http://127.0.0.1:9222`
- screenshot artifacts rooted at `.playwright-mcp/{mm-dd-effortless}`
- a maximized Electron window

Keep this process running while inspecting the UI. Use a different port when `9222` is already in use:

```bash
bun run dev:playwright -- --port 9223
```

Reuse the isolated database for iterative UI work:

```bash
bun run dev:playwright -- --no-seed
```

Seed without launching the app:

```bash
bun run dev:playwright -- --seed-only
```

## attach

Attach to the Electron renderer through CDP:

```text
http://127.0.0.1:9222
```

Choose the `page` target whose title is `effortless`. The renderer exposes the app bridge as `window.effortless`.

Use this guard before relying on the page:

```js
Boolean(window.effortless)
```

Useful inspection calls:

```js
await window.effortless.getAppState()
const efforts = await window.effortless.listEfforts()
if (efforts[0]) await window.effortless.listTasks(efforts[0].id)
await window.effortless.listAgentProfiles()
await window.effortless.listLiveAgentRunSessions()
```

For UI flows, drive the renderer through normal DOM actions and use `window.effortless` for state checks. Verify state after each meaningful transition.

## screenshots

Prefer Electron-native screenshots because they capture the real BrowserWindow:

```bash
bun run capture:electron -- --name before.png
```

The script connects to the CDP port, calls `window.effortless.captureDebugScreenshot(...)`, and prints the absolute file path plus a SHA-256 hash.

Use a short output folder under the active artifact root when a change needs multiple captures:

```bash
bun run capture:electron -- --out-dir theme-picker --name before.png
bun run capture:electron -- --out-dir theme-picker --name after.png
```

When using Playwright MCP directly, save screenshots under this repo's `.playwright-mcp/{mm-dd-[short-slug]}` folder. The folder is gitignored.

For screenshot sequences, compare the returned hashes. Different UI states should produce different hashes.

## visual verification loop

1. Start `bun run dev:playwright`.
2. Confirm `Boolean(window.effortless)` is true in the Electron renderer.
3. Capture a baseline screenshot.
4. Make the UI change.
5. Let Vite hot reload, or restart `dev:playwright -- --no-seed` when the main/preload process changed.
6. Drive the affected UI path in the Electron renderer.
7. Inspect state with `window.effortless` when state matters.
8. Capture the changed state.
9. Compare screenshot hashes and inspect the images.
10. Report the artifact paths used for verification.

## build and test expectations

For routine UI-only work, run:

```bash
bun run build
```

Use broader automated tests when the change touches non-UI logic, Electron process boundaries, persistence, agent-run behavior, or another shared contract.

## troubleshooting

If CDP has no page target while the app is still starting, wait and attach again. If the target still does not appear, restart `bun run dev:playwright`.

If `window.effortless` is missing, attach to the Electron renderer target.

If screenshots are unchanged, verify the UI state changed before capture and compare the returned SHA-256 hashes.

If the app shows unexpected data, restart with seeding enabled:

```bash
bun run dev:playwright
```

If the app needs the same isolated data after a code change, restart with:

```bash
bun run dev:playwright -- --no-seed
```
