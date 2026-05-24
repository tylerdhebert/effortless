import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type {
  AgentProfile,
  CreateAgentProfileInput,
  RunEnvironment,
  UpdateAgentProfileInput,
} from './types'

type AgentProfileRow = {
  id: number
  short_ref: string
  name: string
  command_template: string
  fork_command_template: string | null
  environment: RunEnvironment
  wsl_distro: string | null
  default_cwd_kind: AgentProfile['defaultCwdKind']
  custom_cwd: string | null
  env_json: string
  created_at: string
  updated_at: string
}

export function listAgentProfiles(db: AppDatabase): AgentProfile[] {
  ensureDefaultAgentProfile(db)
  return db
    .prepare<AgentProfileRow>(`SELECT * FROM agent_profiles ORDER BY id ASC`)
    .all()
    .map(mapAgentProfile)
}

export function getAgentProfile(db: AppDatabase, profileId: number): AgentProfile {
  ensureDefaultAgentProfile(db)
  const row = db.prepare<AgentProfileRow>(`SELECT * FROM agent_profiles WHERE id = ?`).get(profileId)
  if (!row) {
    throw new Error(`Agent profile ${profileId} was not found`)
  }
  return mapAgentProfile(row)
}

export function getDefaultAgentProfile(db: AppDatabase): AgentProfile {
  ensureDefaultAgentProfile(db)
  const row = db
    .prepare<AgentProfileRow>(`SELECT * FROM agent_profiles ORDER BY id ASC LIMIT 1`)
    .get()
  if (!row) {
    throw new Error('Default agent profile was not found')
  }
  return mapAgentProfile(row)
}

export function createAgentProfile(db: AppDatabase, input: CreateAgentProfileInput): AgentProfile {
  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO agent_profiles (
      short_ref, name, command_template, fork_command_template, environment, wsl_distro, default_cwd_kind, custom_cwd, env_json, created_at, updated_at
    )
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.name.trim(),
    '',
    null,
    input.environment ?? 'windows',
    input.wslDistro?.trim() || null,
    input.defaultCwdKind ?? 'task_worktree',
    input.customCwd?.trim() || null,
    JSON.stringify(input.env ?? {}),
    now,
    now,
  )
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE agent_profiles SET short_ref = ? WHERE id = ?`).run(`profile-${id}`, id)
  bumpAppState(db)
  return getAgentProfile(db, id)
}

export function countAgentProfileReferences(
  db: AppDatabase,
  profileId: number,
): { runs: number; efforts: number } {
  getAgentProfile(db, profileId)
  const runs =
    db.prepare<{ count: number }>(`SELECT COUNT(*) AS count FROM agent_runs WHERE profile_id = ?`).get(profileId)
      ?.count ?? 0
  const efforts =
    db
      .prepare<{ count: number }>(`SELECT COUNT(*) AS count FROM efforts WHERE default_profile_id = ?`)
      .get(profileId)?.count ?? 0
  return { runs, efforts }
}

export function deleteAgentProfile(db: AppDatabase, profileId: number): void {
  const { runs, efforts } = countAgentProfileReferences(db, profileId)
  if (runs > 0) {
    throw new Error(`profile is used by ${runs} run${runs === 1 ? '' : 's'}`)
  }
  if (efforts > 0) {
    throw new Error(`profile is the default on ${efforts} effort${efforts === 1 ? '' : 's'}`)
  }

  const profileCount =
    db.prepare<{ count: number }>(`SELECT COUNT(*) AS count FROM agent_profiles`).get()?.count ?? 0
  if (profileCount <= 1) {
    throw new Error('cannot delete the last profile')
  }

  db.prepare(`DELETE FROM agent_profiles WHERE id = ?`).run(profileId)
  bumpAppState(db)
}

export function updateAgentProfile(db: AppDatabase, input: UpdateAgentProfileInput): AgentProfile {
  getAgentProfile(db, input.profileId)
  db.prepare(`
    UPDATE agent_profiles
    SET name = ?,
        command_template = ?,
        fork_command_template = ?,
        environment = ?,
        wsl_distro = ?,
        default_cwd_kind = ?,
        custom_cwd = ?,
        env_json = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    input.name.trim(),
    '',
    null,
    input.environment ?? 'windows',
    input.wslDistro?.trim() || null,
    input.defaultCwdKind ?? 'task_worktree',
    input.customCwd?.trim() || null,
    JSON.stringify(input.env ?? {}),
    new Date().toISOString(),
    input.profileId,
  )
  bumpAppState(db)
  return getAgentProfile(db, input.profileId)
}

function ensureDefaultAgentProfile(db: AppDatabase): void {
  const existing = db.prepare<{ count: number }>(`SELECT COUNT(*) AS count FROM agent_profiles`).get()
  if ((existing?.count ?? 0) > 0) return

  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO agent_profiles (
      short_ref, name, command_template, fork_command_template, environment, wsl_distro, default_cwd_kind, custom_cwd, env_json, created_at, updated_at
    )
    VALUES (NULL, 'default', '', NULL, 'windows', NULL, 'task_worktree', NULL, '{}', ?, ?)
  `).run(now, now)
  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE agent_profiles SET short_ref = ? WHERE id = ?`).run(`profile-${id}`, id)
}

function mapAgentProfile(row: AgentProfileRow): AgentProfile {
  return {
    id: row.id,
    shortRef: row.short_ref,
    name: row.name,
    environment: row.environment,
    wslDistro: row.wsl_distro,
    defaultCwdKind: row.default_cwd_kind,
    customCwd: row.custom_cwd,
    env: parseEnv(row.env_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseEnv(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
  } catch {
    return {}
  }
}
