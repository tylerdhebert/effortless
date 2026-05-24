#!/usr/bin/env node
/**
 * Phase 2O smoke checks via Electron CDP (dev:playwright on port 9222).
 * Usage: node scripts/smoke-runner-reliability.mjs [--port 9222]
 */
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const port = process.argv.includes('--port')
  ? process.argv[process.argv.indexOf('--port') + 1]
  : '9222'

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
}

async function cdpSession(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  let id = 1
  const pending = new Map()

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id != null && pending.has(message.id)) {
      const entry = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) {
        entry.reject(new Error(message.error.message ?? JSON.stringify(message.error)))
      } else {
        entry.resolve(message.result)
      }
    }
  })

  async function send(method, params = {}) {
    const messageId = id++
    return new Promise((resolve, reject) => {
      pending.set(messageId, { resolve, reject })
      ws.send(JSON.stringify({ id: messageId, method, params }))
    })
  }

  async function evaluate(expression) {
    await send('Runtime.enable')
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails))
    }
    return result.result?.value
  }

  async function close() {
    ws.close()
  }

  return { evaluate, close, send }
}

async function getRendererPage() {
  const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`)
  const page = targets.find((target) => target.type === 'page' && target.url?.includes('localhost'))
  if (!page?.webSocketDebuggerUrl) {
    throw new Error(`No renderer page on CDP port ${port}. Start: bun run dev:playwright`)
  }
  return page
}

function harness(expr) {
  return `(() => {
    const api = window.effortless
    if (!api) throw new Error('window.effortless is undefined')
    return (${expr})
  })()`
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function toWslPath(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  const wslShareMatch = /^\/\/wsl\$\/[^/]+(\/.*)?$/i.exec(normalized)
  if (wslShareMatch) {
    return wslShareMatch[1] || '/'
  }
  const driveMatch = /^([A-Za-z]):\/(.*)$/.exec(normalized)
  if (!driveMatch) return normalized
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`
}

function testWslPathNormalization() {
  const cases = [
    ['\\\\wsl$\\Ubuntu\\home\\tyler\\repo', '/home/tyler/repo'],
    ['//wsl$/Ubuntu/home/tyler/repo', '/home/tyler/repo'],
    [repoRoot, toWslPath(repoRoot)],
  ]
  return cases.map(([input, expected]) => ({
    input,
    expected,
    actual: toWslPath(input),
    ok: toWslPath(input) === expected,
  }))
}

