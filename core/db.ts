import fs from 'node:fs'
import Database from 'better-sqlite3'
import { getAppPaths } from './appPaths'

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_state (id, version, updated_at)
    VALUES (1, 0, datetime('now'));

    CREATE TABLE IF NOT EXISTS efforts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      template TEXT NOT NULL,
      accepted_plan_id INTEGER,
      plan_requires_review INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
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
      owner_agent_id TEXT,
      repo_id INTEGER,
      branch_name TEXT,
      base_branch TEXT,
      worktree_path TEXT,
      requires_review INTEGER NOT NULL DEFAULT 1,
      review_requires_review INTEGER NOT NULL DEFAULT 1,
      handoff_summary TEXT,
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
      author_agent_id TEXT,
      created_at TEXT NOT NULL,
      ready_at TEXT,
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      short_ref TEXT UNIQUE,
      verdict TEXT NOT NULL,
      body TEXT NOT NULL,
      summary TEXT,
      author_agent_id TEXT,
      created_at TEXT NOT NULL,
      applied_at TEXT
    );

    CREATE TABLE IF NOT EXISTS discussion_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      effort_id INTEGER NOT NULL REFERENCES efforts(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      agent_id TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS input_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_ref TEXT UNIQUE,
      effort_id INTEGER NOT NULL REFERENCES efforts(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES plans(id) ON DELETE CASCADE,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
      agent_id TEXT,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      choices_json TEXT,
      answer TEXT,
      status TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      answered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS plan_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      agent_id TEXT,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      agent_id TEXT,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      commit_hash TEXT,
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

  ensureColumn(db, 'tasks', 'repo_id', 'INTEGER')
  ensureColumn(db, 'tasks', 'branch_name', 'TEXT')
  ensureColumn(db, 'tasks', 'base_branch', 'TEXT')
  ensureColumn(db, 'tasks', 'worktree_path', 'TEXT')
  ensureColumn(db, 'tasks', 'handoff_summary', 'TEXT')
  ensureColumn(db, 'tasks', 'artifact', 'TEXT')
  ensureColumn(db, 'plans', 'ready_at', 'TEXT')
  ensureColumn(db, 'plans', 'accepted_at', 'TEXT')
  ensureColumn(db, 'input_requests', 'short_ref', 'TEXT')
  ensureColumn(db, 'efforts', 'needs_tasks', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'efforts', 'summary', 'TEXT')
  ensureColumn(db, 'app_state', 'os_notifications_enabled', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'app_state', 'banner_notifications_enabled', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'app_state', 'badge_notifications_enabled', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'app_state', 'sound_notifications_enabled', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'app_state', 'toast_duration_seconds', 'INTEGER NOT NULL DEFAULT 5')
  ensureColumn(db, 'app_state', 'theme', 'TEXT NOT NULL DEFAULT \'grass\'')
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

function ensureColumn(db: AppDatabase, tableName: string, columnName: string, columnSql: string): void {
  const columns = db
    .prepare<{ name: string }>(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => row.name)

  if (columns.includes(columnName)) {
    return
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`)
}
