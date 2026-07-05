type HelpDomain =
  | 'root'
  | 'effort'
  | 'task'
  | 'plan'
  | 'review'
  | 'run'
  | 'session'
  | 'resume'
  | 'build'
  | 'input'
  | 'repo'
  | 'instructions'

const DOMAIN_ALIASES: Record<string, HelpDomain> = {
  effort: 'effort',
  task: 'task',
  plan: 'plan',
  review: 'review',
  run: 'run',
  session: 'session',
  resume: 'resume',
  build: 'build',
  input: 'input',
  repo: 'repo',
  instructions: 'instructions',
}

type HelpRow = {
  name: string
  description: string
}

export function resolveHelpDomain(surface: string | undefined): HelpDomain | null {
  if (!surface) return null
  return DOMAIN_ALIASES[surface] ?? null
}

export function printHelp(domain: HelpDomain = 'root'): void {
  switch (domain) {
    case 'effort':
      return printEffortHelp()
    case 'task':
      return printTaskHelp()
    case 'plan':
      return printPlanHelp()
    case 'review':
      return printReviewHelp()
    case 'run':
      return printRunHelp()
    case 'session':
      return printSessionHelp()
    case 'resume':
      return printResumeHelp()
    case 'build':
      return printBuildHelp()
    case 'input':
      return printInputHelp()
    case 'repo':
      return printRepoHelp()
    case 'instructions':
      return printInstructionsHelp()
    default:
      return printRootHelp()
  }
}

function printBlock(title: string, rows: HelpRow[]): void {
  if (rows.length === 0) return
  console.log('')
  console.log(`${title}:`)
  printRows(rows)
}

function printRows(rows: HelpRow[]): void {
  const width = Math.min(
    52,
    Math.max(20, ...rows.map((row) => row.name.length)),
  )
  for (const row of rows) {
    console.log(`  ${row.name.padEnd(width)}  ${row.description}`)
  }
}

function printHeader(title: string, subtitle: string): void {
  console.log(title)
  if (subtitle) {
    console.log(subtitle)
  }
}

function printRootHelp(): void {
  printHeader(
    'efl - effortless workbench cli',
    'loop: session set -> context -> checkpoint -> input when blocked -> artifact/summary',
  )

  printBlock('Commands', [
    { name: 'efl effort', description: 'efforts, plans, tasks at effort level' },
    { name: 'efl task', description: 'implementation work in a worktree' },
    { name: 'efl plan', description: 'plan submit/list/context' },
    { name: 'efl review', description: 'review submit/list/context' },
    { name: 'efl run', description: 'profiles, prepare, start, list, recovery' },
    { name: 'efl session', description: 'bind provider session id on a run' },
    { name: 'efl resume', description: 'print provider resume command' },
    { name: 'efl build', description: 'run repo build for a task' },
    { name: 'efl input', description: 'ask the human a question' },
    { name: 'efl repo', description: 'register git repos' },
    { name: 'efl instructions', description: 'global and repo instructions' },
  ])

  printBlock('Options', [
    { name: '-h, --help', description: 'help (efl <domain> help for full command list)' },
    { name: '--brief', description: 'compact context output (skips instructions dump)' },
    { name: '--body <text>', description: 'inline body for writes' },
    { name: '--from-file <path>', description: 'read body from file' },
  ])

  printBlock('Environment', [
    { name: 'EFFORTLESS_RUN_ID', description: 'infers --run' },
    { name: 'EFFORTLESS_TASK', description: 'infers --task' },
    { name: 'EFFORTLESS_RUN_LABEL', description: 'checkpoint author label' },
    { name: 'EFFORTLESS_EFFORT', description: 'effort short ref for this run' },
    { name: 'EFFORTLESS_PROVIDER', description: 'provider key (codex, cursor, opencode)' },
  ])

  console.log('')
  console.log('  efl run help          prepare -> start (app open) -> env')
  console.log('  efl task help         checkpoint, artifact, context')
}

