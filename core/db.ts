import fs from 'node:fs'
import Database from 'better-sqlite3'
import { DEFAULT_AGENT_PROVIDER } from './agentProviders'
import { getAppPaths } from './appPaths'
import { DEFAULT_GLOBAL_MANDATES } from './defaultMandates'
import { DEFAULT_TEMPLATE_PLAYBOOKS } from './defaultTemplatePlaybooks'

export type AppDatabase = Database
export type AppState = {
  version: number
  updatedAt: string
  osNotificationsEnabled: boolean
  bannerNotificationsEnabled: boolean
  badgeNotificationsEnabled: boolean
  soundNotificationsEnabled: boolean
  toastDurationSeconds: number
  theme: string
}

export function openDatabase(): AppDatabase {
  const paths = getAppPaths()
  fs.mkdirSync(paths.home, { recursive: true })

  const db = new Database(paths.databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)

  return db
}

export function initializeSchema(db: AppDatabase): void {
  resetOldV2Schema(db)

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      os_notifications_enabled INTEGER NOT NULL DEFAULT 1,
      banner_notifications_enabled INTEGER NOT NULL DEFAULT 1,
      badge_notifications_enabled INTEGER NOT NULL DEFAULT 1,
      sound_notifications_enabled INTEGER NOT NULL DEFAULT 0,
      toast_duration_seconds INTEGER NOT NULL DEFAULT 5,
      theme TEXT NOT NULL DEFAULT 'grass'
    );

    INSERT OR IGNORE INTO app_state (id, version, updated_at)
    VALUES (1, 0, datetime('now'));

    CREATE TABLE IF NOT EXISTS efforts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      template TEXT NOT NULL,
      default_provider TEXT NOT NULL DEFAULT 'codex',
      default_profile_id INTEGER REFERENCES agent_profiles(id),
      accepted_plan_id INTEGER,
      status TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      base_branch TEXT NOT NULL,
      build_command TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      effort_id INTEGER NOT NULL REFERENCES efforts(id) ON DELETE CASCADE,
      short_ref TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      repo_id INTEGER,
      branch_name TEXT,
      base_branch TEXT,
      worktree_path TEXT,
      artifact TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      effort_id INTEGER NOT NULL REFERENCES efforts(id) ON DELETE CASCADE,
      short_ref TEXT UNIQUE,
      body TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      short_ref TEXT UNIQUE,
      verdict TEXT NOT NULL,
      body TEXT NOT NULL,
      summary TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS input_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      effort_id INTEGER NOT NULL REFERENCES efforts(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      run_id INTEGER,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      choices_json TEXT,
      answer TEXT,
      status TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      answered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      effort_id INTEGER NOT NULL REFERENCES efforts(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      run_id INTEGER,
      author TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_build_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      output TEXT NOT NULL,
      triggered_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS mandates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      work_surface TEXT NOT NULL,
      repo_id INTEGER,
      source_type TEXT NOT NULL,
      body TEXT,
      file_path TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_mandates_surface_repo ON mandates(work_surface, COALESCE(repo_id, -1));

    CREATE TABLE IF NOT EXISTS template_playbooks (
      template TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      name TEXT NOT NULL,
      command_template TEXT NOT NULL,
      fork_command_template TEXT,
      environment TEXT NOT NULL,
      wsl_distro TEXT,
      default_cwd_kind TEXT NOT NULL,
      custom_cwd TEXT,
      env_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      effort_id INTEGER NOT NULL REFERENCES efforts(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      profile_id INTEGER NOT NULL REFERENCES agent_profiles(id),
      provider TEXT NOT NULL DEFAULT 'codex',
      purpose TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      environment TEXT NOT NULL,
      cwd TEXT NOT NULL,
      command TEXT NOT NULL,
      provider_session_id TEXT,
      terminal_tab_key TEXT,
      exit_code INTEGER,
      error TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "references" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      owner_type TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      file_path TEXT,
      label TEXT,
      created_at TEXT NOT NULL
    );
  `)

  const addedEffortProvider = ensureColumn(db, 'efforts', 'default_provider', `TEXT NOT NULL DEFAULT '${DEFAULT_AGENT_PROVIDER}'`)
  ensureColumn(db, 'efforts', 'default_profile_id', 'INTEGER')
  ensureColumn(db, 'agent_profiles', 'fork_command_template', 'TEXT')
  const addedRunProvider = ensureColumn(db, 'agent_runs', 'provider', `TEXT NOT NULL DEFAULT '${DEFAULT_AGENT_PROVIDER}'`)

  if (addedEffortProvider || addedRunProvider) {
    migrateLegacyProviders(db, { efforts: addedEffortProvider, runs: addedRunProvider })
  }

  seedDefaultGlobalMandates(db)
  seedDefaultTemplatePlaybooks(db)
}

function ensureColumn(db: AppDatabase, table: string, column: string, definition: string): boolean {
  const columns = db.prepare<{ name: string }>(`PRAGMA table_info(${table})`).all()
  if (columns.some((candidate) => candidate.name === column)) return false
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  return true
}

function migrateLegacyProviders(
  db: AppDatabase,
  targets: { efforts: boolean; runs: boolean },
): void {
  if (targets.efforts) {
    db.exec(`
      UPDATE efforts
      SET default_provider = COALESCE((
        SELECT CASE
          WHEN lower(agent_profiles.command_template) LIKE '%opencode%' THEN 'opencode'
          WHEN lower(agent_profiles.command_template) LIKE '%claude%' THEN 'claude'
          WHEN lower(agent_profiles.command_template) LIKE '%cursor%' THEN 'cursor'
          WHEN lower(agent_profiles.command_template) LIKE '%copilot%' THEN 'copilot'
          ELSE 'codex'
        END
        FROM agent_profiles
        WHERE agent_profiles.id = efforts.default_profile_id
      ), default_provider)
    `)
  }

  if (targets.runs) {
    db.exec(`
      UPDATE agent_runs
      SET provider = COALESCE((
        SELECT CASE
          WHEN lower(agent_profiles.command_template) LIKE '%opencode%' THEN 'opencode'
          WHEN lower(agent_profiles.command_template) LIKE '%claude%' THEN 'claude'
          WHEN lower(agent_profiles.command_template) LIKE '%cursor%' THEN 'cursor'
          WHEN lower(agent_profiles.command_template) LIKE '%copilot%' THEN 'copilot'
          ELSE 'codex'
        END
        FROM agent_profiles
        WHERE agent_profiles.id = agent_runs.profile_id
      ), provider)
    `)
  }
}

function resetOldV2Schema(db: AppDatabase): void {
  const agentRuns = db
    .prepare<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_runs'`)
    .get()

  if (!agentRuns) {
    return
  }

  const columns = db.prepare<{ name: string }>(`PRAGMA table_info(agent_runs)`).all()
  const hasRawTranscriptColumn = columns.some((column) => column.name === 'transcript_path')

  if (!hasRawTranscriptColumn) {
    return
  }

  db.exec(`
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS "references";
    DROP TABLE IF EXISTS agent_runs;
    DROP TABLE IF EXISTS agent_profiles;
    DROP TABLE IF EXISTS template_playbooks;
    DROP TABLE IF EXISTS mandates;
    DROP TABLE IF EXISTS task_build_results;
    DROP TABLE IF EXISTS activity_events;
    DROP TABLE IF EXISTS input_requests;
    DROP TABLE IF EXISTS reviews;
    DROP TABLE IF EXISTS plans;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS repos;
    DROP TABLE IF EXISTS efforts;
    DROP TABLE IF EXISTS app_state;

    PRAGMA foreign_keys = ON;
  `)
}

export function bumpAppState(db: AppDatabase): void {
  db.prepare(`
    UPDATE app_state
    SET version = version + 1,
        updated_at = ?
    WHERE id = 1
  `).run(new Date().toISOString())
}

export type NotificationSettings = {
  osNotificationsEnabled?: boolean
  bannerNotificationsEnabled?: boolean
  badgeNotificationsEnabled?: boolean
  soundNotificationsEnabled?: boolean
  toastDurationSeconds?: number
  theme?: string
}

export function updateNotificationSettings(
  db: AppDatabase,
  settings: NotificationSettings,
): AppState {
  const current = getAppState(db)
  db.prepare(`
    UPDATE app_state
    SET os_notifications_enabled = ?,
        banner_notifications_enabled = ?,
        badge_notifications_enabled = ?,
        sound_notifications_enabled = ?,
        toast_duration_seconds = ?,
        theme = ?
    WHERE id = 1
  `).run(
    settings.osNotificationsEnabled ?? current.osNotificationsEnabled ? 1 : 0,
    settings.bannerNotificationsEnabled ?? current.bannerNotificationsEnabled ? 1 : 0,
    settings.badgeNotificationsEnabled ?? current.badgeNotificationsEnabled ? 1 : 0,
    settings.soundNotificationsEnabled ?? current.soundNotificationsEnabled ? 1 : 0,
    settings.toastDurationSeconds ?? current.toastDurationSeconds,
    settings.theme ?? current.theme,
  )
  bumpAppState(db)
  return getAppState(db)
}

export function getAppState(db: AppDatabase): AppState {
  const row = db
    .prepare<{
      version: number
      updated_at: string
      os_notifications_enabled: number
      banner_notifications_enabled: number
      badge_notifications_enabled: number
      sound_notifications_enabled: number
      toast_duration_seconds: number
      theme: string
    }>(`SELECT version, updated_at, os_notifications_enabled, banner_notifications_enabled, badge_notifications_enabled, sound_notifications_enabled, toast_duration_seconds, theme FROM app_state WHERE id = 1`)
    .get()

  if (!row) {
    throw new Error('App state was not found')
  }

  return {
    version: row.version,
    updatedAt: row.updated_at,
    osNotificationsEnabled: Boolean(row.os_notifications_enabled),
    bannerNotificationsEnabled: Boolean(row.banner_notifications_enabled),
    badgeNotificationsEnabled: Boolean(row.badge_notifications_enabled),
    soundNotificationsEnabled: Boolean(row.sound_notifications_enabled),
    toastDurationSeconds: row.toast_duration_seconds,
    theme: row.theme,
  }
}

function seedDefaultGlobalMandates(db: AppDatabase): void {
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO mandates (work_surface, repo_id, source_type, body, file_path, updated_at)
    VALUES (?, NULL, 'body', ?, NULL, ?)
  `)

  for (const mandate of DEFAULT_GLOBAL_MANDATES) {
    insert.run(mandate.workSurface, mandate.body, now)
  }

  db.prepare(`
    UPDATE mandates
    SET short_ref = 'mandate-' || id
    WHERE short_ref IS NULL
  `).run()
}

function seedDefaultTemplatePlaybooks(db: AppDatabase): void {
  const now = new Date().toISOString()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO template_playbooks (template, body, updated_at)
    VALUES (?, ?, ?)
  `)

  for (const playbook of DEFAULT_TEMPLATE_PLAYBOOKS) {
    insert.run(playbook.template, playbook.body, now)
  }
}
