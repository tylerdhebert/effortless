# effortless Agent Notes

## Playwright Debugging

- Use `docs/electron-ui-debugging.md` as the canonical runbook for running, inspecting, and visually verifying Electron UI changes.
- Use `bun run dev:playwright` for Playwright or MCP-driven debugging.
- Do not run `bun run dev` at the same time as `bun run dev:playwright`.
- `dev:playwright` creates an isolated runtime under `.playwright-mcp/{mm-dd-effortless}` with:
  - a seeded demo database
  - isolated Electron user/session data
  - a CDP endpoint on `http://127.0.0.1:9222`
- The plain Vite page at `http://localhost:5173` is not the source of truth for app state. In a normal browser tab, `window.effortless` is undefined and the app will appear empty.
- Treat the Electron renderer as the real app surface.

## Screenshots

- For this app, prefer Electron-native screenshots through `window.effortless.captureDebugScreenshot(...)` when available; follow `docs/electron-ui-debugging.md` for the capture workflow.
- Save Playwright and screenshot artifacts inside this repo's `.playwright-mcp` folder.
- Before relying on a screenshot sequence, verify the captures are changing between states.

## Window State

- Default to a maximized window unless the user explicitly asks for a different size.
- Do not leave the app minimized while debugging or capturing screenshots.
- The app does not need to stay in the foreground, but it should remain restored.

## UI Style

- Avoid marketing-flavored hero content. Do not add redundant workspace-summary banners that restate the current screen without adding operational value.
- Default all UI labels to lowercase. Do not use uppercase labels unless a developer explicitly asks for them.
