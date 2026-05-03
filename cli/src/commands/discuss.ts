import {
  createDiscussionMessage,
  listDiscussionMessages,
} from '../../../core/discussion'
import { bodyArg, requiredOption } from '../args'
import { db, wait } from '../context'
import {
  printComments,
  printExpandedReferences,
  printLatestUpdate,
  printRelatedMandates,
  printSurfaceMandate,
} from '../contextSections'

export async function handleDiscuss(surface: string, command: string): Promise<boolean> {
  if (surface !== 'discuss') return false

  if (command === 'say') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const message = createDiscussionMessage(db, {
      effortId: effort.id,
      author: 'agent',
      agentId: requiredOption('--agent'),
      body: bodyArg(),
    })
    printDiscussionMessage(message)
    return true
  }

  if (command === 'history') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const messages = [...listDiscussionMessages(db, effort.id)].reverse()

    if (messages.length === 0) {
      console.log('no discussion')
      return true
    }

    for (const message of messages) {
      printDiscussionMessage(message)
    }
    return true
  }

  if (command === 'listen') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    const latestSeenId = listDiscussionMessages(db, effort.id)[0]?.id ?? 0
    await waitForNextUserMessage(effort.id, latestSeenId)
    return true
  }

  if (command === 'context') {
    const { getEffortByRef } = await import('../../../core/efforts')
    const effort = getEffortByRef(db, requiredOption('--effort'))
    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    printSurfaceMandate(db, 'discussion')
    printRelatedMandates(db, ['effort', 'plan', 'task', 'review'])
    console.log('')
    console.log('description')
    console.log(effort.description)

    const messages = listDiscussionMessages(db, effort.id)
    printLatestUpdate(messages)
    if (messages.length > 0) {
      console.log('')
      console.log('discussion')
      for (const message of messages) {
        console.log(`${message.author}${message.agentId ? `:${message.agentId}` : ''} ${message.createdAt}`)
        console.log(message.body)
      }
    }

    const { listReferences } = await import('../../../core/references')
    printExpandedReferences(db, listReferences(db, 'effort', effort.id))
    printComments(messages.map((message) => ({
      author: message.author,
      agentId: message.agentId,
      kind: 'comment' as const,
      body: message.body,
    })))

    return true
  }

  return false
}

async function waitForNextUserMessage(effortId: number, latestSeenId: number): Promise<void> {
  const started = Date.now()
  let interrupted = false

  process.on('SIGINT', () => {
    interrupted = true
  })

  while (!interrupted) {
    const nextMessage = [...listDiscussionMessages(db, effortId)]
      .reverse()
      .find((message) => message.id > latestSeenId && message.author === 'user')

    if (nextMessage) {
      console.log(nextMessage.body)
      return
    }

    const elapsed = Math.floor((Date.now() - started) / 1000)
    console.log(`waiting for human input, please wait - ${elapsed} seconds elapsed`)
    await wait(2000)
  }

  console.error('connection dropped while waiting for human discussion')
  console.error(`reattach with: efl discuss listen --effort eff-${effortId}`)
  console.error('you must confirm human input before ending turn')
  process.exitCode = 1
}

function printDiscussionMessage(message: {
  author: string
  agentId: string | null
  body: string
  createdAt: string
}): void {
  console.log(`${message.author}${message.agentId ? `:${message.agentId}` : ''} ${message.createdAt}`)
  console.log(message.body)
}
