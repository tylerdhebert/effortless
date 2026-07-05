const REF_DOMAINS = [
  { prefix: 'eff-', domain: 'effort', flag: '--effort' },
  { prefix: 'task-', domain: 'task', flag: '--task' },
  { prefix: 'plan-', domain: 'plan', flag: '--plan' },
  { prefix: 'rev-', domain: 'review', flag: '--review' },
  { prefix: 'run-', domain: 'run', flag: '--run' },
] as const

const REF_PATTERN = /^(eff|task|plan|rev|run)-\d+$/

function matchRef(token: string | undefined) {
  if (!token || !REF_PATTERN.test(token)) return null
  return REF_DOMAINS.find((entry) => token.startsWith(entry.prefix)) ?? null
}

// efl context task-1  -> efl task context --task task-1
// efl show rev-2      -> efl review show --review rev-2
// efl checkpoint x y  -> efl task checkpoint --body "x y" (task inferred from env)
// efl review submit task-1 ... -> efl review submit --task task-1 ...
export function rewriteCliArgs(args: string[]): string[] {
  const [first, second] = args

  if ((first === 'context' || first === 'show') && matchRef(second)) {
    const entry = matchRef(second)!
    return [entry.domain, first, entry.flag, second, ...args.slice(2)]
  }

  if (first === 'checkpoint') {
    const rest = args.slice(1)
    const ref = matchRef(rest[0])
    if (ref?.domain === 'task') {
      return ['task', 'checkpoint', ref.flag, rest[0], '--body', rest.slice(1).join(' ')]
    }
    if (rest.length > 0 && !rest[0].startsWith('--')) {
      return ['task', 'checkpoint', '--body', rest.join(' ')]
    }
    return ['task', 'checkpoint', ...rest]
  }

  // Positional ref directly after `<domain> <command>` becomes its flag,
  // unless that flag is already present.
  const entry = matchRef(args[2])
  if (entry && !args.includes(entry.flag)) {
    return [...args.slice(0, 2), entry.flag, args[2], ...args.slice(3)]
  }

  return args
}
