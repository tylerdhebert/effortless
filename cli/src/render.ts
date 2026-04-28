import type { InputRequest, Mandate, Plan, Reference, Repo, Review, Task } from '../../core/types'
import type { runTaskBuild } from '../../core/builds'

export function printTask(task: Task): void {
  console.log(`${task.shortRef} ${task.status}`)
  if (task.ownerAgentId) {
    console.log(`owner ${task.ownerAgentId}`)
  }
  if (task.branchName) {
    console.log(`branch ${task.branchName}`)
  }
  if (task.worktreePath) {
    console.log(`worktree ${task.worktreePath}`)
  }
}

export function printPlan(plan: Plan): void {
  console.log(`${plan.shortRef} ${planState(plan)}`)
  if (plan.authorAgentId) {
    console.log(`author ${plan.authorAgentId}`)
  }
}

export function printReview(review: Review): void {
  console.log(`${review.shortRef} ${review.verdict} ${review.appliedAt ? 'applied' : 'pending'}`)
  console.log(`task ${review.taskId}`)
  if (review.authorAgentId) {
    console.log(`author ${review.authorAgentId}`)
  }
}

export function printRepo(repo: Repo): void {
  console.log(`${repo.shortRef} ${repo.name}`)
  console.log(`path ${repo.path}`)
  console.log(`base ${repo.baseBranch}`)
  if (repo.buildCommand) {
    console.log(`build ${repo.buildCommand}`)
  }
}

export function printBuild(build: Awaited<ReturnType<typeof runTaskBuild>>): void {
  console.log(`${build.shortRef} ${build.status}`)
  console.log(`task ${build.taskId}`)
  if (build.output) {
    console.log(build.output)
  }
}

export function printInputRequest(inputRequest: InputRequest): void {
  console.log(`${inputRequest.shortRef} ${inputRequest.status}`)
  console.log(`type ${inputRequest.type}`)
  console.log(inputRequest.prompt)
  if (inputRequest.answer) {
    console.log(`answer ${inputRequest.answer}`)
  }
}

export function printMandate(mandate: Mandate): void {
  console.log(`${mandate.shortRef} ${mandate.workSurface}`)
  if (mandate.repoId) {
    console.log(`repo ${mandate.repoId}`)
  } else {
    console.log('global')
  }
  console.log(`source ${mandate.sourceType}`)
  if (mandate.sourceType === 'body' && mandate.body) {
    console.log(mandate.body.length > 200 ? mandate.body.slice(0, 200) + '...' : mandate.body)
  } else if (mandate.sourceType === 'file' && mandate.filePath) {
    console.log(mandate.filePath)
  }
}

export function printReference(reference: Reference): void {
  console.log(`${reference.shortRef} ${reference.ownerType}-${reference.ownerId} -> ${reference.targetType}${reference.targetId ? `-${reference.targetId}` : ''}`)
  if (reference.filePath) {
    console.log(`file ${reference.filePath}`)
  }
  if (reference.label) {
    console.log(`label ${reference.label}`)
  }
}

export function printHelp(): void {
  console.log('efl effort create --title "title" --description "description" [--template bugfix|delivery|investigation|discussion]')
  console.log('efl effort list')
  console.log('efl effort show --effort eff-1')
  console.log('efl effort context --effort eff-1')
  console.log('efl effort complete --effort eff-1')
  console.log('efl plan submit --effort eff-1 --agent planner-1 --body "plan here"')
  console.log('efl plan list --effort eff-1')
  console.log('efl plan show --plan plan-1')
  console.log('efl plan ready --plan plan-1')
  console.log('efl plan wait --plan plan-1')
  console.log(
    'efl task create --effort eff-1 --title "title" --description "description" --repo repo-1 --branch agent/task',
  )
  console.log('efl task claim --task task-1 --agent impl-1')
  console.log('efl task list --effort eff-1')
  console.log('efl task show --task task-1')
  console.log('efl task plan --task task-1 --agent impl-1 --body "implementation plan"')
  console.log('efl task checkpoint --task task-1 --agent impl-1 --body "message"')
  console.log('efl task artifact --task task-1 --agent impl-1 --body "artifact summary"')
  console.log('efl task ready --task task-1')
  console.log('efl task wait --task task-1')
  console.log('efl task worktree --task task-1')
  console.log('efl review submit --task task-1 --agent rev-1 --verdict approve --body "message"')
  console.log('efl review list --task task-1')
  console.log('efl review show --review rev-1')
  console.log('efl review ready --review rev-1')
  console.log('efl review wait --review rev-1')
  console.log('efl discuss say --effort eff-1 --agent planner-1 --body "message"')
  console.log('efl discuss history --effort eff-1')
  console.log('efl discuss listen --effort eff-1')
  console.log('efl repo create --name ui --path C:\\repo\\ui --base-branch main --build-command "bun run build"')
  console.log('efl repo list')
  console.log('efl build run --task task-1')
  console.log('efl build status --task task-1')
  console.log('efl input request --task task-1 --agent impl-1 --type text --prompt "What copy should this use?"')
  console.log('efl input wait --input input-1')
  console.log('efl input show --input input-1')
  console.log('efl mandate list [--surface task] [--repo repo-1]')
  console.log('efl mandate create --surface task --body "instructions" [--repo repo-1]')
  console.log('efl mandate create --surface task --source-type file --file /path/instructions.md [--repo repo-1]')
  console.log('efl mandate update --mandate mandate-1 [--surface task] [--body "updated"] [--file /path/new.md]')
  console.log('efl mandate delete --mandate mandate-1')
  console.log('efl mandate resolve --surface task [--repo repo-1]')
  console.log('efl ref add --owner-type effort --owner-ref eff-1 --target-type file --file /path/notes.md --label "notes"')
  console.log('efl ref add --owner-type task --owner-ref task-1 --target-type plan --target-id 2 --label "accepted plan"')
  console.log('efl ref list --owner-type effort --owner-ref eff-1')
  console.log('efl ref remove --ref ref-1')
}

export function planState(plan: Plan): string {
  if (plan.accepted) {
    return 'accepted'
  }

  if (plan.readyAt) {
    if (
      plan.latestFeedbackAt &&
      new Date(plan.latestFeedbackAt).getTime() >= new Date(plan.readyAt).getTime()
    ) {
      return 'changes-requested'
    }

    return 'waiting'
  }

  return 'draft'
}
