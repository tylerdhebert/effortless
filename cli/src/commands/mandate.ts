import { createMandate, deleteMandate, getMandateByRef, listMandates, listMandatesBySurface, resolveMandateText, updateMandate } from '../../../core/mandates'
import { getRepoByRef } from '../../../core/repos'
import { option, requiredOption, bodyArg } from '../args'
import { db } from '../context'
import { printMandate } from '../render'

export async function handleMandate(surface: string, command: string): Promise<boolean> {
  if (surface !== 'mandate') return false

  if (command === 'list') {
    const surfaceFilter = option('--surface') as 'effort' | 'plan' | 'task' | 'review' | 'discussion' | null
    const repoRef = option('--repo')

    if (surfaceFilter) {
      const repo = repoRef ? getRepoByRef(db, repoRef) : null
      const mandates = listMandatesBySurface(db, surfaceFilter, repo?.id ?? null)
      for (const mandate of mandates) {
        printMandate(mandate)
      }
    } else {
      const mandates = listMandates(db)
      for (const mandate of mandates) {
        printMandate(mandate)
      }
    }
    return true
  }

  if (command === 'create') {
    const workSurface = requiredOption('--surface') as 'effort' | 'plan' | 'task' | 'review' | 'discussion'
    const repoRef = option('--repo')
    const repo = repoRef ? getRepoByRef(db, repoRef) : null
    const sourceType = (option('--source-type') ?? 'body') as 'body' | 'file'

    const mandate = createMandate(db, {
      workSurface,
      repoId: repo?.id ?? null,
      sourceType,
      body: sourceType === 'body' ? bodyArg() : null,
      filePath: sourceType === 'file' ? requiredOption('--file') : null,
    })
    printMandate(mandate)
    return true
  }

  if (command === 'update') {
    const mandate = getMandateByRef(db, requiredOption('--mandate'))
    const updates: Partial<{ workSurface: string; repoId: number | null; sourceType: string; body: string | null; filePath: string | null }> = {}

    const workSurface = option('--surface')
    if (workSurface) updates.workSurface = workSurface
    const repoRef = option('--repo')
    if (repoRef) {
      const repo = getRepoByRef(db, repoRef)
      updates.repoId = repo.id
    }
    const sourceType = option('--source-type')
    if (sourceType) updates.sourceType = sourceType
    const body = option('--body')
    if (body !== null) updates.body = body
    const filePath = option('--file')
    if (filePath !== null) updates.filePath = filePath

    const updated = updateMandate(db, {
      mandateId: mandate.id,
      ...updates as any,
    })
    printMandate(updated)
    return true
  }

  if (command === 'delete') {
    const mandate = getMandateByRef(db, requiredOption('--mandate'))
    deleteMandate(db, mandate.id)
    console.log(`${mandate.shortRef} deleted`)
    return true
  }

  if (command === 'resolve') {
    const workSurface = requiredOption('--surface') as 'effort' | 'plan' | 'task' | 'review' | 'discussion'
    const repoRef = option('--repo')
    const repo = repoRef ? getRepoByRef(db, repoRef) : null
    const text = resolveMandateText(db, workSurface, repo?.id ?? null)

    if (text) {
      console.log(text)
    } else {
      console.log('no mandate found')
    }
    return true
  }

  return false
}