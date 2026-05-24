# native dependencies

effortless embeds a terminal via `node-pty` and stores state in `better-sqlite3`. Both ship native `.node` binaries.

## development

```bash
bun install
bun run dev
```

Bun installs prebuilds when available for your platform. If the embedded terminal shows **embedded terminal unavailable**, `node-pty` did not load.

## electron packaging

`electron-builder.json5` sets:

- `npmRebuild: false` — rely on prebuilds, not a local compile during packaging
- `asarUnpack` for `better-sqlite3` and `node-pty` prebuild paths so native modules load from unpacked ASAR

After `bun run build`, confirm `release/*/win-unpacked` contains unpacked `node-pty` prebuilds under `resources/app.asar.unpacked`.

## when rebuild is needed

Rebuild or replace prebuilds only if:

- you change Electron major version and prebuilds are incompatible
- you develop on a platform/arch without a matching prebuild
- `node-pty` or `better-sqlite3` is upgraded and prebuilds lag

Typical recovery on Windows:

```bash
bun install
# if still broken, remove node_modules and reinstall
rm -r node_modules
bun install
```

Building from source requires Windows build tools (node-gyp, MSVC). Prefer matching prebuilds.

## diagnostics

From the app UI: effort terminal shows a clear message when PTY is unavailable.

From main process: `getPtyRuntimeStatus()` returns `{ available: boolean, platform }` (see `electron/runManager.ts`).
