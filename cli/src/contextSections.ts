import type { AppDatabase } from '../../core/db'
import { getEffort } from '../../core/efforts'
import { resolveMandate } from '../../core/mandates'
import { getPlanByRef } from '../../core/plans'
import { getReviewByRef } from '../../core/reviews'
import { getTask } from '../../core/tasks'
import { planState } from './render'
import type {
  Effort,
  EffortTemplate,
  PlanComment,
  Reference,
  TaskComment,
  WorkSurface,
} from '../../core/types'

const PREVIEW_LIMIT = 900

export function printSurfaceMandate(
  db: AppDatabase,
  surface: WorkSurface,
  repoId: number | null = null,
): void {
  const mandate = resolveMandate(db, surface, repoId)
  if (!mandate) return

  console.log('')
  console.log(`${surface} mandate (${mandate.source})`)
  console.log(mandate.text)
}

export function printRelatedMandates(
  db: AppDatabase,
  surfaces: WorkSurface[],
  repoId: number | null = null,
): void {
  const mandates = surfaces
    .map((surface) => ({ surface, resolved: resolveMandate(db, surface, repoId) }))
    .filter((entry) => entry.resolved != null)

  if (mandates.length === 0) return

  console.log('')
  console.log('related mandates')
  for (const { surface, resolved } of mandates) {
    console.log(`${surface} (${resolved!.source})`)
  }
}

export function printTemplateWorkflow(
  effort: Pick<Effort, 'template' | 'planRequiresReview' | 'needsTasks'>,
  counts: {
    plans?: number
    acceptedPlans?: number
    tasks?: number
    acceptedTasks?: number
    mergedTasks?: number
    discussionMessages?: number
  } = {},
): void {
  const workflow = templateWorkflow(effort.template)

  console.log('')
  console.log('template workflow')
  for (const line of workflow) {
    console.log(line)
  }

  console.log('')
  console.log('required pieces')
  console.log(`plan: ${pieceState(requiresPlan(effort.template), counts.acceptedPlans ?? 0, counts.plans ?? 0)}`)
  console.log(`tasks: ${pieceState(effort.needsTasks, (counts.acceptedTasks ?? 0) + (counts.mergedTasks ?? 0), counts.tasks ?? 0)}`)
  console.log(`discussion: ${discussionState(effort.template, counts.discussionMessages ?? 0)}`)
  console.log(`plan human approval req: ${effort.planRequiresReview ? 'on' : 'off'}`)
}

export function printLatestUpdate(
  updates: Array<{
    id?: number
    author: string
    agentId?: string | null
    kind?: string
    body: string
    createdAt: string
  }>,
): void {
  const nonApprovalUpdates = updates.filter((update) => update.kind !== 'approval')
  const source = nonApprovalUpdates.length > 0 ? nonApprovalUpdates : updates
  const latest = source
    .filter((update) => update.body.trim())
    .sort((a, b) => {
      const timeDelta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (timeDelta !== 0) return timeDelta
      return (b.id ?? 0) - (a.id ?? 0)
    })[0]

  if (!latest) return

  printSection('latest update')
  console.log(`[${latest.agentId ?? latest.author}] ${latest.body}`)
  endSection('latest update')
}

export function printHandoffSummary(summary: string | null | undefined): void {
  if (!summary) return
  printSection('handoff summary')
  console.log(summary)
  endSection('handoff summary')
}

export function printArtifactPreview(
  artifact: string | null | undefined,
  fullCommand: string,
  title = 'artifact',
): void {
  if (!artifact) return
  printSection(title)
  console.log(preview(artifact))
  if (artifact.length > PREVIEW_LIMIT) {
    console.log(`...(truncated - run '${fullCommand}' to read full)`)
  }
  endSection(title)
}

export function printExpandedReferences(db: AppDatabase, references: Reference[]): void {
  if (references.length === 0) return

  printSection('references')
  for (const reference of references) {
    printExpandedReference(db, reference)
  }
  endSection('references')
}

export function printComments(
  comments: Array<Pick<TaskComment | PlanComment, 'author' | 'agentId' | 'body'> & { kind: string }>,
): void {
  if (comments.length === 0) return

  printSection('comments')
  for (const comment of comments) {
    console.log(`[${comment.agentId ?? comment.author}] ${comment.kind}: ${comment.body}`)
  }
  endSection('comments')
}

