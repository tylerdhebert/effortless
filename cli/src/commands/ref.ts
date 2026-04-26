import { createReference, deleteReference, getReferenceByRef, listReferences } from '../../../core/references'
import { option, requiredOption } from '../args'
import { db, resolveRefOwnerId, resolveRefOwnerType } from '../context'
import { printReference } from '../render'

export async function handleRef(surface: string, command: string): Promise<boolean> {
  if (surface !== 'ref') return false

  if (command === 'add') {
    const ownerType = resolveRefOwnerType()
    const ownerId = resolveRefOwnerId(db)

    const targetType = requiredOption('--target-type') as 'effort' | 'plan' | 'task' | 'review' | 'file'
    const targetId = targetType !== 'file' && option('--target-id') ? Number(option('--target-id')) : null
    const filePath = targetType === 'file' ? option('--file') : null
    const label = option('--label')

    const reference = createReference(db, {
      ownerType,
      ownerId,
      targetType,
      targetId,
      filePath,
      label,
    })
    printReference(reference)
    return true
  }

  if (command === 'list') {
    const ownerType = resolveRefOwnerType()
    const ownerId = resolveRefOwnerId(db)
    const references = listReferences(db, ownerType, ownerId)

    if (references.length === 0) {
      console.log('no references')
      return true
    }

    for (const reference of references) {
      printReference(reference)
    }
    return true
  }

  if (command === 'remove') {
    const reference = getReferenceByRef(db, requiredOption('--ref'))
    deleteReference(db, reference.id)
    console.log(`${reference.shortRef} deleted`)
    return true
  }

  return false
}