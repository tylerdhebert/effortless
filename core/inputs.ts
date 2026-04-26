import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import type {
  AnswerInputRequestInput,
  CreateInputRequestInput,
  InputChoice,
  InputRequest,
  InputRequestStatus,
  InputRequestType,
} from './types'

type InputRequestRow = {
  id: number
  short_ref: string
  effort_id: number
  plan_id: number | null
  task_id: number | null
  review_id: number | null
  agent_id: string | null
  type: InputRequestType
  prompt: string
  choices_json: string | null
  answer: string | null
  status: InputRequestStatus
  requested_at: string
  answered_at: string | null
}

export function listInputRequests(db: AppDatabase, effortId: number): InputRequest[] {
  return db
    .prepare<InputRequestRow>(
      `SELECT * FROM input_requests WHERE effort_id = ? ORDER BY id DESC`,
    )
    .all(effortId)
    .map(mapInputRequest)
}

export function listPendingInputRequests(db: AppDatabase, effortId: number): InputRequest[] {
  return db
    .prepare<InputRequestRow>(
      `SELECT * FROM input_requests WHERE effort_id = ? AND status = 'pending' ORDER BY id DESC`,
    )
    .all(effortId)
    .map(mapInputRequest)
}

export function createInputRequest(
  db: AppDatabase,
  input: CreateInputRequestInput,
): InputRequest {
  const resolved = resolveInputOwnership(db, input)
  const now = new Date().toISOString()

  const result = db
    .prepare(
      `
      INSERT INTO input_requests (
        effort_id, plan_id, task_id, review_id, agent_id, type, prompt, choices_json, answer, status, requested_at, answered_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', ?, NULL)
    `,
    )
    .run(
      resolved.effortId,
      resolved.planId,
      resolved.taskId,
      resolved.reviewId,
      input.agentId?.trim() || null,
      input.type,
      input.prompt.trim(),
      input.choices?.length ? JSON.stringify(input.choices) : null,
      now,
    )

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE input_requests SET short_ref = ? WHERE id = ?`).run(`input-${id}`, id)

  if (resolved.taskId) {
    addTaskComment(
      db,
      resolved.taskId,
      'agent',
      input.agentId?.trim() || null,
      'input-request',
      input.prompt.trim(),
    )
  }

  if (resolved.planId) {
    addPlanComment(
      db,
      resolved.planId,
      'agent',
      input.agentId?.trim() || null,
      'input-request',
      input.prompt.trim(),
    )
  }

  touchEffort(db, resolved.effortId)
  bumpAppState(db)

  return getInputRequest(db, id)
}

export function answerInputRequest(
  db: AppDatabase,
  input: AnswerInputRequestInput,
): InputRequest {
  const current = getInputRequest(db, input.inputRequestId)

  if (current.status === 'answered') {
    throw new Error(`Input request ${current.shortRef} was already answered`)
  }

  db.prepare(
    `
    UPDATE input_requests
    SET answer = ?,
        status = 'answered',
        answered_at = ?
    WHERE id = ?
  `,
  ).run(input.answer.trim(), new Date().toISOString(), input.inputRequestId)

  if (current.taskId) {
    addTaskComment(db, current.taskId, 'user', null, 'input-response', input.answer.trim())
  }

  if (current.planId) {
    addPlanComment(db, current.planId, 'user', null, 'input-response', input.answer.trim())
  }

  touchEffort(db, current.effortId)
  bumpAppState(db)

  return getInputRequest(db, input.inputRequestId)
}

export function getInputRequest(db: AppDatabase, id: number): InputRequest {
  const row = db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Input request ${id} was not found`)
  }

  return mapInputRequest(row)
}

export function getInputRequestByRef(db: AppDatabase, inputRef: string): InputRequest {
  const normalized = inputRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE id = ?`).get(numericId)
    : db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE short_ref = ?`).get(normalized)

  if (!row) {
    throw new Error(`Input request ${inputRef} was not found`)
  }

  return mapInputRequest(row)
}

function resolveInputOwnership(
  db: AppDatabase,
  input: CreateInputRequestInput,
): { effortId: number; planId: number | null; taskId: number | null; reviewId: number | null } {
  if (input.reviewId) {
    const row = db
      .prepare<{ task_id: number; effort_id: number }>(
        `
        SELECT reviews.task_id, tasks.effort_id
        FROM reviews
        JOIN tasks ON tasks.id = reviews.task_id
        WHERE reviews.id = ?
      `,
      )
      .get(input.reviewId)

    if (!row) {
      throw new Error(`Review ${input.reviewId} was not found`)
    }

    return {
      effortId: row.effort_id,
      planId: null,
      taskId: row.task_id,
      reviewId: input.reviewId,
    }
  }

  if (input.taskId) {
    const row = db
      .prepare<{ effort_id: number }>(`SELECT effort_id FROM tasks WHERE id = ?`)
      .get(input.taskId)

    if (!row) {
      throw new Error(`Task ${input.taskId} was not found`)
    }

    return {
      effortId: row.effort_id,
      planId: null,
      taskId: input.taskId,
      reviewId: null,
    }
  }

  if (input.planId) {
    const row = db
      .prepare<{ effort_id: number }>(`SELECT effort_id FROM plans WHERE id = ?`)
      .get(input.planId)

    if (!row) {
      throw new Error(`Plan ${input.planId} was not found`)
    }

    return {
      effortId: row.effort_id,
      planId: input.planId,
      taskId: null,
      reviewId: null,
    }
  }

  if (!input.effortId) {
    throw new Error('Input request needs an effort, plan, task, or review target')
  }

  const effortExists = db
    .prepare<{ id: number }>(`SELECT id FROM efforts WHERE id = ?`)
    .get(input.effortId)

  if (!effortExists) {
    throw new Error(`Effort ${input.effortId} was not found`)
  }

  return {
    effortId: input.effortId,
    planId: null,
    taskId: null,
    reviewId: null,
  }
}

function touchEffort(db: AppDatabase, effortId: number): void {
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), effortId)
}

function addTaskComment(
  db: AppDatabase,
  taskId: number,
  author: 'user' | 'agent',
  agentId: string | null,
  kind: 'input-request' | 'input-response',
  body: string,
): void {
  db.prepare(
    `
    INSERT INTO task_comments (task_id, author, agent_id, kind, body, commit_hash, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `,
  ).run(taskId, author, agentId, kind, body, new Date().toISOString())
}

function addPlanComment(
  db: AppDatabase,
  planId: number,
  author: 'user' | 'agent',
  agentId: string | null,
  kind: 'input-request' | 'input-response',
  body: string,
): void {
  db.prepare(
    `
    INSERT INTO plan_comments (plan_id, author, agent_id, kind, body, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(planId, author, agentId, kind, body, new Date().toISOString())
}

function mapInputRequest(row: InputRequestRow): InputRequest {
  return {
    id: row.id,
    shortRef: row.short_ref,
    effortId: row.effort_id,
    planId: row.plan_id,
    taskId: row.task_id,
    reviewId: row.review_id,
    agentId: row.agent_id,
    type: row.type,
    prompt: row.prompt,
    choices: row.choices_json ? (JSON.parse(row.choices_json) as InputChoice[]) : null,
    answer: row.answer,
    status: row.status,
    requestedAt: row.requested_at,
    answeredAt: row.answered_at,
  }
}