function printEffortHelp(): void {
  printHeader('efl effort', 'plans and tasks under an effort')

  printBlock('Commands', [
    { name: 'efl effort create', description: '--title --description [--template bugfix|delivery|investigation]' },
    { name: 'efl effort list', description: 'list efforts' },
    { name: 'efl effort show', description: '--effort <eff-ref>' },
    { name: 'efl effort context', description: '--effort <eff-ref> [--brief]' },
    { name: 'efl effort summary', description: '--effort <eff-ref> --body ... [--from-file]' },
    { name: 'efl effort complete', description: '--effort <eff-ref>' },
  ])

  printSharedOptions([{ name: '--effort <eff-ref>', description: 'effort short ref (eff-1)' }])
}

function printTaskHelp(): void {
  printHeader('efl task', 'implementation in a task worktree')

  printBlock('Commands', [
    { name: 'efl task create', description: '--effort --title [--description] [--repo] [--branch] [--base-branch]' },
    { name: 'efl task list', description: '--effort <eff-ref>' },
    { name: 'efl task show', description: '--task <task-ref>' },
    { name: 'efl task context', description: '--task <task-ref> [--brief]  (read before coding)' },
    { name: 'efl task claim', description: '--task <task-ref>' },
    { name: 'efl task checkpoint', description: '--body ...  (infers --task, author from run label)' },
    { name: 'efl task artifact', description: '--body ...  (checkpoint)' },
    { name: 'efl task ready', description: '--task  (waits for review unless CLIENT_WAIT=1)' },
    { name: 'efl task wait', description: '--task  (reattach after disconnect)' },
    { name: 'efl task merge', description: '--task <task-ref>' },
    { name: 'efl task worktree', description: '--task  (ensure worktree exists)' },
  ])

  printSharedOptions([
    { name: '--task <task-ref>', description: 'task short ref (or $EFFORTLESS_TASK)' },
    { name: '--effort <eff-ref>', description: 'effort short ref' },
  ])
  console.log('')
  console.log('  in a run: --task from $EFFORTLESS_TASK')
}

function printPlanHelp(): void {
  printHeader('efl plan', 'effort planning artifacts')

  printBlock('Commands', [
    { name: 'efl plan submit', description: '--effort --body ... [--from-file]' },
    { name: 'efl plan list', description: '--effort <eff-ref>' },
    { name: 'efl plan show', description: '--plan <plan-ref>' },
    { name: 'efl plan context', description: '--plan <plan-ref> [--brief]' },
    { name: 'efl plan ready', description: '--plan <plan-ref>' },
    { name: 'efl plan wait', description: '--plan <plan-ref>' },
  ])

  printSharedOptions([
    { name: '--effort <eff-ref>', description: 'effort short ref' },
    { name: '--plan <plan-ref>', description: 'plan short ref' },
  ])
}

function printReviewHelp(): void {
  printHeader('efl review', 'human review loop')

  printBlock('Commands', [
    { name: 'efl review submit', description: '--task --verdict approve|request-changes --body ...' },
    { name: 'efl review list', description: '--task <task-ref>' },
    { name: 'efl review show', description: '--review <rev-ref>' },
    { name: 'efl review context', description: '--review <rev-ref> [--brief]' },
    { name: 'efl review ready', description: '--review <rev-ref>' },
    { name: 'efl review wait', description: '--review <rev-ref>' },
  ])

  printSharedOptions([
    { name: '--task <task-ref>', description: 'task short ref' },
    { name: '--review <rev-ref>', description: 'review short ref' },
    { name: '--verdict', description: 'approve | request-changes' },
  ])
}