async function main() {
  const pathNormalization = testWslPathNormalization()
  const results = [{ check: 'wsl-path-normalization', ok: pathNormalization.every((entry) => entry.ok), pathNormalization }]
  const page = await getRendererPage()
  const session = await cdpSession(page.webSocketDebuggerUrl)
  try {
    const liveApi = await session.evaluate(harness(`api.listLiveAgentRunSessions()`))
    results.push({ check: 'live-sessions-api', ok: Array.isArray(liveApi), liveApi })

    const holdProfile = await session.evaluate(harness(`(async () => {
      const profiles = await api.listAgentProfiles()
      const existing = profiles.find((profile) => profile.name === 'smoke-2o-hold')
      if (existing) return existing
      return api.createAgentProfile({
        name: 'smoke-2o-hold',
        commandTemplate: 'powershell -NoLogo -Command "while ($true) { Start-Sleep -Seconds 3600 }"',
        environment: 'windows',
        defaultCwdKind: 'custom',
        customCwd: ${JSON.stringify(repoRoot)},
      })
    })()`))

    const holdRun = await session.evaluate(harness(`(async () => {
      let efforts = await api.listEfforts()
      let effort = efforts[0]
      if (!effort) {
        effort = await api.createEffort({
          title: 'smoke 2o',
          description: 'runner reliability smoke effort',
          template: 'bugfix',
        })
      }
      const prepared = await api.prepareEffortRun({
        effortId: effort.id,
        profileId: ${holdProfile.id},
        purpose: 'main',
        label: 'smoke-2o-hold',
      })
      await api.startAgentRun(prepared.run.id, { cols: 100, rows: 24 })
      const live = await api.listLiveAgentRunSessions()
      const row = live.find((session) => session.runId === prepared.run.id)
      if (!row) throw new Error('hold run did not become live')
      return { runId: prepared.run.id, attachmentId: row.attachmentId, providerLive: row.providerLive }
    })()`))

    results.push({
      check: 'start-hold-run',
      ok: Boolean(holdRun?.runId) && holdRun.providerLive === true,
      holdRun,
    })

    const beforeReload = await session.evaluate(harness(`api.listLiveAgentRunSessions()`))
    await session.send('Page.reload', { ignoreCache: true })
    await session.close()

    let afterReload = null
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(500)
      try {
        const reloadedPage = await getRendererPage()
        const reloadedSession = await cdpSession(reloadedPage.webSocketDebuggerUrl)
        afterReload = await reloadedSession.evaluate(harness(`api.listLiveAgentRunSessions()`))
        await reloadedSession.close()
        if (Array.isArray(afterReload) && afterReload.length > 0) break
      } catch {
        // renderer still booting
      }
    }

    const matching = (beforeReload ?? []).map((session) => {
      const next = (afterReload ?? []).find((candidate) => candidate.runId === session.runId)
      return {
        runId: session.runId,
        sameAttachment: next?.attachmentId === session.attachmentId,
        stillLive: Boolean(next),
        providerLiveAfter: next?.providerLive ?? null,
      }
    })

    results.push({
      check: 'renderer-reload-preserves-live-sessions',
      ok: matching.every((entry) => entry.stillLive && entry.sameAttachment),
      matching,
      beforeCount: beforeReload?.length ?? 0,
      afterCount: afterReload?.length ?? 0,
    })

    const reloadedPage = await getRendererPage()
    const postReload = await cdpSession(reloadedPage.webSocketDebuggerUrl)

    const missingCwd = await postReload.evaluate(harness(`(async () => {
      const badPath = 'Z:\\\\effortless-missing-cwd-smoke-2o'
      const profiles = await api.listAgentProfiles()
      let profile = profiles.find((entry) => entry.name === 'smoke-2o-bad-cwd')
      if (!profile) {
        profile = await api.createAgentProfile({
          name: 'smoke-2o-bad-cwd',
          commandTemplate: 'cmd /c echo should-not-run',
          environment: 'windows',
          defaultCwdKind: 'custom',
          customCwd: badPath,
        })
      }
      let efforts = await api.listEfforts()
      let effort = efforts[0]
      if (!effort) {
        effort = await api.createEffort({
          title: 'smoke 2o',
          description: 'runner reliability smoke effort',
          template: 'bugfix',
        })
      }
      const prepared = await api.prepareEffortRun({
        effortId: effort.id,
        profileId: profile.id,
        purpose: 'main',
        label: 'smoke-2o-bad-cwd',
      })
      let startError = null
      try {
        await api.startAgentRun(prepared.run.id, { cols: 100, rows: 24 })
      } catch (error) {
        startError = error?.message ?? String(error)
      }
      const live = await api.listLiveAgentRunSessions()
      const refreshed = (await api.listAgentRuns(effort.id)).find((run) => run.id === prepared.run.id)
      return {
        startError,
        liveForRun: live.filter((session) => session.runId === prepared.run.id),
        status: refreshed?.status,
        error: refreshed?.error,
        cwd: refreshed?.cwd,
      }
    })()`))

    results.push({
      check: 'missing-cwd-does-not-create-live-session',
      ok: missingCwd?.liveForRun?.length === 0 && missingCwd?.status === 'failed' &&
        String(missingCwd?.error ?? '').includes('cwd'),
      missingCwd,
    })

    const staleProfile = await postReload.evaluate(harness(`(async () => {
      const profiles = await api.listAgentProfiles()
      const existing = profiles.find((profile) => profile.name === 'smoke-2o-stale')
      if (existing) return existing
      return api.createAgentProfile({
        name: 'smoke-2o-stale',
        commandTemplate: 'powershell -NoLogo -Command "exit 0"',
        environment: 'windows',
        defaultCwdKind: 'custom',
        customCwd: ${JSON.stringify(repoRoot)},
      })
    })()`))

    const staleRun = await postReload.evaluate(harness(`(async () => {
      let efforts = await api.listEfforts()
      let effort = efforts[0]
      if (!effort) {
        effort = await api.createEffort({
          title: 'smoke 2o',
          description: 'runner reliability smoke effort',
          template: 'bugfix',
        })
      }
      const prepared = await api.prepareEffortRun({
        effortId: effort.id,
        profileId: ${staleProfile.id},
        purpose: 'main',
        label: 'smoke-2o-stale',
      })
      await api.startAgentRun(prepared.run.id, { cols: 100, rows: 24 })
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const live = await api.listLiveAgentRunSessions()
        const row = live.find((session) => session.runId === prepared.run.id)
        if (row && row.providerLive === false) {
          return {
            runId: prepared.run.id,
            providerLive: row.providerLive,
            hasLiveSession: true,
            runStatus: (await api.listAgentRuns(effort.id)).find((run) => run.id === prepared.run.id)?.status,
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error('stale run never reached provider-dead/live-session state')
    })()`))

    results.push({
      check: 'stale-provider-dead-pty-attached',
      ok: staleRun?.hasLiveSession === true && staleRun?.providerLive === false &&
        (staleRun?.runStatus === 'exited' || staleRun?.runStatus === 'running'),
      staleRun,
    })

    await postReload.evaluate(harness(`(async () => {
      for (const runId of [${holdRun.runId}, ${staleRun.runId}]) {
        const live = await api.listLiveAgentRunSessions()
        if (live.some((session) => session.runId === runId)) {
          await api.stopAgentRun(runId)
        }
      }
    })()`))
    const wslPosixHome = await (async () => {
      try {
        const { execSync } = await import('node:child_process')
        return execSync('wsl.exe bash -lc "pwd"', { encoding: 'utf8' }).trim()
      } catch {
        return null
      }
    })()

    if (wslPosixHome) {
      const wslHold = await postReload.evaluate(harness(`(async () => {
        const profiles = await api.listAgentProfiles()
        let profile = profiles.find((entry) => entry.name === 'smoke-2o-wsl')
        if (!profile) {
          profile = await api.createAgentProfile({
            name: 'smoke-2o-wsl',
            commandTemplate: 'bash -lc "while true; do sleep 3600; done"',
            environment: 'wsl',
            wslDistro: 'Ubuntu',
            defaultCwdKind: 'custom',
            customCwd: ${JSON.stringify(wslPosixHome)},
          })
        }
        let efforts = await api.listEfforts()
        let effort = efforts[0]
        if (!effort) {
          effort = await api.createEffort({
            title: 'smoke 2o',
            description: 'runner reliability smoke effort',
            template: 'bugfix',
          })
        }
        const prepared = await api.prepareEffortRun({
          effortId: effort.id,
          profileId: profile.id,
          purpose: 'main',
          label: 'smoke-2o-wsl',
        })
        await api.startAgentRun(prepared.run.id, { cols: 100, rows: 24 })
        const live = await api.listLiveAgentRunSessions()
        const row = live.find((session) => session.runId === prepared.run.id)
        if (row) await api.stopAgentRun(prepared.run.id)
        return { started: Boolean(row), cwd: prepared.run.cwd }
      })()`))
      results.push({
        check: 'wsl-posix-cwd-start',
        ok: wslHold?.started === true,
        wslHold,
      })
    } else {
      results.push({ check: 'wsl-posix-cwd-start', ok: true, skipped: true, reason: 'wsl unavailable' })
    }

    await postReload.close()
  } finally {
    try {
      await session.close()
    } catch {
      // already closed after reload
    }
  }

  console.log(JSON.stringify(results, null, 2))
  const failed = results.filter((entry) => !entry.ok && !entry.skipped)
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
