#!/usr/bin/env node
/**
 * Smoke checks via Electron CDP (dev:playwright on port 9222).
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

    const providerSettings = await session.evaluate(harness(`api.listProviderSettings()`))
    results.push({
      check: 'provider-settings-api',
      ok: Array.isArray(providerSettings) && providerSettings.some((entry) => entry.provider === 'opencode'),
      providerSettings,
    })

    const nativePrepare = await session.evaluate(harness(`(async () => {
      await api.updateProviderEnvironment({ provider: 'codex', environment: 'windows', wslDistro: '' })
      let efforts = await api.listEfforts()
      let effort = efforts[0]
      if (!effort) {
        effort = await api.createEffort({
          title: 'smoke runner',
          description: 'runner reliability smoke effort',
          template: 'bugfix',
        })
      }
      const prepared = await api.prepareEffortRun({
        effortId: effort.id,
        provider: 'codex',
        purpose: 'main',
        label: 'smoke-native',
      })
      return {
        runId: prepared.run.id,
        environment: prepared.run.environment,
        wslDistro: prepared.run.wslDistro,
        cwd: prepared.run.cwd,
        hasRunEnv: prepared.env.EFFORTLESS_RUN_ID === prepared.run.shortRef,
      }
    })()`))
    results.push({
      check: 'prepare-native-run',
      ok: nativePrepare?.environment === 'windows' && nativePrepare?.wslDistro == null && nativePrepare?.hasRunEnv === true,
      nativePrepare,
    })

    const wslPrepare = await session.evaluate(harness(`(async () => {
      await api.updateProviderEnvironment({ provider: 'opencode', environment: 'wsl', wslDistro: 'Ubuntu' })
      let efforts = await api.listEfforts()
      let effort = efforts[0]
      if (!effort) {
        effort = await api.createEffort({
          title: 'smoke runner',
          description: 'runner reliability smoke effort',
          template: 'bugfix',
        })
      }
      const prepared = await api.prepareEffortRun({
        effortId: effort.id,
        provider: 'opencode',
        purpose: 'main',
        label: 'smoke-wsl',
      })
      await api.updateProviderEnvironment({ provider: 'opencode', environment: 'windows', wslDistro: null })
      return {
        runId: prepared.run.id,
        environment: prepared.run.environment,
        wslDistro: prepared.run.wslDistro,
        command: prepared.run.command,
      }
    })()`))
    results.push({
      check: 'prepare-wsl-run-stamps-provider-environment',
      ok: wslPrepare?.environment === 'wsl' && wslPrepare?.wslDistro === 'Ubuntu',
      wslPrepare,
    })
  } finally {
    await session.close()
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
