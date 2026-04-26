import { spawn } from 'node:child_process'
import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { getRepo } from './repos'
import { getTask } from './tasks'
import type { BuildStatus, TaskBuildResult } from './types'

type TaskBuildResultRow = {
  id: number
  short_ref: string
  task_id: number
  status: BuildStatus
  output: string
  triggered_at: string
  completed_at: string | null
}

export async function runTaskBuild(db: AppDatabase, taskId: number): Promise<TaskBuildResult> {
  const task = getTask(db, taskId)

  if (!task.repoId || !task.worktreePath) {
    throw new Error('Task needs a repo and worktree before running a build')
  }

  const repo = getRepo(db, task.repoId)

  if (!repo.buildCommand) {
    throw new Error('Repo does not have a build command')
  }

  const now = new Date().toISOString()
  const insert = db
    .prepare(
      `
      INSERT INTO task_build_results (task_id, status, output, triggered_at, completed_at)
      VALUES (?, 'running', '', ?, NULL)
    `,
    )
    .run(taskId, now)

  const id = Number(insert.lastInsertRowid)
  db.prepare(`UPDATE task_build_results SET short_ref = ? WHERE id = ?`).run(`build-${id}`, id)
  bumpAppState(db)

  let output = ''
  let status: BuildStatus = 'passed'

  try {
    const result = await runBuildCommand(repo.buildCommand, task.worktreePath)
    output = result.output
    if (result.exitCode !== 0) {
      status = 'failed'
    }
  } catch (error) {
    status = 'failed'
    output = error instanceof Error ? error.message : String(error)
  }

  db.prepare(
    `
    UPDATE task_build_results
    SET status = ?,
        output = ?,
        completed_at = ?
    WHERE id = ?
  `,
  ).run(status, output, new Date().toISOString(), id)
  bumpAppState(db)

  return getBuildResult(db, id)
}

export function getLatestTaskBuild(db: AppDatabase, taskId: number): TaskBuildResult | null {
  const row = db
    .prepare<TaskBuildResultRow>(
      `
      SELECT * FROM task_build_results
      WHERE task_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    )
    .get(taskId)

  return row ? mapBuildResult(row) : null
}

function getBuildResult(db: AppDatabase, id: number): TaskBuildResult {
  const row = db.prepare<TaskBuildResultRow>(`SELECT * FROM task_build_results WHERE id = ?`).get(id)

  if (!row) {
    throw new Error(`Build result ${id} was not found`)
  }

  return mapBuildResult(row)
}

function mapBuildResult(row: TaskBuildResultRow): TaskBuildResult {
  return {
    id: row.id,
    shortRef: row.short_ref,
    taskId: row.task_id,
    status: row.status,
    output: row.output,
    triggeredAt: row.triggered_at,
    completedAt: row.completed_at,
  }
}

function runBuildCommand(command: string, cwd: string): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === 'win32'
        ? spawn('powershell', ['-NoProfile', '-Command', command], { cwd, windowsHide: true })
        : spawn('bash', ['-lc', command], { cwd })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        output: `${stdout}${stderr}`,
      })
    })
  })
}
