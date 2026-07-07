import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { applyTheme, applyThemePalette, cloneThemePalette, THEME_PALETTES, type ThemePalette } from './themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleHelp,
  ChevronsRight,
  Hammer,
  Home,
  ListOrdered,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { EffortSummarySection } from './components/effort/EffortSummarySection'
import { EffortCreationForm } from './components/sidebar/EffortCreationForm'
import { InputRequestList } from './components/effort/InputRequestList'
import { ManageSurface } from './components/manage/ManageSurface'
import { WarningIndicator } from './components/notifications/WarningIndicator'
import { NotificationFooter } from './components/notifications/NotificationFooter'
import { NotificationToast } from './components/notifications/NotificationToast'
import { TitleBar } from './components/ui/TitleBar'
import type { AttentionNavigateTarget } from './components/notifications/NeedsYou'

import { PlanSection } from './components/effort/PlanSection'
import { Sidebar } from './components/sidebar/Sidebar'
import { AgentRunTerminal } from './components/task/AgentRunTerminal'
import { TaskCreationForm } from './components/task/TaskCreationForm'
import { TaskPage } from './components/task/TaskPage'
import { TaskList } from './components/task/TaskList'
import { getAgentProviderConfig, listAgentProviders } from '../core/agentProviders'
import { countActiveEffortRuns, pickTaskRunBadge } from './lib/runStatus'
import { effortSupportsPlans, effortSupportsTasks } from './lib/helpers'
import { Ref } from './components/ui/Ref'
import { Stamp, statusTone } from './components/ui/Stamp'
import { MANAGE_SECTIONS, type ManageSection } from './lib/manageSections'
import { useEffortMutations } from './hooks/useEffortMutations'
import { useInputMutations } from './hooks/useInputMutations'
import { useInstructionsMutations } from './hooks/useInstructionsMutations'
import { usePlanMutations } from './hooks/usePlanMutations'
import { useRepoMutations } from './hooks/useRepoMutations'
import { useReviewMutations } from './hooks/useReviewMutations'
import { useTaskMutations } from './hooks/useTaskMutations'
import { useNotifications } from './hooks/useNotifications'
import type { AgentProvider, AgentRun, LiveAgentRunSession, Task } from '../core/types'
import type { PendingNotification } from '../core/notifications'
import './App.css'

type EffortRailDrawer = 'inputs' | 'plan' | 'tasks'
type TaskTabFace = 'work' | 'session'
type LiveSessionCacheEntry = {
  session: LiveAgentRunSession
  lastSeenAt: number
}

const DEFAULT_TERMINAL_SIZE = { cols: 100, rows: 24 }
const LIVE_SESSION_GRACE_MS = 5000
const FORK_MAIN_PROMPT = 'Continue from main as a forked Effortless session. Keep scope tight and update durable state with efl.'

