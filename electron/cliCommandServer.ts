import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { getAppPaths } from '../core/appPaths'
import type { AppDatabase } from '../core/db'
import { runCli } from '../cli/src/index'

type CliCommandRequest = {
  args: string[]
  cwd: string
  env: Record<string, string>
}

type CliCommandResponse = {
  stdout: string
  stderr: string
  exitCode: number
}

export type CliCommandServer = {
  close: () => Promise<void>
}

let commandQueue = Promise.resolve()

export async function startCliCommandServer(db: AppDatabase): Promise<CliCommandServer> {
  const token = randomBytes(32).toString('hex')
  const server = http.createServer((request, response) => {
    void handleCliRequest(db, token, request, response)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Unable to start Effortless command server')
  }

  await writeFile(
    cliServerStatePath(),
    JSON.stringify({ port: address.port, token, pid: process.pid }, null, 2),
    'utf-8',
  )

  return {
    close: async () => {
      await rm(cliServerStatePath(), { force: true })
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    },
  }
}

function cliServerStatePath(): string {
  return path.join(getAppPaths().home, 'cli-server.json')
}

async function handleCliRequest(
  db: AppDatabase,
  token: string,
  request: http.IncomingMessage,
  response: http.ServerResponse,
): Promise<void> {
  if (request.method !== 'POST' || request.url !== '/cli') {
    writeJson(response, 404, { error: 'not found' })
    return
  }

  if (request.headers.authorization !== `Bearer ${token}`) {
    writeJson(response, 401, { error: 'unauthorized' })
    return
  }

  try {
    const payload = JSON.parse(await readRequestBody(request)) as CliCommandRequest
    const result = await enqueueCliCommand(() => runCliCommand(db, payload))
    writeJson(response, 200, result)
  } catch (error) {
    writeJson(response, 500, {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
    } satisfies CliCommandResponse)
  }
}

function enqueueCliCommand(action: () => Promise<CliCommandResponse>): Promise<CliCommandResponse> {
  const run = commandQueue.then(action, action)
  commandQueue = run.then(() => undefined, () => undefined)
  return run
}

async function runCliCommand(db: AppDatabase, payload: CliCommandRequest): Promise<CliCommandResponse> {
  const originalCwd = process.cwd()
  const originalExitCode = process.exitCode
  const originalEnv = new Map<string, string | undefined>()
  const originalLog = console.log
  const originalError = console.error
  const stdout: string[] = []
  const stderr: string[] = []

  console.log = (...values: unknown[]) => {
    stdout.push(values.map(String).join(' '))
  }
  console.error = (...values: unknown[]) => {
    stderr.push(values.map(String).join(' '))
  }

  try {
    process.exitCode = undefined
    process.chdir(payload.cwd)
    for (const [name, value] of Object.entries(payload.env)) {
      originalEnv.set(name, process.env[name])
      process.env[name] = value
    }

    await runCli(payload.args, db)

    return {
      stdout: stdout.join('\n'),
      stderr: stderr.join('\n'),
      exitCode: typeof process.exitCode === 'number' ? process.exitCode : 0,
    }
  } catch (error) {
    return {
      stdout: stdout.join('\n'),
      stderr: [stderr.join('\n'), error instanceof Error ? error.message : String(error)].filter(Boolean).join('\n'),
      exitCode: 1,
    }
  } finally {
    console.log = originalLog
    console.error = originalError
    process.chdir(originalCwd)
    process.exitCode = originalExitCode
    for (const [name, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = value
      }
    }
  }
}

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    request.on('error', reject)
  })
}

function writeJson(response: http.ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}
