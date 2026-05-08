import type { EffortTemplate } from './types'

export const DEFAULT_TEMPLATE_PLAYBOOKS: Array<{ template: EffortTemplate; body: string }> = [
  {
    template: 'bugfix',
    body: `# Bugfix Playbook

## Composition

- One implementation task
- Optional independent review

## Flow

1. Start by creating or selecting the implementation task.
2. The active agent implements the task directly by default.
3. Use input requests for blocking human decisions.
4. Use checkpoints and the task artifact for durable progress and handoff.
5. Run the repo build before handoff when a build command exists.
6. Use independent review when risk justifies a separate read-only assessment.
7. When review approves or human approval is complete, treat the task as ready for merge/conflict handling.

## Completion

- Finish with a short bugfix summary on the effort.`,
  },
  {
    template: 'delivery',
    body: `# Delivery Playbook

## Composition

- One accepted plan when planning is useful or required
- Implementation tasks
- Optional independent reviews

## Flow

1. The active agent reads effort context and decides whether a plan is useful.
2. If a plan is needed, submit it and use the plan approval gate when enabled.
3. Create implementation tasks only for separable work.
4. The active agent implements the next task directly by default.
5. Launch side runs only for bounded investigation, disjoint implementation, or independent review.
6. Use input requests for blocking human decisions.
7. Use task checkpoints and artifacts for durable handoff.
8. Use builds, diffs, conflicts, and reviews before merge.
9. Complete the effort after required tasks reach their truthful done state and the effort summary is written.

## Completion

- Keep the effort summary aligned with the accepted plan and final task states.
- Finish with a concise summary of what shipped, what was merged, and any notable follow-up.`,
  },
  {
    template: 'investigation',
    body: `# Investigation Playbook

## Composition

- One or more investigation plans or findings artifacts
- Optional input requests for blocking questions

## Flow

1. The active agent reads effort context and gathers evidence.
2. Use a plan or findings artifact to preserve conclusions, assumptions, risks, and recommended next steps.
3. Use input requests when a blocking human decision is needed.
4. Launch side runs only for bounded parallel research questions.
5. Complete the effort after the findings are documented and the effort summary is written.

## Completion

- Finish with a concise findings summary that another agent or the user can pick up quickly.`,
  },
]
