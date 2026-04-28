import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function pad(value) {
  return String(value).padStart(2, '0')
}

function todaySlug() {
  const now = new Date()
  return `${pad(now.getMonth() + 1)}-${pad(now.getDate())}-diff-inspect`
}

function parseArgs(argv) {
  let outDir = path.join('.playwright-mcp', todaySlug())
  let shotName = `capture-${Date.now()}.png`
  let port = '9222'
  let runScenario = false

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out-dir') {
      outDir = argv[++i]
      continue
    }
    if (arg === '--name') {
      shotName = argv[++i]
      continue
    }
    if (arg === '--port') {
      port = argv[++i]
      continue
    }
    if (arg === '--scenario') {
      runScenario = true
      continue
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true }
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return { help: false, outDir, shotName, port, runScenario }
}

function printHelp() {
  console.log(`Usage: node scripts/capture-electron-shot.mjs [options]

Options:
  --out-dir <path>   Relative artifact directory under repo root.
                     Default: .playwright-mcp/{mm-dd-diff-inspect}
  --name <file>      Screenshot filename.
                     Default: capture-{timestamp}.png
  --port <number>    CDP port exposed by dev:playwright. Default: 9222
  --scenario         Run the eff-4/task-5 diff scenario captures.
  --help, -h         Show this help text.
`)
}

function getTargets(port) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}/json`, (response) => {
        let body = ''
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            resolve(Array.isArray(parsed) ? parsed : [])
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })
}

function createCdpClient(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const resolvers = pending.get(message.id)
    if (!resolvers) return
    pending.delete(message.id)
    if (message.error) {
      resolvers.reject(new Error(JSON.stringify(message.error)))
      return
    }
    resolvers.resolve(message.result)
  }

  function send(method, params = {}) {
    const requestId = ++id
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject })
      ws.send(JSON.stringify({ id: requestId, method, params }))
    })
  }

  async function connect() {
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
    })
    await send('Runtime.enable')
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    return result.result?.value
  }

  function close() {
    ws.close()
  }

  return { connect, evaluate, close }
}

function jsString(value) {
  return JSON.stringify(String(value))
}

function clickByTextScript(text) {
  const needle = jsString(text)
  return `(() => {
    const target = ${needle}.toLowerCase()
    const nodes = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"]'))
    const match = nodes.find((node) => (node.textContent || '').trim().toLowerCase() === target)
    if (!match) throw new Error('Could not find clickable text: ' + ${needle})
    match.click()
    return true
  })()`
}

function clickContainsScript(text) {
  const needle = jsString(text)
  return `(() => {
    const target = ${needle}.toLowerCase()
    const nodes = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"]'))
    const match = nodes.find((node) => (node.textContent || '').toLowerCase().includes(target))
    if (!match) throw new Error('Could not find clickable containing: ' + ${needle})
    match.click()
    return true
  })()`
}

function waitScript(ms) {
  return `new Promise((resolve) => setTimeout(resolve, ${Math.max(0, Number(ms) || 0)}))`
}

function captureScript(relativePath) {
  const arg = jsString(relativePath.replace(/\\/g, '/'))
  return `window.effortless.captureDebugScreenshot(${arg})`
}

function scrollToImplementationScript() {
  return `(() => {
    const heading = Array.from(document.querySelectorAll('h4')).find((node) => (node.textContent || '').trim() === 'implementation')
    if (!heading) throw new Error('Implementation section heading was not found')
    heading.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' })
    return true
  })()`
}

async function runScenario(client, relativeOutDir) {
  const shots = []

  await client.evaluate(clickContainsScript('eff-4'))
  await client.evaluate(waitScript(350))
  await client.evaluate(clickContainsScript('task-5'))
  await client.evaluate(waitScript(350))
  await client.evaluate(clickByTextScript('work'))
  await client.evaluate(waitScript(350))

  await client.evaluate(clickByTextScript('combined'))
  await client.evaluate(waitScript(300))
  await client.evaluate(clickByTextScript('unified'))
  await client.evaluate(waitScript(350))
  await client.evaluate(scrollToImplementationScript())
  await client.evaluate(waitScript(220))
  shots.push(
    await client.evaluate(captureScript(path.join(relativeOutDir, 'combined-unified.png'))),
  )

  await client.evaluate(clickByTextScript('split'))
  await client.evaluate(waitScript(350))
  await client.evaluate(scrollToImplementationScript())
  await client.evaluate(waitScript(220))
  shots.push(
    await client.evaluate(captureScript(path.join(relativeOutDir, 'combined-split.png'))),
  )

  await client.evaluate(clickByTextScript('uncommitted'))
  await client.evaluate(waitScript(350))
  await client.evaluate(clickByTextScript('split'))
  await client.evaluate(waitScript(350))
  await client.evaluate(scrollToImplementationScript())
  await client.evaluate(waitScript(220))
  shots.push(
    await client.evaluate(captureScript(path.join(relativeOutDir, 'uncommitted-split.png'))),
  )

  return shots
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const absoluteOutDir = path.resolve(repoRoot, options.outDir)
  fs.mkdirSync(absoluteOutDir, { recursive: true })

  const targets = await getTargets(options.port)
  const target =
    targets.find((entry) => entry.type === 'page' && entry.title === 'effortless') ??
    targets.find((entry) => entry.type === 'page')

  if (!target?.webSocketDebuggerUrl) {
    throw new Error(
      `No CDP page target found on port ${options.port}. Start with: bun run dev:playwright -- --no-seed --port ${options.port}`,
    )
  }

  const client = createCdpClient(target.webSocketDebuggerUrl)

  try {
    await client.connect()

    if (options.runScenario) {
      const shots = await runScenario(client, options.outDir)
      console.log(JSON.stringify({ scenario: true, shots }, null, 2))
      return
    }

    const result = await client.evaluate(
      captureScript(path.join(options.outDir, options.shotName)),
    )
    console.log(JSON.stringify({ scenario: false, shot: result }, null, 2))
  } finally {
    client.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
