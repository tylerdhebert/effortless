import { createEffort, getEffortByRef, listEfforts } from '../../../core/efforts'
import { option, requiredOption } from '../args'
import { db } from '../context'

export async function handleEffort(surface: string, command: string): Promise<boolean> {
  if (surface !== 'effort') return false

  if (command === 'create') {
    const template = (option('--template') ?? 'bugfix') as 'bugfix' | 'delivery' | 'investigation' | 'discussion'
    const effort = createEffort(db, {
      title: requiredOption('--title'),
      description: requiredOption('--description'),
      template,
    })
    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    return true
  }

  if (command === 'list') {
    const efforts = listEfforts(db)

    if (efforts.length === 0) {
      console.log('no efforts')
      return true
    }

    for (const effort of efforts) {
      console.log(`${effort.shortRef} ${effort.template} ${effort.status} ${effort.title}`)
    }
    return true
  }

  if (command === 'show') {
    const effort = getEffortByRef(db, requiredOption('--effort'))
    console.log(`${effort.shortRef} ${effort.template} ${effort.status}`)
    console.log(effort.title)
    console.log(effort.description)
    return true
  }

  console.log('effort commands: create, list, show')
  console.log('planned: context, summary, complete')
  return true
}