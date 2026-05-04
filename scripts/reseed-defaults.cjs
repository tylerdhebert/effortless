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

function extractTemplateBodies(source, keyLabel) {
  const entries = []
  const keyMarker = `${keyLabel}: '`
  let searchIndex = 0

  while (true) {
    const keyStart = source.indexOf(keyMarker, searchIndex)
    if (keyStart === -1) break

    const valueStart = keyStart + keyMarker.length
    const valueEnd = source.indexOf("'", valueStart)
    if (valueEnd === -1) {
      throw new Error(`Unterminated ${keyLabel} entry`)
    }

    const key = source.slice(valueStart, valueEnd)
    const bodyMarker = 'body: `'
    const bodyStart = source.indexOf(bodyMarker, valueEnd)
    if (bodyStart === -1) {
      throw new Error(`Missing body template for ${keyLabel} '${key}'`)
    }

    let cursor = bodyStart + bodyMarker.length
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

        body += char
        if (next) {
          body += next
          cursor += 2
          continue
        }
      }

      if (char === '`') {
        break
      }

      body += char
      cursor += 1
    }

    if (cursor >= source.length) {
      throw new Error(`Unterminated body template for ${keyLabel} '${key}'`)
    }

    entries.push({ key, body })
    searchIndex = cursor + 1
  }

  return entries
}

function loadGlobalMandates(repoRoot) {
  const source = fs.readFileSync(path.join(repoRoot, 'core', 'defaultMandates.ts'), 'utf-8')
  return extractTemplateBodies(source, 'workSurface')
}

function loadTemplatePlaybooks(repoRoot) {
  const source = fs.readFileSync(path.join(repoRoot, 'core', 'defaultTemplatePlaybooks.ts'), 'utf-8')
  return extractTemplateBodies(source, 'template')
}

function main() {
  const repoRoot = path.resolve(__dirname, '..')
  const globalMandates = loadGlobalMandates(repoRoot)
  const templatePlaybooks = loadTemplatePlaybooks(repoRoot)
  const dbPath = path.join(getEffortlessHome(), 'effortless.db')
  const db = new Database(dbPath)
  const now = new Date().toISOString()

  const upsertMandate = db.prepare(`
    INSERT INTO mandates (work_surface, repo_id, source_type, body, file_path, updated_at)
    VALUES (?, NULL, 'body', ?, NULL, ?)
    ON CONFLICT(work_surface, COALESCE(repo_id, -1))
    DO UPDATE SET
      source_type = 'body',
      body = excluded.body,
      file_path = NULL,
      updated_at = excluded.updated_at
  `)

  const upsertPlaybook = db.prepare(`
    INSERT INTO template_playbooks (template, body, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(template)
    DO UPDATE SET
      body = excluded.body,
      updated_at = excluded.updated_at
  `)

  for (const mandate of globalMandates) {
    upsertMandate.run(mandate.key, mandate.body, now)
  }

  db.prepare(`
    UPDATE mandates
    SET short_ref = 'mandate-' || id
    WHERE short_ref IS NULL
  `).run()

  for (const playbook of templatePlaybooks) {
    upsertPlaybook.run(playbook.key, playbook.body, now)
  }

  db.close()

  console.log(`db: ${dbPath}`)
  console.log(`reseeded global mandates: ${globalMandates.length}`)
  console.log(`reseeded template playbooks: ${templatePlaybooks.length}`)
}

main()
