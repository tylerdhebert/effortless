import fs from 'node:fs'
import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { Instructions, SetInstructionsInput } from './types'

type InstructionsRow = {
  id: number
  short_ref: string
  repo_id: number | null
  source_type: string
  body: string | null
  file_path: string | null
  updated_at: string
}

export function listInstructions(db: AppDatabase): Instructions[] {
  return db
    .prepare<InstructionsRow>(`SELECT * FROM instructions ORDER BY repo_id IS NOT NULL, id ASC`)
    .all()
    .map(mapInstructions)
}

export function setInstructions(db: AppDatabase, input: SetInstructionsInput): Instructions {
  const now = new Date().toISOString()
  const repoId = input.repoId ?? null
  const existing = db
    .prepare<InstructionsRow>(`SELECT * FROM instructions WHERE repo_id IS ?`)
    .get(repoId)

  if (existing) {
    db.prepare(
      `UPDATE instructions SET source_type = ?, body = ?, file_path = ?, updated_at = ? WHERE id = ?`,
    ).run(input.sourceType, input.body ?? null, input.filePath ?? null, now, existing.id)
    bumpAppState(db)
    return getInstructions(db, existing.id)
  }

  const result = db
    .prepare(
      `INSERT INTO instructions (repo_id, source_type, body, file_path, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(repoId, input.sourceType, input.body ?? null, input.filePath ?? null, now)
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE instructions SET short_ref = ? WHERE id = ?`).run(`instr-${id}`, id)
  bumpAppState(db)
  return getInstructions(db, id)
}

export function deleteInstructions(db: AppDatabase, id: number): void {
  db.prepare(`DELETE FROM instructions WHERE id = ?`).run(id)
  bumpAppState(db)
}

export function resolveInstructionsText(db: AppDatabase, repoId?: number | null): string | null {
  if (repoId != null) {
    const repoRow = db
      .prepare<InstructionsRow>(`SELECT * FROM instructions WHERE repo_id = ?`)
      .get(repoId)
    if (repoRow) {
      const text = readContent(mapInstructions(repoRow))
      if (text) return text
    }
  }
  const globalRow = db
    .prepare<InstructionsRow>(`SELECT * FROM instructions WHERE repo_id IS NULL`)
    .get()
  if (globalRow) {
    return readContent(mapInstructions(globalRow))
  }
  return null
}

function getInstructions(db: AppDatabase, id: number): Instructions {
  const row = db.prepare<InstructionsRow>(`SELECT * FROM instructions WHERE id = ?`).get(id)
  if (!row) throw new Error(`Instructions ${id} were not found`)
  return mapInstructions(row)
}

function readContent(instructions: Instructions): string | null {
  if (instructions.sourceType === 'file' && instructions.filePath) {
    try {
      return fs.readFileSync(instructions.filePath, 'utf-8')
    } catch {
      return null
    }
  }
  return instructions.body
}

function mapInstructions(row: InstructionsRow): Instructions {
  return {
    id: row.id,
    shortRef: row.short_ref,
    repoId: row.repo_id,
    sourceType: row.source_type as 'body' | 'file',
    body: row.body,
    filePath: row.file_path,
    updatedAt: row.updated_at,
  }
}
