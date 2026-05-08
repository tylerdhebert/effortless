import { getTemplatePlaybook, listTemplatePlaybooks, resetTemplatePlaybook, updateTemplatePlaybook } from '../../../core/templatePlaybooks'
import type { EffortTemplate } from '../../../core/types'
import { bodyArg, requiredOption } from '../args'
import { db } from '../context'

const TEMPLATES: EffortTemplate[] = ['bugfix', 'delivery', 'investigation']

export async function handlePlaybook(surface: string, command: string): Promise<boolean> {
  if (surface !== 'playbook') return false

  if (command === 'list') {
    const playbooks = listTemplatePlaybooks(db)

    if (playbooks.length === 0) {
      console.log('no playbooks')
      return true
    }

    for (const playbook of playbooks) {
      console.log(`${playbook.template} updated ${playbook.updatedAt}`)
    }
    return true
  }

  if (command === 'show') {
    const template = requiredTemplate()
    const playbook = getTemplatePlaybook(db, template)
    console.log(`template playbook (${playbook.template})`)
    console.log(playbook.body)
    return true
  }

  if (command === 'update') {
    const template = requiredTemplate()
    updateTemplatePlaybook(db, {
      template,
      body: bodyArg(),
    })
    console.log(`${template} playbook updated`)
    return true
  }

  if (command === 'reset') {
    const template = requiredTemplate()
    resetTemplatePlaybook(db, template)
    console.log(`${template} playbook reset`)
    return true
  }

  console.log('playbook commands: list, show, update, reset')
  return true
}

function requiredTemplate(): EffortTemplate {
  const template = requiredOption('--template')
  if (!TEMPLATES.includes(template as EffortTemplate)) {
    throw new Error('--template must be bugfix, delivery, or investigation')
  }
  return template as EffortTemplate
}
