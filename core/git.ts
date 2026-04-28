import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export type DiffType = 'uncommitted' | 'branch' | 'combined'
export type ConflictResult =
  | { hasConflicts: false }
  | { hasConflicts: true; details: string; files: string[] }

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

export async function getDiff(
  repoPath: string,
  branchName: string,
  baseBranch: string,
  type: DiffType,
): Promise<string> {
  const wtPath = worktreePath(repoPath, branchName)

  switch (type) {
    case 'uncommitted':
      return git(wtPath, ['diff', 'HEAD'])
    case 'branch':
      return git(repoPath, ['diff', `${baseBranch}..${branchName}`])
    case 'combined':
      return git(wtPath, ['diff', baseBranch])
  }
}

export async function getCommits(
  repoPath: string,
  branchName: string,
  baseBranch: string,
): Promise<string> {
  return git(repoPath, ['log', '--oneline', `${baseBranch}..${branchName}`])
}

export async function checkConflicts(
  repoPath: string,
  branchName: string,
  baseBranch: string,
): Promise<ConflictResult> {
  const base = (await git(repoPath, ['merge-base', baseBranch, branchName])).trim()
  const mergeTreeOutput = await git(repoPath, ['merge-tree', base, baseBranch, branchName])

  if (!mergeTreeOutput.includes('<<<<<<<') && !mergeTreeOutput.includes('CONFLICT')) {
    return { hasConflicts: false }
  }

  const files = new Set<string>()
  for (const line of mergeTreeOutput.split('\n')) {
    const mergeMatch = line.match(/Merge conflict in (.+)$/)
    if (mergeMatch) {
      files.add(mergeMatch[1])
      continue
    }

    const conflictMatch = line.match(/CONFLICT.*? in (.+)$/)
    if (conflictMatch) {
      files.add(conflictMatch[1])
    }
  }

  return { hasConflicts: true, details: mergeTreeOutput, files: [...files] }
}

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], { windowsHide: true })
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}
