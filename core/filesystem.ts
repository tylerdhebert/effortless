import fs from 'node:fs'
import path from 'node:path'

export type BrowsePathResult = {
  path: string
  sep: string
  parent: string | null
  entries: Array<{ name: string; isDir: boolean }>
}

export function browsePath(targetPath?: string | null, includeFiles = false): BrowsePathResult {
  const target = targetPath || (process.platform === 'win32' ? 'C:\\' : '/')
  const resolved = path.resolve(target)

  let entries: BrowsePathResult['entries'] = []
  try {
    entries = fs
      .readdirSync(resolved, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || (includeFiles && entry.isFile()))
      .map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  } catch {
    entries = []
  }

  return {
    path: resolved,
    sep: path.sep,
    parent: path.dirname(resolved) !== resolved ? path.dirname(resolved) : null,
    entries,
  }
}
