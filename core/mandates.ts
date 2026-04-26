import fs from 'node:fs'
import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreateMandateInput, Mandate, UpdateMandateInput, WorkSurface } from './types'

type MandateRow = {
  id: number
  short_ref: string
  work_surface: string
  repo_id: number | null
  source_type: string
  body: string | null
  file_path: string | null
  updated_at: string
}

export function listMandates(db: AppDatabase): Mandate[] {
  return db
    .prepare<MandateRow>(`SELECT * FROM mandates ORDER BY work_surface ASC, id ASC`)
    .all()
    .map(mapMandate)
}

export function listMandatesBySurface(
  db: AppDatabase,
  workSurface: WorkSurface,
  repoId?: number | null,
): Mandate[] {
  if (repoId != null) {
    return db
      .prepare<MandateRow>(
        `SELECT * FROM mandates WHERE work_surface = ? AND (repo_id = ? OR repo_id IS NULL) ORDER BY repo_id ASC, id ASC`,
      )
      .all(workSurface, repoId)
      .map(mapMandate)
  }

  return db
    .prepare<MandateRow>(`SELECT * FROM mandates WHERE work_surface = ? AND repo_id IS NULL ORDER BY id ASC`)
    .all(workSurface)
    .map(mapMandate)
}

export function createMandate(db: AppDatabase, input: CreateMandateInput): Mandate {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO mandates (work_surface, repo_id, source_type, body, file_path, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.workSurface, input.repoId ?? null, input.sourceType, input.body ?? null, input.filePath ?? null, now)

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE mandates SET short_ref = ? WHERE id = ?`).run(`mandate-${id}`, id)
  bumpAppState(db)
  return getMandate(db, id)
}

export function updateMandate(db: AppDatabase, input: UpdateMandateInput): Mandate {
  const existing = getMandate(db, input.mandateId)
  const workSurface = input.workSurface ?? existing.workSurface
  const repoId = input.repoId !== undefined ? input.repoId : existing.repoId
  const sourceType = input.sourceType ?? existing.sourceType
  const body = input.body !== undefined ? input.body : existing.body
  const filePath = input.filePath !== undefined ? input.filePath : existing.filePath

  db.prepare(
    `UPDATE mandates SET work_surface = ?, repo_id = ?, source_type = ?, body = ?, file_path = ?, updated_at = ? WHERE id = ?`,
  ).run(workSurface, repoId, sourceType, body, filePath, new Date().toISOString(), input.mandateId)

  bumpAppState(db)
  return getMandate(db, input.mandateId)
}

export function deleteMandate(db: AppDatabase, mandateId: number): void {
  db.prepare(`DELETE FROM mandates WHERE id = ?`).run(mandateId)
  bumpAppState(db)
}

export function getMandate(db: AppDatabase, id: number): Mandate {
  const row = db.prepare<MandateRow>(`SELECT * FROM mandates WHERE id = ?`).get(id)
  if (!row) {
    throw new Error(`Mandate ${id} was not found`)
  }
  return mapMandate(row)
}

export function getMandateByRef(db: AppDatabase, mandateRef: string): Mandate {
  const normalized = mandateRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<MandateRow>(`SELECT * FROM mandates WHERE id = ?`).get(numericId)
    : db.prepare<MandateRow>(`SELECT * FROM mandates WHERE short_ref = ?`).get(normalized)

  if (!row) {
    throw new Error(`Mandate ${mandateRef} was not found`)
  }

  return mapMandate(row)
}

export function resolveMandateText(
  db: AppDatabase,
  workSurface: WorkSurface,
  repoId?: number | null,
): string | null {
  let mandate: Mandate | null = null

  if (repoId != null) {
    const repoRow = db
      .prepare<MandateRow>(`SELECT * FROM mandates WHERE work_surface = ? AND repo_id = ?`)
      .get(workSurface, repoId)
    if (repoRow) {
      mandate = mapMandate(repoRow)
    }
  }

  if (!mandate) {
    const globalRow = db
      .prepare<MandateRow>(`SELECT * FROM mandates WHERE work_surface = ? AND repo_id IS NULL`)
      .get(workSurface)
    if (globalRow) {
      mandate = mapMandate(globalRow)
    }
  }

  if (!mandate) {
    return null
  }

  if (mandate.sourceType === 'file' && mandate.filePath) {
    try {
      return fs.readFileSync(mandate.filePath, 'utf-8')
    } catch {
      return null
    }
  }

  return mandate.body
}

function mapMandate(row: MandateRow): Mandate {
  return {
    id: row.id,
    shortRef: row.short_ref,
    workSurface: row.work_surface as WorkSurface,
    repoId: row.repo_id,
    sourceType: row.source_type as 'body' | 'file',
    body: row.body,
    filePath: row.file_path,
    updatedAt: row.updated_at,
  }
}