export function printSection(title: string): void {
  console.log('')
  console.log(`--- ${title.toUpperCase()} ---`)
}

export function endSection(title: string): void {
  console.log(`--- END ${title.toUpperCase()} ---`)
}

function templateWorkflow(template: EffortTemplate): string[] {
  switch (template) {
    case 'delivery':
      return [
        '1. align through discussion when needed',
        '2. produce and accept one plan',
        '3. create implementation tasks from the accepted plan',
        '4. complete task work, reviews, conflict checks, and merges',
        '5. write the effort summary and complete the effort',
      ]
    case 'bugfix':
      return [
        '1. identify the defect and expected behavior',
        '2. complete the implementation task',
        '3. run the repo build when configured',
        '4. complete review, conflict check, and merge',
        '5. summarize the fix and complete the effort',
      ]
    case 'investigation':
      return [
        '1. gather context and references',
        '2. discuss unclear findings or decisions',
        '3. capture the investigation result in the plan/summary surfaces',
        '4. complete the effort when the answer is clear',
      ]
    case 'discussion':
      return [
        '1. use discussion as the primary working surface',
        '2. capture decisions, open questions, and follow-ups',
        '3. summarize the outcome and complete the effort',
      ]
  }
}

function requiresPlan(template: EffortTemplate): boolean {
  return template === 'delivery' || template === 'investigation'
}

function pieceState(required: boolean, completed: number, total: number): string {
  if (!required) return 'optional'
  if (completed > 0) return `satisfied (${completed}/${Math.max(total, completed)})`
  if (total > 0) return `pending approval (${total} submitted)`
  return 'required'
}

function discussionState(template: EffortTemplate, messages: number): string {
  if (template === 'discussion') {
    return messages > 0 ? `active (${messages} messages)` : 'required'
  }

  if (template === 'delivery' || template === 'investigation') {
    return messages > 0 ? `available (${messages} messages)` : 'available'
  }

  return messages > 0 ? `available (${messages} messages)` : 'optional'
}

function printExpandedReference(db: AppDatabase, reference: Reference): void {
  const label = reference.label ? ` (${reference.label})` : ''

  if (reference.targetType === 'file') {
    console.log(`[${reference.shortRef}] file${label}`)
    if (reference.filePath) console.log(`  file: ${reference.filePath}`)
    return
  }

  if (!reference.targetId) {
    console.log(`[${reference.shortRef}] ${reference.targetType}${label}`)
    return
  }

  if (reference.targetType === 'effort') {
    const effort = getEffort(db, reference.targetId)
    console.log(`[${effort.shortRef}] ${effort.title} (effort${label})`)
    console.log(`  status: ${effort.status}`)
    console.log(`  template: ${effort.template}`)
    if (effort.summary) printIndentedPreview('summary', effort.summary)
    return
  }

  if (reference.targetType === 'plan') {
    const plan = getPlanByRef(db, String(reference.targetId))
    console.log(`[${plan.shortRef}] ${planState(plan)} plan${label}`)
    if (plan.summary) printIndentedPreview('handoff', plan.summary)
    else printIndentedPreview('body', plan.body)
    return
  }

  if (reference.targetType === 'task') {
    const task = getTask(db, reference.targetId)
    console.log(`[${task.shortRef}] ${task.title} (task${label})`)
    console.log(`  status: ${task.status}`)
    if (task.branchName) console.log(`  branch: ${task.branchName}`)
    if (task.handoffSummary) printIndentedPreview('handoff', task.handoffSummary)
    return
  }

  if (reference.targetType === 'review') {
    const review = getReviewByRef(db, String(reference.targetId))
    console.log(`[${review.shortRef}] ${review.verdict} review${label}`)
    console.log(`  status: ${review.appliedAt ? 'applied' : 'pending'}`)
    if (review.summary) printIndentedPreview('handoff', review.summary)
    else printIndentedPreview('body', review.body)
  }
}

function printIndentedPreview(label: string, text: string): void {
  console.log(`  ${label}:`)
  const limit = 420
  for (const line of preview(text, limit).split('\n')) {
    console.log(`  ${line}`)
  }
  if (text.trim().length > limit) {
    console.log('  ...(truncated)')
  }
}

function preview(text: string, limit = PREVIEW_LIMIT): string {
  const trimmed = text.trim()
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit).trimEnd()}`
}
