import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { DEFAULT_TEMPLATE_PLAYBOOKS } from './defaultTemplatePlaybooks'
import type { EffortTemplate, TemplatePlaybook, UpdateTemplatePlaybookInput } from './types'

const TEMPLATE_ORDER: Record<EffortTemplate, number> = {
  bugfix: 0,
  delivery: 1,
  investigation: 2,
}

type TemplatePlaybookRow = {
  template: string
  body: string
  updated_at: string
}

export function listTemplatePlaybooks(db: AppDatabase): TemplatePlaybook[] {
  return db
    .prepare<TemplatePlaybookRow>(`
      SELECT template, body, updated_at
      FROM template_playbooks
      WHERE template IN ('bugfix', 'delivery', 'investigation')
    `)
    .all()
    .map(mapTemplatePlaybook)
    .sort((left, right) => TEMPLATE_ORDER[left.template] - TEMPLATE_ORDER[right.template])
}

export function getTemplatePlaybook(db: AppDatabase, template: EffortTemplate): TemplatePlaybook {
  const row = db
    .prepare<TemplatePlaybookRow>(`SELECT template, body, updated_at FROM template_playbooks WHERE template = ?`)
    .get(template)

  if (!row) {
    throw new Error(`Template playbook ${template} was not found`)
  }

  return mapTemplatePlaybook(row)
}

export function updateTemplatePlaybook(
  db: AppDatabase,
  input: UpdateTemplatePlaybookInput,
): TemplatePlaybook {
  getTemplatePlaybook(db, input.template)

  db.prepare(`
    UPDATE template_playbooks
    SET body = ?,
        updated_at = ?
    WHERE template = ?
  `).run(input.body, new Date().toISOString(), input.template)

  bumpAppState(db)
  return getTemplatePlaybook(db, input.template)
}

export function resetTemplatePlaybook(db: AppDatabase, template: EffortTemplate): TemplatePlaybook {
  getTemplatePlaybook(db, template)
  const defaultPlaybook = DEFAULT_TEMPLATE_PLAYBOOKS.find((playbook) => playbook.template === template)
  if (!defaultPlaybook) {
    throw new Error(`Default template playbook ${template} was not found`)
  }

  db.prepare(`
    UPDATE template_playbooks
    SET body = ?,
        updated_at = ?
    WHERE template = ?
  `).run(defaultPlaybook.body, new Date().toISOString(), template)

  bumpAppState(db)
  return getTemplatePlaybook(db, template)
}

function mapTemplatePlaybook(row: TemplatePlaybookRow): TemplatePlaybook {
  return {
    template: row.template as EffortTemplate,
    body: row.body,
    updatedAt: row.updated_at,
  }
}
