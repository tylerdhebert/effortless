import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function localBin(name) {
  const extension = process.platform === 'win32' ? '.cmd' : ''
  return path.join(rootDir, 'node_modules', '.bin', `${name}${extension}`)
}

function cleanEnv() {
  const env = { ...process.env }
  delete env.VITE_DEV_SERVER_URL
  return env
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      shell: process.platform === 'win32',
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
  const env = cleanEnv()

  await run(localBin('vite'), ['build'], env)
  await run(localBin('electron'), ['.'], env)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