function App() {
  const queryClient = useQueryClient()
  const [surfaceMode, setSurfaceMode] = useState<'effort' | 'manage'>('effort')
  const [manageSection, setManageSection] = useState<ManageSection>('repos')
  const [selectedEffortId, setSelectedEffortId] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [taskRepoFilter, setTaskRepoFilter] = useState<string>('all')
  const [createEffortOpen, setCreateEffortOpen] = useState(false)
  const [deleteEffortOpen, setDeleteEffortOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [activeTerminalTabKey, setActiveTerminalTabKey] = useState('main')
  const [openTaskPageIdsByEffort, setOpenTaskPageIdsByEffort] = useState<Record<number, number[]>>({})
  const [taskTabFaceByTaskId, setTaskTabFaceByTaskId] = useState<Record<number, TaskTabFace>>({})
  const [selectedTaskRunIdByTaskId, setSelectedTaskRunIdByTaskId] = useState<Record<number, number>>({})
  const [activeEffortDrawer, setActiveEffortDrawer] = useState<EffortRailDrawer | null>(null)
  const [effortDescriptionExpanded, setEffortDescriptionExpanded] = useState(false)
  const [effortMenuOpen, setEffortMenuOpen] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState<number | null>(null)
  const [drawerResizing, setDrawerResizing] = useState(false)
  const effortMenuRef = useRef<HTMLDivElement | null>(null)

  const handleDrawerResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDrawerResizing(true)
    const startX = e.clientX
    const startWidth = drawerWidth ?? getDefaultDrawerWidth(activeEffortDrawer)

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      setDrawerWidth(Math.max(320, Math.min(startWidth + delta, window.innerWidth * 0.7)))
    }
    const onUp = () => {
      setDrawerResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [drawerWidth, activeEffortDrawer])
  const [taskCreateOpen, setTaskCreateOpen] = useState(false)
  const [focusedInputId, setFocusedInputId] = useState<number | null>(null)
  const [drawerClosedAt, setDrawerClosedAt] = useState(0)
  const [observedAppVersion, setObservedAppVersion] = useState<number | null>(null)
  const [customThemePalette, setCustomThemePalette] = useState<ThemePalette | null>(null)
  const [customThemeActive, setCustomThemeActive] = useState(false)
  const [terminalStartSize, setTerminalStartSize] = useState(DEFAULT_TERMINAL_SIZE)
  const preserveSelectionOnEffortChangeRef = useRef(false)
  const bootstrapLiveAttachmentIdsRef = useRef<Set<string> | null>(null)
  const liveSessionGraceRef = useRef(new Map<number, LiveSessionCacheEntry>())
  const activeTerminalTabKeyByEffortRef = useRef<Record<number, string>>({})

  const effortsQuery = useQuery({
    queryKey: ['efforts'],
    queryFn: () => window.effortless.listEfforts(),
  })

  const reposQuery = useQuery({
    queryKey: ['repos'],
    queryFn: () => window.effortless.listRepos(),
  })

  const agentProfilesQuery = useQuery({
    queryKey: ['agent-profiles'],
    queryFn: () => window.effortless.listAgentProfiles(),
  })

  const instructionsQuery = useQuery({
    queryKey: ['instructions'],
    queryFn: () => window.effortless.listInstructions(),
  })

  const appStateQuery = useQuery({
    queryKey: ['app-state'],
    queryFn: () => window.effortless.getAppState(),
    refetchInterval: 2000,
  })

  useEffect(() => {
    if (!customThemeActive && appStateQuery.data?.theme) {
      applyTheme(appStateQuery.data.theme)
    }
  }, [appStateQuery.data?.theme, customThemeActive])

  useEffect(() => {
    if (!appStateQuery.data) return

    if (appStateQuery.data.customThemePalette) {
      setCustomThemePalette((current) => current ?? cloneThemePalette(appStateQuery.data.customThemePalette!))
    } else if (!customThemePalette && appStateQuery.data.theme) {
      const basePalette =
        THEME_PALETTES[appStateQuery.data.theme as keyof typeof THEME_PALETTES] ?? THEME_PALETTES.phosphor
      setCustomThemePalette(cloneThemePalette(basePalette))
    }

    setCustomThemeActive(appStateQuery.data.customThemeActive)
  }, [appStateQuery.data, customThemePalette])

  useEffect(() => {
    if (customThemeActive && customThemePalette) {
      applyThemePalette(customThemePalette)
    }
  }, [customThemeActive, customThemePalette])

  const { notifications, count: notificationCount, isLoading: notificationsLoading } = useNotifications()

  const effortPendingMap = new Map<number, boolean>()
  for (const notification of notifications) {
    effortPendingMap.set(notification.effortId, true)
  }

  const selectedEffort =
    effortsQuery.data?.find((effort) => effort.id === selectedEffortId) ?? effortsQuery.data?.[0]

  const openTaskPageIds = useMemo(() => {
    if (!selectedEffort) return []
    return openTaskPageIdsByEffort[selectedEffort.id] ?? []
  }, [openTaskPageIdsByEffort, selectedEffort])

  const rememberActiveTerminalTabKey = useCallback((
    value: string | ((current: string) => string),
    effortId: number | null | undefined = selectedEffort?.id,
  ) => {
    setActiveTerminalTabKey((current) => {
      const next = typeof value === 'function' ? value(current) : value
      if (effortId != null) {
        activeTerminalTabKeyByEffortRef.current[effortId] = next
      }
      return next
    })
  }, [selectedEffort?.id])

  const tasksQuery = useQuery({
    queryKey: ['tasks', selectedEffort?.id],
    queryFn: () => window.effortless.listTasks(selectedEffort!.id),
    enabled: Boolean(selectedEffort),
  })

  const allTasksQuery = useQuery({
    queryKey: ['all-tasks'],
    queryFn: () => window.effortless.listAllTasks(),
  })

  const plansQuery = useQuery({
    queryKey: ['plans', selectedEffort?.id],
    queryFn: () => window.effortless.listPlans(selectedEffort!.id),
    enabled: Boolean(selectedEffort),
  })

  const selectedPlan =
    plansQuery.data?.find((plan) => plan.id === selectedPlanId) ?? plansQuery.data?.[0]

  const planCommentsQuery = useQuery({
    queryKey: ['plan-comments', selectedPlan?.id],
    queryFn: () => window.effortless.listPlanComments(selectedPlan!.id),
    enabled: Boolean(selectedPlan),
  })

  const inputsQuery = useQuery({
    queryKey: ['inputs', selectedEffort?.id],
    queryFn: () => window.effortless.listInputRequests(selectedEffort!.id),
    enabled: Boolean(selectedEffort),
  })

  const template = selectedEffort?.template ?? null
  const supportsPlans = template ? effortSupportsPlans(template) : false
  const supportsTasks = template ? effortSupportsTasks(template) : false

  const taskPendingInputIds = useMemo(() => {
    const set = new Set<number>()
    for (const input of inputsQuery.data ?? []) {
      if (input.status === 'pending' && input.taskId != null) {
        set.add(input.taskId)
      }
    }
    return set
  }, [inputsQuery.data])

  const taskRepoOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of tasksQuery.data ?? []) {
      if (task.repoId == null) continue
      const repo = reposQuery.data?.find((r) => r.id === task.repoId)
      if (repo) map.set(String(repo.id), repo.name)
    }
    return Array.from(map.entries())
  }, [tasksQuery.data, reposQuery.data])

  const filteredTasks = useMemo(() => {
    if (taskRepoFilter === 'all') return tasksQuery.data ?? []
    return (tasksQuery.data ?? []).filter((t) => String(t.repoId) === taskRepoFilter)
  }, [tasksQuery.data, taskRepoFilter])

  const activePageTaskId = useMemo(() => {
    if (!activeTerminalTabKey.startsWith('work-task-')) return null
    const taskId = Number(activeTerminalTabKey.replace('work-task-', ''))
    return Number.isFinite(taskId) ? taskId : null
  }, [activeTerminalTabKey])

  const activePageTask = useMemo(() => {
    if (activePageTaskId == null) return null
    return tasksQuery.data?.find((task) => task.id === activePageTaskId) ?? null
  }, [activePageTaskId, tasksQuery.data])

  const commentsQuery = useQuery({
    queryKey: ['task-comments', activePageTask?.id],
    queryFn: () => window.effortless.listTaskComments(activePageTask!.id),
    enabled: Boolean(activePageTask),
  })

  const reviewsQuery = useQuery({
    queryKey: ['reviews', activePageTask?.id],
    queryFn: () => window.effortless.listReviews(activePageTask!.id),
    enabled: Boolean(activePageTask),
  })

  const effortRunsQuery = useQuery({
    queryKey: ['agent-runs', selectedEffort?.id],
    queryFn: () => window.effortless.listAgentRuns(selectedEffort!.id),
    enabled: Boolean(selectedEffort),
  })

  const allRunsQuery = useQuery({
    queryKey: ['agent-runs', 'all'],
    queryFn: () => window.effortless.listAgentRuns(),
  })

  const liveSessionsQuery = useQuery({
    queryKey: ['agent-runs', 'live-sessions'],
    queryFn: () => window.effortless.listLiveAgentRunSessions(),
    refetchInterval: 1000,
  })

  const ptyStatusQuery = useQuery({
    queryKey: ['pty-status'],
    queryFn: () => window.effortless.getPtyRuntimeStatus(),
    staleTime: Infinity,
  })
  const ptyAvailable = ptyStatusQuery.data?.available !== false

  const liveSessions = useMemo(() => liveSessionsQuery.data ?? [], [liveSessionsQuery.data])
  const stableLiveSessions = useMemo(() => {
    const now = Date.now()
    const cache = liveSessionGraceRef.current
    const allRuns = allRunsQuery.data
    const runningRunIds = new Set(
      (allRuns ?? [])
        .filter((run) => run.status === 'running')
        .map((run) => run.id),
    )
    const seenRunIds = new Set<number>()

    for (const session of liveSessions) {
      seenRunIds.add(session.runId)
      cache.set(session.runId, { session, lastSeenAt: now })
    }

    for (const [runId, cached] of cache) {
      const runCanBePreserved = allRuns == null || runningRunIds.has(runId)
      if (!runCanBePreserved || now - cached.lastSeenAt > LIVE_SESSION_GRACE_MS) {
        cache.delete(runId)
      }
    }

    return [
      ...liveSessions,
      ...Array.from(cache.entries())
        .filter(([runId]) => !seenRunIds.has(runId) && (allRuns == null || runningRunIds.has(runId)))
        .map(([, cached]) => cached.session),
    ]
  }, [allRunsQuery.data, liveSessions])
  const providers = useMemo(() => listAgentProviders(), [])
  const liveSessionIds = useMemo(() => new Set(stableLiveSessions.map((session) => session.runId)), [stableLiveSessions])
  const liveEffortIds = useMemo(() => {
    const ids = new Set<number>()
    for (const run of allRunsQuery.data ?? []) {
      if (liveSessionIds.has(run.id)) {
        ids.add(run.effortId)
      }
    }
    return ids
  }, [allRunsQuery.data, liveSessionIds])
  const providerLiveRunIds = useMemo(
    () => new Set(stableLiveSessions.filter((session) => session.providerLive).map((session) => session.runId)),
    [stableLiveSessions],
  )
  const liveSessionByRunId = useMemo(() => {
    const byRunId = new Map<number, LiveAgentRunSession>()
    for (const session of stableLiveSessions) {
      byRunId.set(session.runId, session)
    }
    return byRunId
  }, [stableLiveSessions])

  const runBadgeByTaskId = useMemo(() => {
    const runs = effortRunsQuery.data ?? []
    const map = new Map<number, string>()
    for (const task of tasksQuery.data ?? []) {
      const taskRuns = runs.filter((run) => run.taskId === task.id)
      const badge = pickTaskRunBadge(taskRuns, liveSessionIds, providerLiveRunIds)
      if (badge) {
        map.set(task.id, badge)
      }
    }
    return map
  }, [effortRunsQuery.data, tasksQuery.data, liveSessionIds, providerLiveRunIds])

  const activeEffortRunCount = useMemo(() => {
    return countActiveEffortRuns(effortRunsQuery.data ?? [], liveSessionIds, providerLiveRunIds)
  }, [effortRunsQuery.data, liveSessionIds, providerLiveRunIds])

  const taskRunsByTaskId = useMemo(() => {
    const map = new Map<number, AgentRun[]>()
    for (const run of effortRunsQuery.data ?? []) {
      if (run.taskId == null) continue
      const taskRuns = map.get(run.taskId) ?? []
      taskRuns.push(run)
      map.set(run.taskId, taskRuns)
    }
    return map
  }, [effortRunsQuery.data])

  const selectedTaskRunByTaskId = useMemo(() => {
    const map = new Map<number, AgentRun>()
    for (const [taskId, runs] of taskRunsByTaskId) {
      const manualRunId = selectedTaskRunIdByTaskId[taskId]
      const run =
        runs.find((candidate) => candidate.id === manualRunId) ??
        runs.find((candidate) => providerLiveRunIds.has(candidate.id)) ??
        runs.find((candidate) => liveSessionIds.has(candidate.id)) ??
        runs[0] ??
        null
      if (run) {
        map.set(taskId, run)
      }
    }
    return map
  }, [liveSessionIds, providerLiveRunIds, selectedTaskRunIdByTaskId, taskRunsByTaskId])

  const activePageTaskRuns = useMemo(() => {
    if (!activePageTask) return []
    return (effortRunsQuery.data ?? []).filter((run) => run.taskId === activePageTask.id)
  }, [effortRunsQuery.data, activePageTask])

  useEffect(() => {
    if (bootstrapLiveAttachmentIdsRef.current !== null) return
    if (!liveSessionsQuery.isFetched) return
    bootstrapLiveAttachmentIdsRef.current = new Set(liveSessions.map((session) => session.attachmentId))
  }, [liveSessions, liveSessionsQuery.isFetched])

  const terminalTabs = useMemo(() => {
    const runs = effortRunsQuery.data ?? []
    const profiles = agentProfilesQuery.data ?? []
    const tasks = tasksQuery.data ?? []
    const tabKeys = new Set<string>(['main'])
    if (!activeTerminalTabKey.startsWith('work-task-') && !activeTerminalTabKey.startsWith('task-')) {
      tabKeys.add(activeTerminalTabKey)
    }
    for (const run of runs) {
      const key = run.terminalTabKey ?? 'main'
      if (run.taskId != null && key.startsWith('task-')) continue
      tabKeys.add(key)
    }
    const terminalOnlyTabs = Array.from(tabKeys).map((key) => {
      const tabRuns = runs.filter((run) => (run.terminalTabKey ?? 'main') === key)
      const run =
        tabRuns.find((candidate) => providerLiveRunIds.has(candidate.id)) ??
        tabRuns.find((candidate) => liveSessionIds.has(candidate.id)) ??
        tabRuns[0] ??
        null
      return {
        key,
        label: terminalTabLabel(key),
        run,
        hasLiveSession: run ? liveSessionIds.has(run.id) : false,
        providerLive: run ? providerLiveRunIds.has(run.id) : false,
        profileLabel: run
          ? `${getAgentProviderConfig(run.provider).name} / ${
              profiles.find((profile) => profile.id === run.profileId)?.name ?? `profile-${run.profileId}`
            }`
          : null,
        taskId: run?.taskId ?? null,
        purpose: run?.purpose ?? null,
        branchLabel: run?.taskId
          ? tasks.find((task) => task.id === run.taskId)?.branchName ?? 'no branch'
          : 'effort',
        kind: 'terminal' as const,
        workTaskId: null,
      }
    })
    const workTabs = openTaskPageIds
      .map((taskId) => {
        const task = tasks.find((candidate) => candidate.id === taskId)
        if (!task) return null
        return {
          key: `work-task-${taskId}`,
          label: task.shortRef,
          tooltip: task.title,
          run: null,
          hasLiveSession: false,
          providerLive: false,
          profileLabel: null,
          taskId,
          purpose: null,
          branchLabel: task.branchName ?? 'no branch',
          kind: 'work' as const,
          workTaskId: taskId,
        }
      })
      .filter((tab): tab is NonNullable<typeof tab> => tab !== null)

    return [...terminalOnlyTabs, ...workTabs]
  }, [
    activeTerminalTabKey,
    effortRunsQuery.data,
    agentProfilesQuery.data,
    liveSessionIds,
    providerLiveRunIds,
    tasksQuery.data,
    openTaskPageIds,
  ])

  const taskSessionTabs = useMemo(() => {
    const profiles = agentProfilesQuery.data ?? []
    return (tasksQuery.data ?? [])
      .map((task) => {
        const runs = taskRunsByTaskId.get(task.id) ?? []
        if (runs.length === 0) return null
        const selectedRun = selectedTaskRunByTaskId.get(task.id) ?? null
        return {
          taskId: task.id,
          shortRef: task.shortRef,
          title: task.title,
          branchLabel: task.branchName ?? 'no branch',
          run: selectedRun,
          hasLiveSession: selectedRun ? liveSessionIds.has(selectedRun.id) : false,
          providerLive: selectedRun ? providerLiveRunIds.has(selectedRun.id) : false,
          profileLabel: selectedRun
            ? `${getAgentProviderConfig(selectedRun.provider).name} / ${
                profiles.find((profile) => profile.id === selectedRun.profileId)?.name ?? `profile-${selectedRun.profileId}`
              }`
            : null,
          runs: [...runs]
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
            .map((run) => ({
              run,
              hasLiveSession: liveSessionIds.has(run.id),
              providerLive: providerLiveRunIds.has(run.id),
              profileLabel: `${getAgentProviderConfig(run.provider).name} / ${
                profiles.find((profile) => profile.id === run.profileId)?.name ?? `profile-${run.profileId}`
              }`,
            })),
        }
      })
      .filter((tab): tab is NonNullable<typeof tab> => tab !== null)
  }, [
    agentProfilesQuery.data,
    liveSessionIds,
    providerLiveRunIds,
    selectedTaskRunByTaskId,
    taskRunsByTaskId,
    tasksQuery.data,
  ])

  useEffect(() => {
    if (tasksQuery.data === undefined || tasksQuery.isLoading) return
    if (!terminalTabs.some((tab) => tab.key === activeTerminalTabKey)) {
      rememberActiveTerminalTabKey('main')
    }
  }, [activeTerminalTabKey, rememberActiveTerminalTabKey, tasksQuery.data, tasksQuery.isLoading, terminalTabs])

  const buildQuery = useQuery({
    queryKey: ['task-build', activePageTask?.id],
    queryFn: () => window.effortless.getLatestTaskBuild(activePageTask!.id),
    enabled: Boolean(activePageTask),
  })

  const activeTerminalTab = useMemo(
    () => terminalTabs.find((tab) => tab.key === activeTerminalTabKey) ?? null,
    [activeTerminalTabKey, terminalTabs],
  )
  const activeTaskTabFace = activePageTaskId != null
    ? taskTabFaceByTaskId[activePageTaskId] ?? 'work'
    : null
  const activeTerminalRun = useMemo(() => {
    if (activeTerminalTab?.kind === 'work') {
      if (activeTaskTabFace !== 'session' || activePageTaskId == null) return null
      return selectedTaskRunByTaskId.get(activePageTaskId) ?? null
    }
    return activeTerminalTab?.run ?? null
  }, [activePageTaskId, activeTaskTabFace, activeTerminalTab, selectedTaskRunByTaskId])
  const isTerminalTabActive = activeTerminalTab?.kind !== 'work' || activeTaskTabFace === 'session'

  const dockScopedInputs = useMemo(() => {
    if (!isTerminalTabActive || !activeTerminalRun) return []
    return (inputsQuery.data ?? [])
      .filter((input) => input.status === 'pending')
      .filter(
        (input) =>
          input.runId === activeTerminalRun.id ||
          (input.taskId != null &&
            activeTerminalRun.taskId != null &&
            input.taskId === activeTerminalRun.taskId),
      )
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  }, [activeTerminalRun, inputsQuery.data, isTerminalTabActive])

  const dockVisibleInputs = useMemo(() => dockScopedInputs.slice(0, 2), [dockScopedInputs])
  const dockHiddenCount = Math.max(0, dockScopedInputs.length - 2)

  const activeTerminalRunHasLiveSession = activeTerminalRun ? liveSessionIds.has(activeTerminalRun.id) : false
  const activeTerminalRunProviderLive = activeTerminalRun ? providerLiveRunIds.has(activeTerminalRun.id) : false
  const mountedTerminalRuns = useMemo(() => {
    const mounted = new Map<number, {
      run: AgentRun
      hasLiveSession: boolean
      providerLive: boolean
      reattached: boolean
      liveSession: LiveAgentRunSession | null
    }>()
    for (const run of allRunsQuery.data ?? []) {
      const liveSession = liveSessionByRunId.get(run.id) ?? null
      if (!liveSession) continue
      mounted.set(run.id, {
        run,
        hasLiveSession: true,
        providerLive: liveSession.providerLive,
        reattached: Boolean(bootstrapLiveAttachmentIdsRef.current?.has(liveSession.attachmentId)),
        liveSession,
      })
    }
    return Array.from(mounted.values())
  }, [allRunsQuery.data, liveSessionByRunId])
  const mainTerminalTab = terminalTabs.find((tab) => tab.key === 'main') ?? null
  const effortDefaultProfile = selectedEffort?.defaultProfileId != null
    ? agentProfilesQuery.data?.find((profile) => profile.id === selectedEffort.defaultProfileId) ?? null
    : null
  const mainTerminalProvider = mainTerminalTab?.run ? getAgentProviderConfig(mainTerminalTab.run.provider) : null
  const forkMainDisabledReason = !mainTerminalTab?.run
    ? 'start main before forking'
    : !mainTerminalTab.run.providerSessionId
      ? 'main has no provider session id yet'
      : !mainTerminalProvider?.forkCommandTemplate
        ? 'provider does not support fork'
        : null

  const openTaskPage = useCallback((taskId: number, effortId = selectedEffort?.id) => {
    if (effortId == null) return
    setOpenTaskPageIdsByEffort((current) => {
      const effortTaskIds = current[effortId] ?? []
      if (effortTaskIds.includes(taskId)) return current
      return { ...current, [effortId]: [...effortTaskIds, taskId] }
    })
    setTaskTabFaceByTaskId((current) => ({ ...current, [taskId]: 'work' }))
    rememberActiveTerminalTabKey(`work-task-${taskId}`, effortId)
    setActiveEffortDrawer(null)
  }, [rememberActiveTerminalTabKey, selectedEffort?.id])

  const selectTaskTab = useCallback((
    taskId: number,
    face: TaskTabFace,
    effortId = selectedEffort?.id,
    runId?: number | null,
  ) => {
    if (effortId == null) return
    setOpenTaskPageIdsByEffort((current) => {
      const effortTaskIds = current[effortId] ?? []
      if (effortTaskIds.includes(taskId)) return current
      return { ...current, [effortId]: [...effortTaskIds, taskId] }
    })
    setTaskTabFaceByTaskId((current) => ({ ...current, [taskId]: face }))
    if (runId != null) {
      setSelectedTaskRunIdByTaskId((current) => ({ ...current, [taskId]: runId }))
    }
    rememberActiveTerminalTabKey(`work-task-${taskId}`, effortId)
    setActiveEffortDrawer(null)
  }, [rememberActiveTerminalTabKey, selectedEffort?.id])

  const navigateToRunTab = useCallback((
    runOrTabKey?: AgentRun | string | null,
    effortId = selectedEffort?.id,
  ) => {
    if (!runOrTabKey) {
      rememberActiveTerminalTabKey('main', effortId)
      return
    }

    if (typeof runOrTabKey !== 'string') {
      if (runOrTabKey.taskId != null) {
        setSelectedTaskId(runOrTabKey.taskId)
        setSelectedPlanId(null)
        selectTaskTab(runOrTabKey.taskId, 'session', runOrTabKey.effortId, runOrTabKey.id)
        return
      }
      rememberActiveTerminalTabKey(runOrTabKey.terminalTabKey ?? 'main', runOrTabKey.effortId)
      return
    }

    const tabKey = runOrTabKey
    const matchingRun = (effortRunsQuery.data ?? allRunsQuery.data ?? [])
      .find((run) => (run.terminalTabKey ?? 'main') === tabKey)
    if (matchingRun?.taskId != null) {
      setSelectedTaskId(matchingRun.taskId)
      setSelectedPlanId(null)
      selectTaskTab(matchingRun.taskId, 'session', matchingRun.effortId, matchingRun.id)
      return
    }

    if (tabKey.startsWith('task-')) {
      const taskShortRef = tabKey.replace(/^task-/, '')
      const matchingTask = [
        ...(tasksQuery.data ?? []),
        ...(allTasksQuery.data ?? []),
      ].find((task) => task.shortRef === taskShortRef)
      if (matchingTask) {
        setSelectedTaskId(matchingTask.id)
        setSelectedPlanId(null)
        selectTaskTab(matchingTask.id, 'session', effortId)
        return
      }
    }

    rememberActiveTerminalTabKey(tabKey, effortId)
  }, [
    allRunsQuery.data,
    allTasksQuery.data,
    effortRunsQuery.data,
    rememberActiveTerminalTabKey,
    selectTaskTab,
    selectedEffort?.id,
    tasksQuery.data,
  ])

  async function refreshAgentRunState(runOrTabKey?: AgentRun | string | null) {
    navigateToRunTab(runOrTabKey ?? 'main')
    await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
    await queryClient.invalidateQueries({ queryKey: ['agent-runs', 'live-sessions'] })
    await queryClient.invalidateQueries({ queryKey: ['app-state'] })
  }

  const closeTaskPage = useCallback((key: string) => {
    if (!selectedEffort) return
    const taskId = Number(key.replace('work-task-', ''))
    setOpenTaskPageIdsByEffort((current) => ({
      ...current,
      [selectedEffort.id]: (current[selectedEffort.id] ?? []).filter((id) => id !== taskId),
    }))
    rememberActiveTerminalTabKey((current) => (current === key ? 'main' : current))
  }, [rememberActiveTerminalTabKey, selectedEffort])

  const handleAttentionNavigate = useCallback((target: AttentionNavigateTarget) => {
    setSurfaceMode('effort')
    setSelectedEffortId(target.effortId)

    if (target.inputId != null) {
      setActiveEffortDrawer('inputs')
      setFocusedInputId(target.inputId)
      if (target.taskId != null) {
        setSelectedTaskId(target.taskId)
        setSelectedPlanId(null)
      }
      return
    }

    if (target.taskId != null) {
      setSelectedTaskId(target.taskId)
      setSelectedPlanId(null)
      openTaskPage(target.taskId, target.effortId)
    }
  }, [openTaskPage])

  const handleAttentionRunNavigate = useCallback((run: AgentRun) => {
    setSurfaceMode('effort')
    setSelectedEffortId(run.effortId)
    navigateToRunTab(run)
  }, [navigateToRunTab])

  const openInputsDrawer = useCallback(() => {
    setActiveEffortDrawer('inputs')
  }, [])

  useEffect(() => {
    if (!selectedEffort || tasksQuery.data === undefined || tasksQuery.isLoading) return
    const taskIds = new Set((tasksQuery.data ?? []).map((task) => task.id))
    setOpenTaskPageIdsByEffort((current) => {
      const effortTaskIds = current[selectedEffort.id] ?? []
      const nextTaskIds = effortTaskIds.filter((id) => taskIds.has(id))
      if (nextTaskIds.length === effortTaskIds.length) return current
      return { ...current, [selectedEffort.id]: nextTaskIds }
    })
  }, [selectedEffort, tasksQuery.data, tasksQuery.isLoading])

  const commitsQuery = useQuery({
    queryKey: ['task-commits', activePageTask?.id],
    queryFn: () => window.effortless.getTaskCommits(activePageTask!.id),
    enabled: Boolean(activePageTask),
  })

  const conflictsQuery = useQuery({
    queryKey: ['task-conflicts', activePageTask?.id],
    queryFn: () => window.effortless.getTaskConflicts(activePageTask!.id),
    enabled: Boolean(activePageTask),
  })

  const { createEffort, deleteEffort } = useEffortMutations(selectedEffort?.id ?? null)
  const repoMutations = useRepoMutations(selectedEffort?.id ?? null)
  const instructionsMutations = useInstructionsMutations()
  const planMutations = usePlanMutations(
    selectedEffort?.id ?? null,
    selectedPlan?.id ?? null,
  )
  const taskMutations = useTaskMutations(selectedEffort?.id ?? null)
  const reviewMutations = useReviewMutations(selectedEffort?.id ?? null)
  const { answerInput } = useInputMutations(selectedEffort?.id ?? null)

  const updateNotificationSettings = useMutation({
    mutationFn: (settings: {
      osNotificationsEnabled?: boolean
      bannerNotificationsEnabled?: boolean
      badgeNotificationsEnabled?: boolean
      soundNotificationsEnabled?: boolean
      toastDurationSeconds?: number
      theme?: string
    }) => window.effortless.updateNotificationSettings(settings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-state'] })
    },
  })

  const updateCustomThemeState = useMutation({
    mutationFn: (state: {
      customThemeActive: boolean
      customThemePalette: Record<string, string> | null
    }) => window.effortless.updateCustomThemeState(state),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-state'] })
    },
  })

  const createAgentProfile = useMutation({
    mutationFn: (input: Parameters<typeof window.effortless.createAgentProfile>[0]) =>
      window.effortless.createAgentProfile(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agent-profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['app-state'] }),
      ])
    },
  })

  const updateAgentProfile = useMutation({
    mutationFn: (input: Parameters<typeof window.effortless.updateAgentProfile>[0]) =>
      window.effortless.updateAgentProfile(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agent-profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['app-state'] }),
      ])
    },
  })

  const deleteAgentProfile = useMutation({
    mutationFn: (profileId: number) => window.effortless.deleteAgentProfile(profileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agent-profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['app-state'] }),
        queryClient.invalidateQueries({ queryKey: ['efforts'] }),
      ])
    },
  })

  const updateEffortDefaultProfile = useMutation({
    mutationFn: ({ effortId, profileId }: { effortId: number; profileId: number | null }) =>
      window.effortless.updateEffortDefaultProfile(effortId, profileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['efforts'] }),
        queryClient.invalidateQueries({ queryKey: ['app-state'] }),
      ])
    },
  })

  const updateEffortDefaultProvider = useMutation({
    mutationFn: ({ effortId, provider }: { effortId: number; provider: AgentProvider }) =>
      window.effortless.updateEffortDefaultProvider(effortId, provider),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['efforts'] }),
        queryClient.invalidateQueries({ queryKey: ['app-state'] }),
      ])
    },
  })

  const startEffortRun = useMutation({
    mutationFn: async ({ effortId, provider, profileId }: { effortId: number; provider: AgentProvider; profileId: number | null }) => {
      const prepared = await window.effortless.prepareEffortRun({ effortId, provider, profileId, purpose: 'main' })
      await window.effortless.startAgentRun(prepared.run.id, terminalStartSize)
      return prepared
    },
    onSuccess: async (prepared) => {
      await refreshAgentRunState(prepared.run)
    },
  })

  const resumeAgentRun = useMutation({
    mutationFn: async (runId: number) => {
      const prepared = await window.effortless.prepareResumeRun({ runId })
      await window.effortless.startAgentRun(prepared.run.id, terminalStartSize)
      return prepared
    },
    onSuccess: async (prepared) => {
      await refreshAgentRunState(prepared.run)
    },
  })

  const forkMainRun = useMutation({
    mutationFn: async () => {
      const sourceRun = mainTerminalTab?.run
      if (!sourceRun) {
        throw new Error('Start main before forking.')
      }
      const prepared = await window.effortless.prepareForkRun({
        sourceRunId: sourceRun.id,
        prompt: FORK_MAIN_PROMPT,
      })
      await window.effortless.startAgentRun(prepared.run.id, terminalStartSize)
      return prepared
    },
    onSuccess: async (prepared) => {
      await refreshAgentRunState(prepared.run)
    },
  })

  const startTaskRun = useMutation({
    mutationFn: async ({ task, provider, profileId }: { task: Task; provider: AgentProvider; profileId: number | null }) => {
      const prepared = await window.effortless.prepareTaskRun({
        taskId: task.id,
        provider,
        profileId,
        purpose: 'extra',
      })
      await window.effortless.startAgentRun(prepared.run.id, terminalStartSize)
      return prepared
    },
    onSuccess: async (prepared) => {
      setActiveEffortDrawer(null)
      await refreshAgentRunState(prepared.run)
    },
  })

  const rerunTaskRun = useMutation({
    mutationFn: async ({ task, provider, profileId }: { task: Task; provider: AgentProvider; profileId: number | null }) => {
      const prepared = await window.effortless.prepareTaskRun({
        taskId: task.id,
        provider,
        profileId,
        purpose: 'extra',
        label: 'rerun',
      })
      await window.effortless.startAgentRun(prepared.run.id, terminalStartSize)
      return prepared
    },
    onSuccess: async (prepared) => {
      setActiveEffortDrawer(null)
      await refreshAgentRunState(prepared.run)
    },
  })

  const sendTaskToEffortSession = useMutation({
    mutationFn: async ({ task, provider, profileId }: { task: Task; provider: AgentProvider; profileId: number | null }) => {
      if (!selectedEffort) {
        throw new Error('Select an effort before sending task context.')
      }

      const mainRuns = (effortRunsQuery.data ?? []).filter(
        (run) => (run.terminalTabKey ?? 'main') === 'main',
      )
      const liveMainRun =
        mainRuns.find((run) => providerLiveRunIds.has(run.id)) ?? null
      const latestMainRun = mainRuns[0] ?? null
      const prompt = buildTaskWorkPrompt(task)
      const requestedProfileId = profileId ?? selectedEffort.defaultProfileId ?? null
      const requestedProvider = provider ?? selectedEffort.defaultProvider

      if (liveMainRun) {
        await window.effortless.writeAgentRun(liveMainRun.id, `${prompt}\r`)
        return liveMainRun
      }

      if (
        latestMainRun?.providerSessionId &&
        latestMainRun.provider === requestedProvider &&
        (requestedProfileId == null || latestMainRun.profileId === requestedProfileId)
      ) {
        const prepared = await window.effortless.prepareResumeRun({ runId: latestMainRun.id })
        await window.effortless.startAgentRun(prepared.run.id, terminalStartSize)
        await delay(650)
        await window.effortless.writeAgentRun(prepared.run.id, `${prompt}\r`)
        return prepared.run
      }

      const prepared = await window.effortless.prepareEffortRun({
        effortId: selectedEffort.id,
        provider: requestedProvider,
        profileId: requestedProfileId,
        purpose: 'main',
      })
      await window.effortless.startAgentRun(prepared.run.id, terminalStartSize)
      await delay(650)
      await window.effortless.writeAgentRun(prepared.run.id, `${prompt}\r`)
      return prepared.run
    },
    onSuccess: async (run) => {
      navigateToRunTab(run)
      setActiveEffortDrawer(null)
      await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['agent-runs', 'live-sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['app-state'] })
    },
  })

  useEffect(() => {
    if (!selectedEffortId && effortsQuery.data?.[0]) {
      setSelectedEffortId(effortsQuery.data[0].id)
    }
  }, [effortsQuery.data, selectedEffortId])

  useEffect(() => {
    if (!selectedEffort) return
    rememberActiveTerminalTabKey(activeTerminalTabKeyByEffortRef.current[selectedEffort.id] ?? 'main', selectedEffort.id)
  }, [rememberActiveTerminalTabKey, selectedEffort])

  useEffect(() => {
    setEffortDescriptionExpanded(false)
    setEffortMenuOpen(false)
  }, [selectedEffort?.id])

  useEffect(() => {
    if (!effortMenuOpen) return

    const handleMouseDown = (event: MouseEvent) => {
      if (!effortMenuRef.current?.contains(event.target as Node)) {
        setEffortMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEffortMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [effortMenuOpen])

  useEffect(() => {
    if (!appStateQuery.data) return
    if (observedAppVersion === null) {
      setObservedAppVersion(appStateQuery.data.version)
      return
    }
    if (appStateQuery.data.version !== observedAppVersion) {
      setObservedAppVersion(appStateQuery.data.version)
      void queryClient.invalidateQueries()
    }
  }, [appStateQuery.data, observedAppVersion, queryClient])

  useEffect(() => {
    return window.effortless.onAgentRunTerminalEvent((event) => {
      if (event.kind === 'started') {
        navigateToRunTab(event.body ?? 'main')
        void queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
        void queryClient.invalidateQueries({ queryKey: ['agent-runs', 'live-sessions'] })
        void queryClient.invalidateQueries({ queryKey: ['app-state'] })
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        void queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
        return
      }
      if (event.kind !== 'exit' && event.kind !== 'error') return
      void queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
      void queryClient.invalidateQueries({ queryKey: ['agent-runs', 'live-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['app-state'] })
      if (selectedEffort?.id) {
        void queryClient.invalidateQueries({ queryKey: ['tasks', selectedEffort.id] })
        void queryClient.invalidateQueries({ queryKey: ['attention'] })
      }
    })
  }, [navigateToRunTab, queryClient, selectedEffort?.id])

  useEffect(() => {
    if (preserveSelectionOnEffortChangeRef.current) {
      preserveSelectionOnEffortChangeRef.current = false
      return
    }

    setSelectedTaskId(null)
    setSelectedPlanId(null)
    setTaskCreateOpen(false)
    setFocusedInputId(null)
    setActiveEffortDrawer(null)
  }, [selectedEffort?.id])

  function resolveBaseCustomPalette(): ThemePalette {
    const themeId = appStateQuery.data?.theme
    const basePalette =
      themeId && themeId in THEME_PALETTES
        ? THEME_PALETTES[themeId as keyof typeof THEME_PALETTES]
        : THEME_PALETTES.phosphor
    return cloneThemePalette(basePalette)
  }

  function ensureCustomPalette(): ThemePalette {
    return customThemePalette ?? resolveBaseCustomPalette()
  }

  function handleActivateCustomTheme() {
    const palette = ensureCustomPalette()
    if (!customThemePalette) {
      setCustomThemePalette(palette)
    }
    applyThemePalette(palette)
    setCustomThemeActive(true)
    updateCustomThemeState.mutate({
      customThemeActive: true,
      customThemePalette: palette,
    })
  }

  function openEffortDrawer(drawer: EffortRailDrawer) {
    if (drawer === 'plan' && !supportsPlans) return
    if (drawer === 'tasks' && !supportsTasks) return
    setDrawerWidth(null)
    setActiveEffortDrawer((current) => {
      if (current === drawer) {
        setDrawerClosedAt((n) => n + 1)
        return null
      }
      return drawer
    })
  }

  function handleUpdateCustomTheme(palette: ThemePalette) {
    setCustomThemePalette(palette)
    setCustomThemeActive(true)
    updateCustomThemeState.mutate({
      customThemeActive: true,
      customThemePalette: palette,
    })
  }

  async function handleNotificationNavigate(notification: PendingNotification) {
    setSurfaceMode('effort')
    setSelectedEffortId(notification.effortId)

    if (notification.kind === 'task-review') {
      setSelectedTaskId(notification.entityId)
      setSelectedPlanId(null)
      openTaskPage(notification.entityId, notification.effortId)
      return
    }

    if (notification.kind === 'run-failed') {
      if (notification.taskId) {
        setSelectedTaskId(notification.taskId)
        setSelectedPlanId(null)
        openTaskPage(notification.taskId, notification.effortId)
      } else {
        setActiveEffortDrawer(null)
      }
      navigateToRunTab(notification.terminalTabKey ?? 'main', notification.effortId)
      return
    }

    if (notification.kind === 'input-request' || notification.kind === 'run-input-request') {
      setActiveEffortDrawer('inputs')
      const input = await window.effortless.getInputRequest(notification.entityShortRef)
      setFocusedInputId(input.id)
      if (input.taskId) {
        setSelectedTaskId(input.taskId)
        setSelectedPlanId(null)
      }
      if (notification.terminalTabKey) {
        navigateToRunTab(notification.terminalTabKey, notification.effortId)
        setActiveEffortDrawer(null)
      }
    }
  }

  useEffect(() => {
    if (!selectedPlanId && plansQuery.data?.[0]) {
      setSelectedPlanId(plansQuery.data[0].id)
    }
  }, [plansQuery.data, selectedPlanId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setActiveEffortDrawer(null)
      setDrawerClosedAt((n) => n + 1)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <main className={`app-shell ${sidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <TitleBar
        surfaceMode={surfaceMode}
        onSetSurfaceMode={setSurfaceMode}
        onAttentionNavigate={handleAttentionNavigate}
        onAttentionRunNavigate={handleAttentionRunNavigate}
      />
      {sidebarCollapsed ? (
        <aside className="collapsed-sidebar" aria-label="collapsed sidebar">
          <div className="collapsed-sidebar-stack">
            <button
              type="button"
              className="collapsed-sidebar-button"
              aria-label="expand sidebar"
              title="expand sidebar"
              onClick={() => setSidebarCollapsed(false)}
            >
              <ChevronsRight size={16} />
            </button>
            <NotificationFooter
              count={notificationCount}
              notifications={notifications}
              onNavigate={handleNotificationNavigate}
            />
            <button
              type="button"
              className="collapsed-sidebar-button"
              aria-label="create effort"
              title="create effort"
              onClick={() => setCreateEffortOpen(true)}
            >
              <Plus size={16} />
            </button>
            {surfaceMode === 'manage' ? (
              <div className="collapsed-sidebar-manage-nav" aria-label="manage sections">
                {MANAGE_SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`collapsed-sidebar-button collapsed-sidebar-button--subnav ${manageSection === id ? 'active' : ''}`}
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      setSurfaceMode('manage')
                      setManageSection(id)
                    }}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="collapsed-sidebar-efforts" aria-label="efforts">
            {(effortsQuery.data ?? []).map((effort) => (
              <CollapsedEffortDot
                key={effort.id}
                effort={effort}
                active={effort.id === selectedEffort?.id}
                pending={effortPendingMap.get(effort.id) ?? false}
                live={liveEffortIds.has(effort.id)}
                onClick={() => {
                  setSelectedEffortId(effort.id)
                  setSurfaceMode('effort')
                }}
              />
            ))}
          </div>
          <div className="collapsed-sidebar-footer" />
        </aside>
      ) : (
        <div className="sidebar-frame">
          <Sidebar
            efforts={effortsQuery.data ?? []}
            tasks={allTasksQuery.data ?? []}
            repos={reposQuery.data ?? []}
            selectedEffortId={selectedEffort?.id ?? null}
            surfaceMode={surfaceMode}
            manageSection={manageSection}
            onSelectEffort={(id) => setSelectedEffortId(id)}
            onSetSurfaceMode={setSurfaceMode}
            onSetManageSection={setManageSection}
            onOpenCreateEffort={() => setCreateEffortOpen(true)}
            effortPendingMap={effortPendingMap}
            liveEffortIds={liveEffortIds}
            notificationCount={notificationCount}
            notifications={notifications}
            onNavigateNotification={handleNotificationNavigate}
            onCollapseSidebar={() => setSidebarCollapsed(true)}
          />
        </div>
      )}

      <section className="effort-surface">
        <NotificationToast
          notifications={notifications}
          onNavigate={handleNotificationNavigate}
          isLoading={notificationsLoading}
          toastDurationSeconds={appStateQuery.data?.toastDurationSeconds ?? 5}
          osNotificationsEnabled={appStateQuery.data?.osNotificationsEnabled ?? true}
          soundNotificationsEnabled={appStateQuery.data?.soundNotificationsEnabled ?? false}
          bannerNotificationsEnabled={appStateQuery.data?.bannerNotificationsEnabled ?? true}
        />

        <div className={`surface-panel ${surfaceMode === 'manage' ? 'active' : 'hidden'}`}>
          <ManageSurface
            repos={reposQuery.data ?? []}
            agentProfiles={agentProfilesQuery.data ?? []}
            instructions={instructionsQuery.data ?? []}
            createRepo={repoMutations.createRepo.mutateAsync}
            updateRepo={repoMutations.updateRepo.mutateAsync}
            deleteRepo={repoMutations.deleteRepo.mutateAsync}
            createAgentProfile={createAgentProfile.mutateAsync}
            updateAgentProfile={updateAgentProfile.mutateAsync}
            deleteAgentProfile={deleteAgentProfile.mutateAsync}
            setInstructions={instructionsMutations.setInstructions.mutateAsync}
            deleteInstructions={instructionsMutations.deleteInstructions.mutateAsync}
            isCreatingRepo={repoMutations.createRepo.isPending}
            isUpdatingRepo={repoMutations.updateRepo.isPending}
            isDeletingRepo={repoMutations.deleteRepo.isPending}
            isCreatingAgentProfile={createAgentProfile.isPending}
            isUpdatingAgentProfile={updateAgentProfile.isPending}
            isDeletingAgentProfile={deleteAgentProfile.isPending}
            isSavingInstructions={instructionsMutations.setInstructions.isPending}
            isClearingInstructions={instructionsMutations.deleteInstructions.isPending}
            section={manageSection}
            notificationSettings={
              appStateQuery.data
                ? {
                    osNotificationsEnabled: appStateQuery.data.osNotificationsEnabled,
                    bannerNotificationsEnabled: appStateQuery.data.bannerNotificationsEnabled,
                    badgeNotificationsEnabled: appStateQuery.data.badgeNotificationsEnabled,
                    soundNotificationsEnabled: appStateQuery.data.soundNotificationsEnabled,
                    toastDurationSeconds: appStateQuery.data.toastDurationSeconds,
                  }
                : undefined
            }
            onUpdateNotificationSettings={(settings) =>
              updateNotificationSettings.mutate(settings)
            }
            isUpdatingNotificationSettings={updateNotificationSettings.isPending}
            currentTheme={appStateQuery.data?.theme ?? 'phosphor'}
            customTheme={ensureCustomPalette()}
            customThemeActive={customThemeActive}
            onUpdateTheme={(theme) => {
              setCustomThemeActive(false)
              updateCustomThemeState.mutate({
                customThemeActive: false,
                customThemePalette: ensureCustomPalette(),
              })
              updateNotificationSettings.mutate({ theme })
            }}
            onActivateCustomTheme={handleActivateCustomTheme}
            onUpdateCustomTheme={handleUpdateCustomTheme}
          />
        </div>

        {selectedEffort ? (
          <div className={`surface-panel surface-panel--effort ${surfaceMode === 'effort' ? 'active' : 'hidden'}`}>
            <header className="effort-header">
              <div className="effort-header-copy">
                <h2>{selectedEffort.title}</h2>
                <div className="effort-header-meta">
                  <span className="meta-line">
                    <Ref value={selectedEffort.shortRef} /> · {selectedEffort.template.replace('-', ' ')} ·{' '}
                    <Stamp label={selectedEffort.status} tone={statusTone(selectedEffort.status)} />
                    {activeEffortRunCount > 0 ? ` · ${activeEffortRunCount} live` : ''}
                  </span>
                </div>
                {(() => {
                  const descriptionPreview = selectedEffort.description.split(/\r?\n/, 1)[0]
                  const descriptionRest = selectedEffort.description.split(/\r?\n/).slice(1).join('\n').trim()
                  const hasSummary =
                    (selectedEffort.status === 'complete' || selectedEffort.status === 'archived') &&
                    Boolean(selectedEffort.summary)
                  const canExpand = Boolean(selectedEffort.description.trim()) || hasSummary
                  if (!descriptionPreview && !canExpand) {
                    return null
                  }

                  return (
                    <div className="effort-header-description">
                      <p className="effort-description-preview">
                        <span className="effort-description-preview-text">{descriptionPreview}</span>
                        {canExpand ? (
                          <button
                            type="button"
                            className="effort-description-toggle"
                            onClick={() => setEffortDescriptionExpanded((value) => !value)}
                          >
                            {effortDescriptionExpanded ? 'collapse' : 'expand'}
                          </button>
                        ) : null}
                      </p>
                      {effortDescriptionExpanded ? (
                        <div className="effort-description-expanded">
                          {descriptionRest ? (
                            <p className="effort-description-full">{descriptionRest}</p>
                          ) : null}
                          {hasSummary ? (
                            <>
                              {selectedEffort.template === 'investigation' ? (
                                <EffortSummarySection label="findings" summary={selectedEffort.summary} />
                              ) : null}
                              {selectedEffort.template === 'delivery' ? (
                                <EffortSummarySection label="effort summary" summary={selectedEffort.summary} />
                              ) : null}
                              {selectedEffort.template === 'bugfix' ? (
                                <EffortSummarySection label="bugfix summary" summary={selectedEffort.summary} />
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })()}
              </div>
              <div className="effort-header-controls">
                <label className="effort-profile-chip">
                  <small>provider</small>
                  <select
                    aria-label="effort default provider"
                    value={selectedEffort.defaultProvider}
                    onChange={(event) => {
                      updateEffortDefaultProvider.mutate({
                        effortId: selectedEffort.id,
                        provider: event.target.value as AgentProvider,
                      })
                    }}
                    disabled={updateEffortDefaultProvider.isPending}
                  >
                    {providers.map((provider) => (
                      <option key={provider.key} value={provider.key}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label className="effort-profile-chip">
                  <small>profile</small>
                  <select
                    aria-label="effort default profile"
                    value={selectedEffort.defaultProfileId == null ? '' : String(selectedEffort.defaultProfileId)}
                    onChange={(event) => {
                      updateEffortDefaultProfile.mutate({
                        effortId: selectedEffort.id,
                        profileId: event.target.value ? Number(event.target.value) : null,
                      })
                    }}
                    disabled={updateEffortDefaultProfile.isPending || (agentProfilesQuery.data?.length ?? 0) === 0}
                  >
                    <option value="">app default</option>
                    {(agentProfilesQuery.data ?? []).map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </label>
                <div ref={effortMenuRef} className="effort-menu-shell">
                  <button
                    className="effort-menu-trigger"
                    onClick={() => setEffortMenuOpen((open) => !open)}
                    type="button"
                    aria-label="effort menu"
                    aria-expanded={effortMenuOpen}
                    aria-haspopup="menu"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {effortMenuOpen ? (
                    <div className="effort-menu" role="menu">
                      <button
                        type="button"
                        className="effort-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setEffortMenuOpen(false)
                          setDeleteEffortOpen(true)
                        }}
                        disabled={deleteEffort.isPending}
                      >
                        <Trash2 size={13} />
                        <span>delete effort</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <div className="terminal-first-stage">
              <div className="terminal-first-canvas">
                <AgentRunTerminal
                  activeRun={activeTerminalRun}
                  activeRunHasLiveSession={activeTerminalRunHasLiveSession}
                  activeRunProviderLive={activeTerminalRunProviderLive}
                  tabs={terminalTabs}
                  taskSessionTabs={taskSessionTabs}
                  mountedRuns={mountedTerminalRuns}
                  availableTasks={(tasksQuery.data ?? []).map((task) => ({
                    id: task.id,
                    shortRef: task.shortRef,
                    title: task.title,
                  }))}
                  openTaskIds={openTaskPageIds}
                  activeTabKey={activeTerminalTabKey}
                  activeTaskFace={activeTaskTabFace}
                  isStarting={startEffortRun.isPending || resumeAgentRun.isPending || forkMainRun.isPending || startTaskRun.isPending || rerunTaskRun.isPending}
                  startDisabled={!ptyAvailable}
                  ptyAvailable={ptyAvailable}
                  emptyLabel="ready for effort"
                  workPane={activePageTask ? (
                    <TaskPage
                      task={activePageTask}
                      repos={reposQuery.data ?? []}
                      profiles={agentProfilesQuery.data ?? []}
                      defaultProvider={selectedEffort.defaultProvider}
                      defaultProfileId={selectedEffort.defaultProfileId ?? effortDefaultProfile?.id ?? null}
                      mainRunLive={Boolean(mainTerminalTab?.run && providerLiveRunIds.has(mainTerminalTab.run.id))}
                      taskRuns={activePageTaskRuns}
                      reviews={reviewsQuery.data ?? []}
                      comments={commentsQuery.data ?? []}
                      latestBuild={buildQuery.data ?? null}
                      commitView={commitsQuery.data ?? null}
                      conflictView={conflictsQuery.data ?? null}
                      onRunBuild={(taskId) => taskMutations.runBuild.mutate(taskId)}
                      onWorkOnTask={(input) => sendTaskToEffortSession.mutate(input)}
                      onStartTaskRun={(input) => startTaskRun.mutate(input)}
                      onRerunTaskRun={(input) => rerunTaskRun.mutate(input)}
                      onMergeTask={(taskId) => taskMutations.mergeTask.mutate(taskId)}
                      onApplyReview={(reviewId) => reviewMutations.applyReview.mutate({ reviewId })}
                      onRequestReviewChanges={(input) => reviewMutations.requestReviewChanges.mutate(input)}
                      isRunningBuild={taskMutations.runBuild.isPending}
                      isLaunchingTask={sendTaskToEffortSession.isPending || startTaskRun.isPending}
                      isRerunningTask={rerunTaskRun.isPending}
                      isMergingTask={taskMutations.mergeTask.isPending}
                      isApplyingReview={reviewMutations.applyReview.isPending}
                      isRequestingReviewChanges={reviewMutations.requestReviewChanges.isPending}
                    />
                  ) : null}
                  onCloseWorkTab={closeTaskPage}
                  onStart={() => {
                    startEffortRun.mutate({
                      effortId: selectedEffort.id,
                      provider: selectedEffort.defaultProvider,
                      profileId: selectedEffort.defaultProfileId ?? effortDefaultProfile?.id ?? null,
                    })
                  }}
                  onForkMain={() => forkMainRun.mutate()}
                  onResume={(runId) => resumeAgentRun.mutate(runId)}
                  onSelectTab={(key) => {
                    navigateToRunTab(key)
                  }}
                  onSetTaskFace={(taskId, face) => {
                    setTaskTabFaceByTaskId((current) => ({ ...current, [taskId]: face }))
                  }}
                  onSelectTaskRun={(taskId, runId) => {
                    setSelectedTaskRunIdByTaskId((current) => ({ ...current, [taskId]: runId }))
                    selectTaskTab(taskId, 'session', selectedEffort.id, runId)
                  }}
                  onStartTaskSession={(taskId) => {
                    const task = tasksQuery.data?.find((candidate) => candidate.id === taskId)
                    if (!task) return
                    startTaskRun.mutate({
                      task,
                      provider: selectedEffort.defaultProvider,
                      profileId: selectedEffort.defaultProfileId ?? effortDefaultProfile?.id ?? null,
                    })
                  }}
                  onOpenTaskPage={openTaskPage}
                  onStop={(runId) => taskMutations.stopAgentRun.mutate(runId)}
                  onTerminalSizeChange={setTerminalStartSize}
                  drawerClosedAt={drawerClosedAt}
                  forkMainDisabledReason={forkMainRun.isPending ? 'fork is starting' : forkMainDisabledReason}
                  dockInputs={dockVisibleInputs}
                  dockHiddenCount={dockHiddenCount}
                  onAnswerDockInput={(inputRequestId, answer) =>
                    answerInput.mutate({ inputRequestId, answer })
                  }
                  isAnsweringDockInput={answerInput.isPending}
                  onOpenInputsDrawer={openInputsDrawer}
                />
              </div>
              <aside className="effort-rail" aria-label="effort views">
                {[
                  { id: 'inputs' as const, label: 'inputs', Icon: CircleHelp, badge: String(inputsQuery.data?.length ?? 0) },
                  { id: 'tasks' as const, label: 'tasks', Icon: Hammer, badge: supportsTasks ? String(filteredTasks.length) : '', disabled: !supportsTasks },
                  { id: 'plan' as const, label: 'plan', Icon: ListOrdered, badge: supportsPlans ? String(plansQuery.data?.length ?? 0) : '', disabled: !supportsPlans },
                ].map(({ id, label, Icon, badge, disabled }) => (
                  <button
                    key={id}
                    type="button"
                    className={`effort-rail-button ${activeEffortDrawer === id ? 'active' : ''}`}
                    aria-label={label}
                    title={label}
                    disabled={disabled}
                    onClick={() => openEffortDrawer(id)}
                  >
                    <span className="rail-left">
                      <Icon size={16} />
                      <span>{label}</span>
                    </span>
                    {badge ? <small>{badge}</small> : null}
                  </button>
                ))}
              </aside>
              {activeEffortDrawer ? (
                <section
                  className={`effort-drawer effort-drawer--${activeEffortDrawer}`}
                  aria-label={`${activeEffortDrawer} drawer`}
                  style={drawerWidth ? { ['--drawer-width' as string]: `${drawerWidth}px` } : undefined}
                >
                  <div
                    className={`drawer-resize-handle ${drawerResizing ? 'dragging' : ''}`}
                    onMouseDown={handleDrawerResizeStart}
                  />
                  <header className="effort-drawer-header">
                    <div>
                      <span>view</span>
                      <h3>{effortDrawerTitle(activeEffortDrawer)}</h3>
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="close effort drawer"
                      title="close"
                      onClick={() => {
                        setActiveEffortDrawer(null)
                        setDrawerClosedAt((n) => n + 1)
                      }}
                    >
                      <X size={14} />
                    </button>
                  </header>
                  <div className="effort-drawer-body">
                    {activeEffortDrawer === 'inputs' ? (
                      <section className="input-section">
                        <InputRequestList
                          inputs={inputsQuery.data ?? []}
                          onAnswer={(inputRequestId, answer) =>
                            answerInput.mutate({ inputRequestId, answer })
                          }
                          isAnswering={answerInput.isPending}
                          focusedInputId={focusedInputId}
                        />
                      </section>
                    ) : null}
                    {activeEffortDrawer === 'plan' ? (
                      supportsPlans ? (
                        <PlanSection
                          plans={plansQuery.data ?? []}
                          selectedPlanId={selectedPlanId}
                          onSelectPlan={setSelectedPlanId}
                          planComments={planCommentsQuery.data ?? []}
                          onAcceptPlan={(planId) => planMutations.acceptPlan.mutate(planId)}
                          onRequestPlanChanges={(input) => planMutations.requestPlanChanges.mutate(input)}
                          isAcceptingPlan={planMutations.acceptPlan.isPending}
                          isRequestingPlanChanges={planMutations.requestPlanChanges.isPending}
                        />
                      ) : (
                        <p className="empty-state">no plan surface for this effort</p>
                      )
                    ) : null}
                    {activeEffortDrawer === 'tasks' ? (
                      supportsTasks ? (
                        <section className="task-drawer">
                          <div className="task-drawer-header">
                            {taskRepoOptions.length > 0 ? (
                              <select
                                aria-label="filter tasks by repo"
                                value={taskRepoFilter}
                                onChange={(e) => setTaskRepoFilter(e.target.value)}
                                disabled={taskRepoOptions.length <= 1}
                              >
                                <option value="all">all repos</option>
                                {taskRepoOptions.map(([repoId, repoName]) => (
                                  <option key={repoId} value={repoId}>{repoName}</option>
                                ))}
                              </select>
                            ) : (
                              <span />
                            )}
                            <button
                              type="button"
                              className="task-drawer-new"
                              onClick={() => setTaskCreateOpen((open) => !open)}
                            >
                              <Plus size={14} />
                              <span>{taskCreateOpen ? 'hide' : 'new'}</span>
                            </button>
                          </div>
                          {taskCreateOpen ? (
                            <div className="task-drawer-create">
                              <TaskCreationForm
                                effortId={selectedEffort.id}
                                repos={reposQuery.data ?? []}
                                isCreating={taskMutations.createTask.isPending}
                                onCreate={(input) => {
                                  taskMutations.createTask.mutate(input, {
                                    onSuccess: (task) => {
                                      setSelectedTaskId(task.id)
                                      setTaskCreateOpen(false)
                                      openTaskPage(task.id)
                                    },
                                  })
                                }}
                              />
                            </div>
                          ) : null}
                          <TaskList
                            tasks={filteredTasks}
                            selectedTaskId={activePageTaskId ?? selectedTaskId}
                            onSelectTask={openTaskPage}
                            pendingTaskIds={taskPendingInputIds}
                            runBadgeByTaskId={runBadgeByTaskId}
                            variant="drawer"
                          />
                        </section>
                      ) : (
                        <p className="empty-state">no task surface for this effort</p>
                      )
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        ) : (
          <div className={`surface-panel surface-panel--effort ${surfaceMode === 'effort' ? 'active' : 'hidden'}`}>
            <section className="no-effort-state">
              <div className="no-effort-state-content">
                <Home size={28} aria-hidden="true" />
                <span>no effort selected</span>
                <p>select an effort from the sidebar or create a new one</p>
                <button
                  type="button"
                  onClick={() => setCreateEffortOpen(true)}
                >
                  <Plus size={14} />
                  <span>new effort</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </section>

      {createEffortOpen ? (
        <div className="modal-overlay">
          <div className="modal-card create-effort-modal">
            <header className="modal-header create-effort-modal-header">
              <div>
                <h4>new effort</h4>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setCreateEffortOpen(false)}
                aria-label="close effort creation"
              >
                <X size={14} />
              </button>
            </header>
            <EffortCreationForm
              isPending={createEffort.isPending}
              onSubmit={(input) => {
                createEffort.mutate(input, {
                  onSuccess: (effort) => {
                    setSelectedEffortId(effort.id)
                    setSurfaceMode('effort')
                    setCreateEffortOpen(false)
                  },
                })
              }}
            />
          </div>
        </div>
      ) : null}

      {deleteEffortOpen && selectedEffort ? (
        <div className="modal-overlay">
          <div className="modal-card delete-effort-modal">
            <header className="modal-header delete-effort-modal-header">
              <div>
                <h4>delete effort</h4>
                <p>
                  Remove <strong>{selectedEffort.shortRef}</strong> and all of its plans, tasks,
                  reviews and inputs.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDeleteEffortOpen(false)}
                aria-label="close effort deletion"
              >
                <X size={14} />
              </button>
            </header>
            <div className="delete-effort-modal-body">
              <p className="delete-effort-modal-title">{selectedEffort.title}</p>
              <p className="delete-effort-modal-copy">
                This removes the effort from Effortless immediately.
              </p>
            </div>
            <div className="delete-effort-modal-actions">
              <button
                type="button"
                className="delete-effort-cancel-button"
                onClick={() => setDeleteEffortOpen(false)}
                disabled={deleteEffort.isPending}
              >
                cancel
              </button>
              <button
                type="button"
                className="delete-effort-confirm-button"
                disabled={deleteEffort.isPending}
                onClick={() => {
                  const efforts = effortsQuery.data ?? []
                  const selectedIndex = efforts.findIndex((effort) => effort.id === selectedEffort.id)
                  const fallbackEffort = efforts[selectedIndex + 1] ?? efforts[selectedIndex - 1] ?? null

                  deleteEffort.mutate(selectedEffort.id, {
                    onSuccess: () => {
                      setSelectedPlanId(null)
                      setSelectedTaskId(null)
                      setDeleteEffortOpen(false)
                      setSelectedEffortId(fallbackEffort?.id ?? null)
                    },
                  })
                }}
              >
                {deleteEffort.isPending ? 'deleting' : 'delete effort'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function terminalTabLabel(key: string): string {
  if (key === 'main') return 'main'
  if (key.startsWith('task-')) return key.replace(/^task-/, '')
  if (key.startsWith('review-')) return `review ${key.replace(/^review-/, '')}`
  if (key.startsWith('side-')) return `side ${key.replace(/^side-/, '')}`
  return key
}

function buildTaskWorkPrompt(task: Task): string {
  return [
    `Work on ${task.shortRef}.`,
    `First run: efl task context --task ${task.shortRef}`,
    'Use this main effort session. Update durable task state with efl as you work.',
  ].join(' ')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function CollapsedEffortDot({
  effort,
  active,
  pending,
  live,
  onClick,
}: {
  effort: { id: number; title: string; shortRef: string; status: string }
  active: boolean
  pending: boolean
  live: boolean
  onClick: () => void
}) {
  const [flyout, setFlyout] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`collapsed-sidebar-effort ${active ? 'active' : ''}`}
        aria-label={effort.title}
        onClick={onClick}
        onMouseEnter={() => {
          const rect = btnRef.current?.getBoundingClientRect()
          if (rect) setFlyout({ top: rect.top + rect.height / 2, left: rect.right + 8 })
        }}
        onMouseLeave={() => setFlyout(null)}
      >
        <span className={`collapsed-sidebar-effort-dot ${live ? 'live' : 'idle'}`} />
        {pending ? (
          <span className="collapsed-sidebar-effort-pending-badge">
            <WarningIndicator title="needs input" size={10} />
          </span>
        ) : null}
      </button>
      {flyout ? createPortal(
        <div
          className="collapsed-sidebar-effort-flyout"
          style={{ top: flyout.top, left: flyout.left }}
        >
          <span className="collapsed-sidebar-effort-flyout-title">{effort.title}</span>
          <span className="collapsed-sidebar-effort-flyout-meta">{effort.shortRef} · {effort.status}</span>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

function getDefaultDrawerWidth(drawer: EffortRailDrawer | null): number {
  switch (drawer) {
    case 'plan':
    case 'tasks':
      return 720
    case 'inputs':
      return 540
    default:
      return 480
  }
}

function effortDrawerTitle(drawer: EffortRailDrawer): string {
  switch (drawer) {
    case 'inputs':
      return 'inputs'
    case 'plan':
      return 'plan'
    case 'tasks':
      return 'tasks'
  }
}

export default App
