import { createRepo, listRepos } from '../../../core/repos'
import { option, requiredOption } from '../args'
import { db } from '../context'
import { printRepo } from '../render'

export async function handleRepo(surface: string, command: string): Promise<boolean> {
  if (surface !== 'repo') return false

  if (command === 'create') {
    const repo = createRepo(db, {
      name: requiredOption('--name'),
      path: requiredOption('--path'),
      baseBranch: option('--base-branch') ?? 'main',
      buildCommand: option('--build-command'),
    })
    printRepo(repo)
    return true
  }

  if (command === 'list') {
    const repos = listRepos(db)

    if (repos.length === 0) {
      console.log('no repos')
      return true
    }

    for (const repo of repos) {
      printRepo(repo)
    }
    return true
  }

  return false
}