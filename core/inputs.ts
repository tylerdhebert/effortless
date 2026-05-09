import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { addActivityEvent } from './activity'
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
  task_id: number | null
  run_id: number | null
  type: InputRequestType
  prompt: string
  choices_json: string | null
  answer: string | null
  status: InputRequestStatus
  requested_at: string
  answered_at: string | null
}

export function listInputRequests(db: AppDatabase, effortId: number): InputRequest[] {
  return db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE effort_id = ? ORDER BY id DESC`).all(effortId).map(mapInputRequest)
}

export function listPendingInputRequests(db: AppDatabase, effortId: number): InputRequest[] {
  return db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE effort_id = ? AND status = 'pending' ORDER BY id DESC`).all(effortId).map(mapInputRequest)
}

export function createInputRequest(db: AppDatabase, input: CreateInputRequestInput): InputRequest {
  const resolved = resolveInputOwnership(db, input)
  const now = new Date().toISOString()
  const result = db.prepare(`
    INSERT INTO input_requests (
      effort_id, task_id, run_id, type, prompt, choices_json, answer, status, requested_at, answered_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', ?, NULL)
  `).run(
    resolved.effortId,
    resolved.taskId,
    input.runId ?? null,
    input.type,
    input.prompt.trim(),
    input.choices?.length ? JSON.stringify(input.choices) : null,
    now,
  )

  const id = Number(result.lastInsertRowid)
  db.prepare(`UPDATE input_requests SET short_ref = ? WHERE id = ?`).run(`input-${id}`, id)
  addActivityEvent(db, {
    effortId: resolved.effortId,
    taskId: resolved.taskId,
    runId: input.runId ?? null,
    author: 'agent',
    kind: 'input-request',
    body: input.prompt.trim(),
    metadata: { inputId: id },
  })
  touchEffort(db, resolved.effortId)
  bumpAppState(db)
  return getInputRequest(db, id)
}

export function answerInputRequest(db: AppDatabase, input: AnswerInputRequestInput): InputRequest {
  const current = getInputRequest(db, input.inputRequestId)
  if (current.status === 'answered') {
    throw new Error(`Input request ${current.shortRef} was already answered`)
  }

  db.prepare(`
    UPDATE input_requests
    SET answer = ?,
        status = 'answered',
        answered_at = ?
    WHERE id = ?
  `).run(input.answer.trim(), new Date().toISOString(), input.inputRequestId)

  addActivityEvent(db, {
    effortId: current.effortId,
    taskId: current.taskId,
    runId: current.runId,
    author: 'user',
    kind: 'input-response',
    body: input.answer.trim(),
    metadata: { inputId: current.id },
  })
  touchEffort(db, current.effortId)
  bumpAppState(db)
  return getInputRequest(db, input.inputRequestId)
}

export function getInputRequest(db: AppDatabase, id: number): InputRequest {
  const row = db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE id = ?`).get(id)
  if (!row) throw new Error(`Input request ${id} was not found`)
  return mapInputRequest(row)
}

export function getInputRequestByRef(db: AppDatabase, inputRef: string): InputRequest {
  const normalized = inputRef.trim()
  const numericId = normalized.match(/^\d+$/) ? Number(normalized) : null
  const row = numericId
    ? db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE id = ?`).get(numericId)
    : db.prepare<InputRequestRow>(`SELECT * FROM input_requests WHERE short_ref = ?`).get(normalized)
  if (!row) throw new Error(`Input request ${inputRef} was not found`)
  return mapInputRequest(row)
}

function resolveInputOwnership(db: AppDatabase, input: CreateInputRequestInput): { effortId: number; taskId: number | null } {
  if (input.taskId) {
    const row = db.prepare<{ effort_id: number }>(`SELECT effort_id FROM tasks WHERE id = ?`).get(input.taskId)
    if (!row) throw new Error(`Task ${input.taskId} was not found`)
    return { effortId: row.effort_id, taskId: input.taskId }
  }

  if (!input.effortId) {
    throw new Error('Input request needs an effort or task target')
  }

  const effortExists = db.prepare<{ id: number }>(`SELECT id FROM efforts WHERE id = ?`).get(input.effortId)
  if (!effortExists) throw new Error(`Effort ${input.effortId} was not found`)
  return { effortId: input.effortId, taskId: null }
}

function touchEffort(db: AppDatabase, effortId: number): void {
  db.prepare(`UPDATE efforts SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), effortId)
}

function mapInputRequest(row: InputRequestRow): InputRequest {
  return {
    id: row.id,
    shortRef: row.short_ref,
    effortId: row.effort_id,
    taskId: row.task_id,
    runId: row.run_id,
    type: row.type,
    prompt: row.prompt,
    choices: row.choices_json ? JSON.parse(row.choices_json) as InputChoice[] : null,
    answer: row.answer,
    status: row.status,
    requestedAt: row.requested_at,
    answeredAt: row.answered_at,
  }
}
