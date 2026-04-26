import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export function worktreePath(repoPath: string, branchName: string): string {
  return path.join(repoPath, '..', '.git-worktrees', branchName)
}

export async function worktreeCreate(
  repoPath: string,
  branchName: string,
  baseBranch: string,
): Promise<string> {
  const wtPath = worktreePath(repoPath, branchName)
  fs.mkdirSync(path.dirname(wtPath), { recursive: true })

  const existingBranches = await git(repoPath, ['branch', '--list', branchName])

  if (existingBranches.trim()) {
    await git(repoPath, ['worktree', 'add', wtPath, branchName])
  } else {
    await git(repoPath, ['worktree', 'add', '-b', branchName, wtPath, baseBranch])
  }

  return wtPath
}

export async function getHeadCommit(worktreeOrRepoPath: string): Promise<string> {
  return (await git(worktreeOrRepoPath, ['rev-parse', 'HEAD'])).trim()
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], { windowsHide: true })
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}