function printRunHelp(): void {
  printHeader('efl run', 'agent profiles and terminal runs')

  printBlock('Commands', [
    { name: 'efl run providers', description: 'built-in provider templates' },
    { name: 'efl run profiles', description: 'saved agent profiles' },
    { name: 'efl run prepare', description: '--task | --effort [--provider] [--profile] [--label]' },
    { name: 'efl run start', description: '--run  (PTY in app; infers --run)' },
    { name: 'efl run list', description: '[--task]  (compact; --full for cwd/command)' },
    { name: 'efl run show', description: '--run [--brief]' },
    { name: 'efl run env', description: '--run  (env block for shell)' },
    { name: 'efl run fail', description: '--run --body ...  (manual recovery)' },
    { name: 'efl run cancel', description: '--run' },
  ])

  printBlock('Options', [
    { name: '--run <run-ref>', description: 'run short ref (or $EFFORTLESS_RUN_ID)' },
    { name: '--provider <key>', description: 'codex | cursor | opencode | claude' },
    { name: '--profile <id>', description: 'agent_profiles numeric id' },
    { name: '--label <name>', description: 'run label (checkpoint author)' },
    { name: '--full, --verbose', description: 'verbose run list' },
    { name: '-h, --help', description: 'this help' },
  ])
}

function printSessionHelp(): void {
  printHeader('efl session', 'persist provider session id for resume')

  printBlock('Commands', [
    { name: 'efl session set', description: '--run | --effort [--id] [--provider]' },
    { name: 'efl session show', description: '--run | --effort' },
  ])

  printBlock('Options', [
    { name: '--id <session-id>', description: 'explicit; else reads CODEX_THREAD_ID etc.' },
    { name: '-h, --help', description: 'this help' },
  ])
}

function printResumeHelp(): void {
  printHeader('efl resume', 'print provider resume command (does not spawn)')

  printBlock('Commands', [
    { name: 'efl resume', description: '--run | --effort  (needs session set first)' },
  ])

  printBlock('Options', [
    { name: '-h, --help', description: 'this help' },
  ])
}

function printBuildHelp(): void {
  printHeader('efl build', 'repo build for a task')

  printBlock('Commands', [
    { name: 'efl build run', description: '[--task]  (infers $EFFORTLESS_TASK)' },
    { name: 'efl build status', description: '[--task]' },
  ])

  printSharedOptions([{ name: '--task <task-ref>', description: 'task short ref (or $EFFORTLESS_TASK)' }])
}

function printInputHelp(): void {
  printHeader('efl input', 'ask the human')

  printBlock('Commands', [
    { name: 'efl input request', description: '--effort | --task --type yesno|choice|text --prompt ... [--choices] [--no-wait]' },
    { name: 'efl input answer', description: '--input --answer ...' },
    { name: 'efl input wait', description: '--input' },
    { name: 'efl input show', description: '--input' },
  ])

  printBlock('Options', [
    { name: '--choices <a:label|b:label>', description: 'for --type choice' },
    { name: '--no-wait', description: 'return immediately after create' },
    { name: '-h, --help', description: 'this help' },
  ])
}

function printRepoHelp(): void {
  printHeader('efl repo', 'register git repos for tasks')

  printBlock('Commands', [
    { name: 'efl repo create', description: '--name --path [--base-branch] [--build-command]' },
    { name: 'efl repo list', description: 'list repos' },
  ])

  printSharedOptions([
    { name: '--name <slug>', description: 'repo name' },
    { name: '--path <abs-path>', description: 'filesystem path' },
  ])
}

function printInstructionsHelp(): void {
  printHeader('efl instructions', 'global and repo instructions')

  printBlock('Commands', [
    { name: 'efl instructions show', description: '[--repo <repo-ref>]  print effective instructions' },
    { name: 'efl instructions set', description: '--body ... | --from-file ... | --file <path> [--repo]' },
    { name: 'efl instructions clear', description: '[--repo <repo-ref>]' },
    { name: 'efl instructions list', description: 'list configured scopes' },
  ])

  printBlock('Options', [
    { name: '--repo <repo-ref>', description: 'repo short ref' },
    { name: '--body <text>', description: 'inline body' },
    { name: '--from-file <path>', description: 'body from file' },
    { name: '--file <path>', description: 'use file content at runtime' },
    { name: '-h, --help', description: 'this help' },
  ])
}

function printSharedOptions(extra: HelpRow[]): void {
  printBlock('Options', [
    ...extra,
    { name: '--body <text>', description: 'inline body' },
    { name: '--from-file <path>', description: 'body from file' },
    { name: '--brief', description: 'compact context' },
    { name: '-h, --help', description: 'this help' },
  ])
}
