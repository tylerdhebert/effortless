import { openDatabase } from '../../core/db'
import { getEffortByRef } from '../../core/efforts'
import { getReviewByRef } from '../../core/reviews'
import { getTaskByRef } from '../../core/tasks'
import type { AppDatabase } from '../../core/db'
import { option } from './args'

export const db = openDatabase()

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function resolveTask(database: AppDatabase, taskRef: string) {
  return getTaskByRef(database, taskRef)
}

export function resolveNumericOrShortRef(database: AppDatabase, tableName: 'plans', ref: string): number {
  const numericId = ref.trim().match(/^\d+$/) ? Number(ref.trim()) : null
  const row = numericId
    ? database.prepare<{ id: number }>(`SELECT id FROM ${tableName} WHERE id = ?`).get(numericId)
    : database.prepare<{ id: number }>(`SELECT id FROM ${tableName} WHERE short_ref = ?`).get(ref.trim())

  if (!row) {
    throw new Error(`${tableName.slice(0, -1)} ${ref} was not found`)
  }

  return row.id
}

export function resolveRefOwnerType(): 'effort' | 'plan' | 'task' | 'review' {
  const ownerType = option('--owner-type')

  if (ownerType === 'effort' || ownerType === 'plan' || ownerType === 'task' || ownerType === 'review') {
    return ownerType
  }

  throw new Error('--owner-type is required (effort, plan, task, or review)')
}

export function resolveRefOwnerId(database: AppDatabase): number {
  const ownerType = resolveRefOwnerType()
  const ownerId = option('--owner-id')

  if (ownerId) {
    return Number(ownerId)
  }

  const ownerRef = option('--owner-ref')

  if (!ownerRef) {
    throw new Error('--owner-id or --owner-ref is required')
  }

  if (ownerType === 'effort') return getEffortByRef(database, ownerRef).id
  if (ownerType === 'plan') return resolveNumericOrShortRef(database, 'plans', ownerRef)
  if (ownerType === 'task') return getTaskByRef(database, ownerRef).id
  if (ownerType === 'review') return getReviewByRef(database, ownerRef).id

  throw new Error('unable to resolve owner id')
}

export function resolveInputTarget(database: AppDatabase): {
  effortId?: number | null
  taskId?: number | null
} {
  const effortRef = option('--effort')
  const taskRef = option('--task') ?? process.env.EFFORTLESS_TASK ?? null

  if (taskRef) {
    const task = getTaskByRef(database, taskRef)
    return { taskId: task.id }
  }

  if (effortRef) {
    const effort = getEffortByRef(database, effortRef)
    return { effortId: effort.id }
  }

  throw new Error('input request needs --effort or --task')
}
