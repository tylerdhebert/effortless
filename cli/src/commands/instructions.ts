import { deleteInstructions, listInstructions, resolveInstructionsText, setInstructions } from '../../../core/instructions'
import { getRepoByRef } from '../../../core/repos'
import type { Instructions } from '../../../core/types'
import { bodyArg, option } from '../args'
import { db } from '../context'

export async function handleInstructions(surface: string, command: string): Promise<boolean> {
  if (surface !== 'instructions') return false

  if (command === 'show') {
    const repoRef = option('--repo')
    const repo = repoRef ? getRepoByRef(db, repoRef) : null
    const text = resolveInstructionsText(db, repo?.id ?? null)
    if (text) {
      console.log(text)
    } else {
      console.log('no instructions found')
    }
    return true
  }

  if (command === 'set') {
    const repoRef = option('--repo')
    const repo = repoRef ? getRepoByRef(db, repoRef) : null
    const filePath = option('--file')
    const instructions = setInstructions(db, {
      repoId: repo?.id ?? null,
      sourceType: filePath ? 'file' : 'body',
      body: filePath ? null : bodyArg(),
      filePath: filePath ?? null,
    })
    printInstructionsScope(instructions)
    return true
  }

  if (command === 'clear') {
    const repoRef = option('--repo')
    const repo = repoRef ? getRepoByRef(db, repoRef) : null
    const instructions = listInstructions(db).find((candidate) =>
      repo ? candidate.repoId === repo.id : candidate.repoId == null,
    )
    if (!instructions) {
      console.log('no instructions configured')
      return true
    }
    deleteInstructions(db, instructions.id)
    console.log(`${instructions.shortRef} cleared`)
    return true
  }

  if (command === 'list') {
    const instructions = listInstructions(db)
    if (instructions.length === 0) {
      console.log('no instructions')
      return true
    }
    for (const entry of instructions) {
      printInstructionsScope(entry)
    }
    return true
  }

  return false
}

function printInstructionsScope(instructions: Instructions): void {
  console.log(`${instructions.shortRef} ${instructions.repoId == null ? 'global' : `repo ${instructions.repoId}`}`)
  console.log(`source ${instructions.sourceType}`)
  if (instructions.sourceType === 'file' && instructions.filePath) {
    console.log(instructions.filePath)
  }
  if (instructions.sourceType === 'body' && instructions.body) {
    const preview = instructions.body.split('\n')[0].slice(0, 80)
    console.log(preview)
  }
}
