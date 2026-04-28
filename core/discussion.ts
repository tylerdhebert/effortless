import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type { CreateDiscussionMessageInput, DiscussionMessage } from './types'

type DiscussionMessageRow = {
  id: number
  effort_id: number
  author: DiscussionMessage['author']
  agent_id: string | null
  body: string
  created_at: string
}

export function listDiscussionMessages(db: AppDatabase, effortId: number): DiscussionMessage[] {
  return db
    .prepare<DiscussionMessageRow>(
      `SELECT * FROM discussion_messages WHERE effort_id = ? ORDER BY id DESC`,
    )
    .all(effortId)
    .map(mapDiscussionMessage)
}

export function createDiscussionMessage(
  db: AppDatabase,
  input: CreateDiscussionMessageInput,
): DiscussionMessage {
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
      INSERT INTO discussion_messages (effort_id, author, agent_id, body, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    )
    .run(
      input.effortId,
      input.author,
      input.agentId?.trim() || null,
      input.body.trim(),
      now,
    )

  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(now, input.effortId)
  bumpAppState(db)

  return getDiscussionMessage(db, Number(result.lastInsertRowid))
}

function getDiscussionMessage(db: AppDatabase, id: number): DiscussionMessage {
  const row = db.prepare<DiscussionMessageRow>(`SELECT * FROM discussion_messages WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Discussion message ${id} was not found`)
  }

  return mapDiscussionMessage(row)
}

function mapDiscussionMessage(row: DiscussionMessageRow): DiscussionMessage {
  return {
    id: row.id,
    effortId: row.effort_id,
    author: row.author,
    agentId: row.agent_id,
    body: row.body,
    createdAt: row.created_at,
  }
}