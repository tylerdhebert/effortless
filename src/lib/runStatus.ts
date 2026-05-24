import type { AgentRun } from '../../core/types'

const RUN_BADGE_PRIORITY: Record<string, number> = {
  live: 6,
  running: 5,
  stale: 4,
  failed: 3,
  exited: 2,
  cancelled: 1,
}

export function resolveRunBadgeLabel(
  run: AgentRun,
  liveSessionIds: Set<number>,
  providerLiveRunIds: Set<number>,
): string | null {
  if (providerLiveRunIds.has(run.id)) return 'live'
  if (run.status === 'running' && liveSessionIds.has(run.id)) return 'running'
  if (run.status === 'running' || run.status === 'orphaned') return 'stale'
  if (run.status === 'failed') return 'failed'
  if (run.status === 'exited') return 'exited'
  if (run.status === 'cancelled') return 'cancelled'
  return null
}

export function pickTaskRunBadge(
  runs: AgentRun[],
  liveSessionIds: Set<number>,
  providerLiveRunIds: Set<number>,
): string | null {
  let best: { label: string; priority: number } | null = null

  for (const run of runs) {
    const label = resolveRunBadgeLabel(run, liveSessionIds, providerLiveRunIds)
    if (!label) continue
    const priority = RUN_BADGE_PRIORITY[label] ?? 0
    if (!best || priority > best.priority) {
      best = { label, priority }
    }
  }

  return best?.label ?? null
}

export function countActiveEffortRuns(
  runs: AgentRun[],
  liveSessionIds: Set<number>,
  providerLiveRunIds: Set<number>,
): number {
  return runs.filter((run) => {
    const badge = resolveRunBadgeLabel(run, liveSessionIds, providerLiveRunIds)
    return badge === 'live' || badge === 'running'
  }).length
}
