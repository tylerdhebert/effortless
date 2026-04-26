import { createInputRequest, getInputRequestByRef } from '../../../core/inputs'
import { option, requiredOption, parseChoices } from '../args'
import { db, resolveInputTarget, wait } from '../context'
import { printInputRequest } from '../render'
import type { InputRequest } from '../../../core/types'

export async function handleInput(surface: string, command: string): Promise<boolean> {
  if (surface !== 'input') return false

  if (command === 'request') {
    const inputRequest = createInputRequest(db, {
      ...resolveInputTarget(db),
      agentId: requiredOption('--agent'),
      type: requiredOption('--type') as 'yesno' | 'choice' | 'text',
      prompt: requiredOption('--prompt'),
      choices: parseChoices(option('--choices')),
    })
    printInputRequest(inputRequest)
    await waitForInputRequest(inputRequest)
    return true
  }

  if (command === 'wait') {
    const inputRequest = getInputRequestByRef(db, requiredOption('--input'))
    await waitForInputRequest(inputRequest)
    return true
  }

  if (command === 'show') {
    const inputRequest = getInputRequestByRef(db, requiredOption('--input'))
    printInputRequest(inputRequest)
    return true
  }

  return false
}

async function waitForInputRequest(inputRequest: InputRequest): Promise<void> {
  const started = Date.now()
  let interrupted = false

  process.on('SIGINT', () => {
    interrupted = true
  })

  while (!interrupted) {
    const current = getInputRequestByRef(db, inputRequest.shortRef)

    if (current.status === 'answered') {
      if (current.answer) {
        console.log(current.answer)
      }
      return
    }

    const elapsed = Math.floor((Date.now() - started) / 1000)
    console.log(`waiting for human input, please wait - ${elapsed} seconds elapsed`)
    await wait(2000)
  }

  console.error('connection dropped while waiting for human approval')
  console.error(`reattach with: efl input wait --input ${inputRequest.shortRef}`)
  console.error('you must confirm human approval before ending turn')
  process.exitCode = 1
}