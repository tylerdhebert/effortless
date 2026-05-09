import { existsSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const go = resolveGo()
const output = process.platform === 'win32'
  ? path.join('dist-cli', 'efl.exe')
  : path.join('dist-cli', 'efl')

rmSync('dist-cli', { recursive: true, force: true })

const result = spawnSync(go, ['build', '-trimpath', '-o', path.resolve(output), '.'], {
  cwd: path.resolve('cli/native/efl'),
  stdio: 'inherit',
  shell: false,
})

if (result.error) {
  throw result.error
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

function resolveGo() {
  const candidates = [
    process.env.GO,
    'go',
    'C:\\Program Files\\Go\\bin\\go.exe',
    'C:\\Program Files (x86)\\Go\\bin\\go.exe',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (existsSync(candidate)) {
        return candidate
      }
      continue
    }

    const result = spawnSync(candidate, ['version'], { stdio: 'ignore', shell: false })
    if (result.status === 0) {
      return candidate
    }
  }

  throw new Error('Go was not found. Install Go or set GO to the go executable path.')
}
