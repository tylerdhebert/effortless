import { createMandate, deleteMandate, getMandateByRef, listMandates, listMandatesBySurface, parseWorkSurface, resolveMandateText, updateMandate } from '../../../core/mandates'
import { getRepoByRef } from '../../../core/repos'
import type { MandateSourceType, UpdateMandateInput } from '../../../core/types'
import { option, requiredOption, bodyArg } from '../args'
import { db } from '../context'
import { printMandate } from '../render'

export async function handleMandate(surface: string, command: string): Promise<boolean> {
  if (surface !== 'mandate') return false

  if (command === 'list') {
    const surfaceOption = option('--surface')
    const surfaceFilter = surfaceOption ? parseWorkSurface(surfaceOption) : null
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
    const workSurface = parseWorkSurface(requiredOption('--surface'))
    const repoRef = option('--repo')
    const repo = repoRef ? getRepoByRef(db, repoRef) : null
    const sourceType = parseSourceType(option('--source-type') ?? 'body')

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
    const updates: Partial<Omit<UpdateMandateInput, 'mandateId'>> = {}

    const workSurface = option('--surface')
    if (workSurface) updates.workSurface = parseWorkSurface(workSurface)
    const repoRef = option('--repo')
    if (repoRef) {
      const repo = getRepoByRef(db, repoRef)
      updates.repoId = repo.id
    }
    const sourceType = option('--source-type')
    if (sourceType) updates.sourceType = parseSourceType(sourceType)
    const body = option('--body')
    if (body !== null) updates.body = body
    const filePath = option('--file')
    if (filePath !== null) updates.filePath = filePath

    const updated = updateMandate(db, {
      mandateId: mandate.id,
      ...updates,
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
    const workSurface = parseWorkSurface(requiredOption('--surface'))
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

function parseSourceType(value: string): MandateSourceType {
  if (value === 'body' || value === 'file') {
    return value
  }
  throw new Error('source type must be one of: body, file')
}
