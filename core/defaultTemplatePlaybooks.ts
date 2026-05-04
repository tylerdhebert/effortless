import type { EffortTemplate } from './types'

export const DEFAULT_TEMPLATE_PLAYBOOKS: Array<{ template: EffortTemplate; body: string }> = [
  {
    template: 'bugfix',
    body: `# Bugfix Playbook

## Composition

- Implementation tasks
- Implementation reviews

## Flow

1. Start by creating the implementation task.
2. When the implementer finishes, dispatch an implementation review.
3. If the review requests changes, return the same task and branch to the implementer.
4. After the implementer updates the task, dispatch review again.
5. Repeat the implement -> review loop until the review approves the task.
6. When the review approves the task, treat the task as complete and let merge/conflict handling proceed.

## Communication

- Do not use discussion for bugfix efforts.
- If human input is required, use efl input on the effort, task, or review surface.

## Completion

- Run the repo build before handoff when a build command exists.
- Finish with a short bugfix summary on the effort.`,
  },
  {
    template: 'delivery',
    body: `# Delivery Playbook

## Composition

- Discussion
- One accepted plan
- Implementation tasks
- Implementation reviews

## Flow

1. Use discussion when requirements, sequencing, or tradeoffs need clarification.
2. Dispatch a plan agent on the effort.
3. Move forward only after one plan is accepted.
4. Create implementation tasks from the accepted plan.
5. Attach the accepted plan as a reference on each task it drives.
6. Dispatch implementers on the created tasks.
7. When an implementer finishes and review is required, dispatch a reviewer on that task.
8. If review requests changes, dispatch the same task and branch back to the implementer.
9. After the implementer updates the task, dispatch review again.
10. Repeat the implement -> review loop until the task is approved.
11. When a task is approved, treat the task as complete and let merge/conflict handling proceed.
12. Complete the effort after the required tasks have reached their truthful done state and the effort summary is written.

## Communication

- Use discussion for effort-level clarification and decisions.
- Use efl input when a blocking human decision is needed on the effort, task, or review surface.

## Completion

- Keep the effort summary aligned with the accepted plan and the final state of the implementation tasks.
- Finish with a concise summary of what shipped, what was merged, and any notable follow-up.`,
  },
  {
    template: 'investigation',
    body: `# Investigation Playbook

## Composition

- Discussion
- Investigation plans

## Flow

1. Use discussion when the question, scope, or evaluation criteria need clarification.
2. Dispatch an investigation agent on the effort.
3. Let that agent gather context, evidence, and findings on the plan surface.
4. If the investigation surfaces ambiguity that requires human direction, use discussion or efl input before continuing.
5. Repeat the investigate -> clarify loop until the answer is clear enough to summarize.
6. Complete the effort after the findings are documented and the effort summary is written.

## Communication

- Use discussion for effort-level clarification and interpretation.
- Use efl input when a blocking human decision is needed on the effort or plan surface.
- Do not create implementation tasks as part of an investigation effort.`,
  },
  {
    template: 'discussion',
    body: `# Discussion Playbook

## Composition

- Discussion

## Flow

1. Start in discussion and keep the conversation focused on the current decision or clarification.
2. Dispatch a discussion agent when sustained back-and-forth is needed.
3. Continue the discussion until the human has provided enough direction or the decision has stabilized.
4. If a concrete answer is required, use efl input on the effort surface.
5. Repeat the discuss -> clarify loop until the discussion has reached a stable conclusion.
6. Complete the effort after the recap or summary is written.

## Communication

- Keep the work on the discussion surface.
- Do not create plans or tasks as part of a discussion effort.
- Leave a recap that another agent or the user can pick up quickly later.`,
  },
]
