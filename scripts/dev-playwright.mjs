import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function formatDatePart(value) {
  return String(value).padStart(2, '0')
}

function getArtifactDir() {
  const now = new Date()
  const slug = `${formatDatePart(now.getMonth() + 1)}-${formatDatePart(now.getDate())}-effortless`
  return path.join(rootDir, '.playwright-mcp', slug)
}

function parseArgs(argv) {
  let port = '9222'
  let seed = true
  let seedOnly = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      return { help: true }
    }
    if (arg === '--no-seed') {
      seed = false
      continue
    }
    if (arg === '--seed-only') {
      seedOnly = true
      continue
    }
    if (arg === '--port') {
      const nextArg = argv[index + 1]
      if (!nextArg) {
        throw new Error('Missing value for --port')
      }
      port = nextArg
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return { help: false, port, seed, seedOnly }
}

function printHelp() {
  console.log(`Usage: bun run dev:playwright -- [options]

Starts effortless with an isolated app home under .playwright-mcp and exposes
the Electron renderer on a Chromium remote debugging port.

Options:
  --port <number>  Remote debugging port to expose. Default: 9222
  --no-seed        Skip seeding the isolated database before launch
  --seed-only      Seed the isolated database and exit
  --help, -h       Show this help message
`)
}

function getCommand() {
  return process.platform === 'win32' ? 'bun.exe' : 'bun'
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`Command failed: ${command} ${args.join(' ')} (code=${code ?? 'null'}, signal=${signal ?? 'null'})`))
    })
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const artifactDir = getArtifactDir()
  const homeDir = path.join(artifactDir, 'home')
  const dbPath = path.join(homeDir, 'effortless.db')

  mkdirSync(homeDir, { recursive: true })
  mkdirSync(path.join(homeDir, 'electron', 'session'), { recursive: true })

  const env = {
    ...process.env,
    EFFORTLESS_HOME: homeDir,
    EFFORTLESS_DB: dbPath,
    PLAYWRIGHT_ARTIFACT_DIR: artifactDir,
    PLAYWRIGHT_REMOTE_DEBUGGING_PORT: options.port,
  }

  const command = getCommand()

  console.log(`Artifact directory: ${artifactDir}`)
  console.log(`EFFORTLESS_HOME: ${homeDir}`)
  console.log(`EFFORTLESS_DB: ${dbPath}`)
  console.log(`Remote debugging port: ${options.port}`)

  if (options.seed) {
    await run(command, ['run', 'seed', '--', '--replace'], env)
  }

  if (options.seedOnly) {
    return
  }

  const child = spawn(command, ['run', 'dev'], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  })

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.on('SIGINT', forwardSignal)
  process.on('SIGTERM', forwardSignal)

  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
