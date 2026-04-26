import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreateReferenceInput, Reference, ReferenceOwnerType, ReferenceTargetType } from './types'

type ReferenceRow = {
  id: number
  short_ref: string
  owner_type: string
  owner_id: number
  target_type: string
  target_id: number | null
  file_path: string | null
  label: string | null
  created_at: string
}

export function listReferences(db: AppDatabase, ownerType: ReferenceOwnerType, ownerId: number): Reference[] {
  return db
    .prepare<ReferenceRow>(`SELECT * FROM "references" WHERE owner_type = ? AND owner_id = ? ORDER BY id ASC`)
    .all(ownerType, ownerId)
    .map(mapReference)
}

export function listReferencesByOwner(db: AppDatabase, ownerType: ReferenceOwnerType): Reference[] {
  return db
    .prepare<ReferenceRow>(`SELECT * FROM "references" WHERE owner_type = ? ORDER BY id ASC`)
    .all(ownerType)
    .map(mapReference)
}

export function createReference(db: AppDatabase, input: CreateReferenceInput): Reference {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `INSERT INTO "references" (owner_type, owner_id, target_type, target_id, file_path, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.ownerType,
      input.ownerId,
      input.targetType,
      input.targetId ?? null,
      input.filePath ?? null,
      input.label ?? null,
      now,
    )

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE "references" SET short_ref = ? WHERE id = ?`).run(`ref-${id}`, id)
  bumpAppState(db)
  return getReference(db, id)
}

export function deleteReference(db: AppDatabase, refId: number): void {
  db.prepare(`DELETE FROM "references" WHERE id = ?`).run(refId)
  bumpAppState(db)
}

export function getReference(db: AppDatabase, id: number): Reference {
  const row = db.prepare<ReferenceRow>(`SELECT * FROM "references" WHERE id = ?`).get(id)
  if (!row) {
    throw new Error(`Reference ${id} was not found`)
  }
  return mapReference(row)
}

export function getReferenceByRef(db: AppDatabase, ref: string): Reference {
  const normalized = ref.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<ReferenceRow>(`SELECT * FROM "references" WHERE id = ?`).get(numericId)
    : db.prepare<ReferenceRow>(`SELECT * FROM "references" WHERE short_ref = ?`).get(normalized)

  if (!row) {
    throw new Error(`Reference ${ref} was not found`)
  }

  return mapReference(row)
}

function mapReference(row: ReferenceRow): Reference {
  return {
    id: row.id,
    shortRef: row.short_ref,
    ownerType: row.owner_type as ReferenceOwnerType,
    ownerId: row.owner_id,
    targetType: row.target_type as ReferenceTargetType,
    targetId: row.target_id,
    filePath: row.file_path,
    label: row.label,
    createdAt: row.created_at,
  }
}