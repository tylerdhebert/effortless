const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Database = require('better-sqlite3')

function getEffortlessHome() {
  if (process.env.EFFORTLESS_HOME) return process.env.EFFORTLESS_HOME
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'effortless')
  }
  return path.join(os.homedir(), '.effortless')
}

function loadDefaultInstructions(repoRoot) {
  const source = fs.readFileSync(path.join(repoRoot, 'core', 'defaultInstructions.ts'), 'utf-8')
  const marker = 'DEFAULT_INSTRUCTIONS_BODY = `'
  const start = source.indexOf(marker)
  if (start === -1) {
    throw new Error('Missing DEFAULT_INSTRUCTIONS_BODY')
  }

  let cursor = start + marker.length
  let body = ''

  while (cursor < source.length) {
    const char = source[cursor]
    if (char === '\\') {
      const next = source[cursor + 1]
      if (next === '`' || next === '\\') {
        body += next
        cursor += 2
        continue
      }
    }

    if (char === '`') {
      return body
    }

    body += char
    cursor += 1
  }

  throw new Error('Unterminated DEFAULT_INSTRUCTIONS_BODY')
}

function main() {
  const repoRoot = path.resolve(__dirname, '..')
  const body = loadDefaultInstructions(repoRoot)
  const dbPath = path.join(getEffortlessHome(), 'effortless.db')
  const db = new Database(dbPath)
  const now = new Date().toISOString()

  const existing = db.prepare(`SELECT id FROM instructions WHERE repo_id IS NULL`).get()
  const result = existing
    ? db.prepare(`
        UPDATE instructions
        SET source_type = 'body',
            body = ?,
            file_path = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(body, now, existing.id)
    : db.prepare(`
        INSERT INTO instructions (repo_id, source_type, body, file_path, updated_at)
        VALUES (NULL, 'body', ?, NULL, ?)
      `).run(body, now)

  db.prepare(`
    UPDATE instructions
    SET short_ref = 'instr-' || id
    WHERE short_ref IS NULL
  `).run()

  db.close()

  console.log(`db: ${dbPath}`)
  console.log(`reseeded default instructions: ${result.changes}`)
}

main()
