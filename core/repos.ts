import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreateRepoInput, Repo, UpdateRepoInput } from './types'

type RepoRow = {
  id: number
  short_ref: string
  name: string
  path: string
  base_branch: string
  build_command: string | null
  created_at: string
  updated_at: string
}

export function listRepos(db: AppDatabase): Repo[] {
  return db
    .prepare<RepoRow>(`SELECT * FROM repos ORDER BY name COLLATE NOCASE ASC, id ASC`)
    .all()
    .map(mapRepo)
}

export function createRepo(db: AppDatabase, input: CreateRepoInput): Repo {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO repos (name, path, base_branch, build_command, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      input.name.trim(),
      input.path.trim(),
      input.baseBranch.trim(),
      input.buildCommand?.trim() || null,
      now,
      now,
    )

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE repos SET short_ref = ? WHERE id = ?`).run(`repo-${id}`, id)
  bumpAppState(db)
  return getRepo(db, id)
}

export function updateRepo(db: AppDatabase, input: UpdateRepoInput): Repo {
  db.prepare(
    `
    UPDATE repos
    SET name = ?,
        path = ?,
        base_branch = ?,
        build_command = ?,
        updated_at = ?
    WHERE id = ?
  `,
  ).run(
    input.name.trim(),
    input.path.trim(),
    input.baseBranch.trim(),
    input.buildCommand?.trim() || null,
    new Date().toISOString(),
    input.repoId,
  )

  bumpAppState(db)
  return getRepo(db, input.repoId)
}

export function deleteRepo(db: AppDatabase, repoId: number): void {
  db.prepare(`UPDATE tasks SET repo_id = NULL WHERE repo_id = ?`).run(repoId)
  db.prepare(`DELETE FROM repos WHERE id = ?`).run(repoId)
  bumpAppState(db)
}

export function getRepo(db: AppDatabase, id: number): Repo {
  const row = db.prepare<RepoRow>(`SELECT * FROM repos WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Repo ${id} was not found`)
  }

  return mapRepo(row)
}

export function getRepoByRef(db: AppDatabase, repoRef: string): Repo {
  const normalized = repoRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<RepoRow>(`SELECT * FROM repos WHERE id = ?`).get(numericId)
    : db.prepare<RepoRow>(`SELECT * FROM repos WHERE short_ref = ?`).get(normalized)

  if (!row) {
    throw new Error(`Repo ${repoRef} was not found`)
  }

  return mapRepo(row)
}

function mapRepo(row: RepoRow): Repo {
  return {
    id: row.id,
    shortRef: row.short_ref,
    name: row.name,
    path: row.path,
    baseBranch: row.base_branch,
    buildCommand: row.build_command,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
