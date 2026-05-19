import { useEffect, useMemo, useRef, useState } from 'react'
import { applyTheme, applyThemePalette, cloneThemePalette, THEME_PALETTES, type ThemePalette } from './themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleHelp,
  ChevronsRight,
  Glasses,
  Hammer,
  Home,
  ListOrdered,
  Plus,
  ScrollText,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import { EffortSummarySection } from './components/effort/EffortSummarySection'
import { EffortCreationForm } from './components/sidebar/EffortCreationForm'
import { InputRequestList } from './components/effort/InputRequestList'
import { ManageSurface } from './components/manage/ManageSurface'
import { NotificationFooter } from './components/notifications/NotificationFooter'
import { NotificationToast } from './components/notifications/NotificationToast'
import { TitleBar } from './components/ui/TitleBar'

import { PlanSection } from './components/effort/PlanSection'
import { ReferenceSection } from './components/effort/ReferenceSection'
import { Sidebar } from './components/sidebar/Sidebar'
import { AgentRunTerminal } from './components/task/AgentRunTerminal'
import { TaskCreationForm } from './components/task/TaskCreationForm'
import { TaskDetailPane } from './components/task/TaskDetailPane'
import { TaskList } from './components/task/TaskList'
import {
  effortStatusColor,
  effortSupportsPlans,
  effortSupportsTasks,
} from './lib/helpers'
import { MANAGE_SECTIONS, type ManageSection } from './lib/manageSections'
import { useEffortMutations } from './hooks/useEffortMutations'
import { useInputMutations } from './hooks/useInputMutations'
import { useMandateMutations } from './hooks/useMandateMutations'
import { usePlanMutations } from './hooks/usePlanMutations'
import { useReferenceMutations } from './hooks/useReferenceMutations'
import { useRepoMutations } from './hooks/useRepoMutations'
import { useReviewMutations } from './hooks/useReviewMutations'
import { useTaskMutations } from './hooks/useTaskMutations'
import { useNotifications } from './hooks/useNotifications'
import type { AgentRun, Reference, Task } from '../core/types'
import type { PendingNotification } from '../core/notifications'
import './App.css'

type EffortRailDrawer = 'description' | 'references' | 'inputs' | 'plan' | 'tasks'

const DEFAULT_TERMINAL_SIZE = { cols: 100, rows: 24 }
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
  const [activeEffortDrawer, setActiveEffortDrawer] = useState<EffortRailDrawer | null>(null)
  const [taskCreateOpen, setTaskCreateOpen] = useState(false)
  const [focusedInputId, setFocusedInputId] = useState<number | null>(null)
  const [terminalMenuOpen, setTerminalMenuOpen] = useState(false)
  const [drawerClosedAt, setDrawerClosedAt] = useState(0)
  const [observedAppVersion, setObservedAppVersion] = useState<number | null>(null)
  const [customThemePalette, setCustomThemePalette] = useState<ThemePalette | null>(null)
  const [customThemeActive, setCustomThemeActive] = useState(false)
  const preserveSelectionOnEffortChangeRef = useRef(false)

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

  const mandatesQuery = useQuery({
    queryKey: ['mandates'],
    queryFn: () => window.effortless.listMandates(),
  })

  const templatePlaybooksQuery = useQuery({
    queryKey: ['template-playbooks'],
    queryFn: () => window.effortless.listTemplatePlaybooks(),
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
        THEME_PALETTES[appStateQuery.data.theme as keyof typeof THEME_PALETTES] ?? THEME_PALETTES.grass
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

  const referencesQuery = useQuery({
    queryKey: ['references', 'effort', selectedEffort?.id],
    queryFn: () => window.effortless.listReferences('effort', selectedEffort!.id),
    enabled: Boolean(selectedEffort),
  })

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

  const selectedTask =
    tasksQuery.data?.find((task) => task.id === selectedTaskId) ?? tasksQuery.data?.[0] ?? null
  const pendingInputCount = inputsQuery.data?.filter((input) => input.status === 'pending').length ?? 0
  const template = selectedEffort?.template ?? null
  const supportsPlans = template ? effortSupportsPlans(template) : false
  const supportsTasks = template ? effortSupportsTasks(template) : false
  const usesBugfixOverview = template === 'bugfix'


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

  const commentsQuery = useQuery({
    queryKey: ['task-comments', selectedTask?.id],
    queryFn: () => window.effortless.listTaskComments(selectedTask!.id),
    enabled: Boolean(selectedTask),
  })

  const reviewsQuery = useQuery({
    queryKey: ['reviews', selectedTask?.id],
    queryFn: () => window.effortless.listReviews(selectedTask!.id),
    enabled: Boolean(selectedTask),
  })

  const buildQuery = useQuery({
    queryKey: ['task-build', selectedTask?.id],
    queryFn: () => window.effortless.getLatestTaskBuild(selectedTask!.id),
    enabled: Boolean(selectedTask),
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

  const activeProviderRunIdsQuery = useQuery({
    queryKey: ['agent-runs', 'active-provider-ids'],
    queryFn: () => window.effortless.listActiveProviderRunIds(),
    refetchInterval: 1000,
  })

  const activeProviderRunIds = useMemo(
    () => new Set(activeProviderRunIdsQuery.data ?? []),
    [activeProviderRunIdsQuery.data],
  )

  const terminalTabs = useMemo(() => {
    const runs = effortRunsQuery.data ?? []
    const profiles = agentProfilesQuery.data ?? []
    const tasks = tasksQuery.data ?? []
    const tabKeys = new Set<string>(['main'])
    tabKeys.add(activeTerminalTabKey)
    for (const run of runs) {
      tabKeys.add(run.terminalTabKey ?? 'main')
    }
    return Array.from(tabKeys).map((key) => {
      const tabRuns = runs.filter((run) => (run.terminalTabKey ?? 'main') === key)
      const run =
        tabRuns.find((candidate) => activeProviderRunIds.has(candidate.id)) ??
        tabRuns[0] ??
        null
      return {
        key,
        label: terminalTabLabel(key),
        run,
        runLive: run ? activeProviderRunIds.has(run.id) : false,
        profileLabel: run
          ? profiles.find((profile) => profile.id === run.profileId)?.name ?? `profile-${run.profileId}`
          : null,
        taskId: run?.taskId ?? null,
        purpose: run?.purpose ?? null,
        branchLabel: run?.taskId
          ? tasks.find((task) => task.id === run.taskId)?.branchName ?? 'no branch'
          : 'effort',
      }
    })
  }, [
    activeProviderRunIds,
    activeTerminalTabKey,
    effortRunsQuery.data,
    agentProfilesQuery.data,
    tasksQuery.data,
  ])

  useEffect(() => {
    if (!terminalTabs.some((tab) => tab.key === activeTerminalTabKey)) {
      setActiveTerminalTabKey('main')
    }
  }, [activeTerminalTabKey, terminalTabs])

  const activeTerminalRun = useMemo(() => {
    const tab = terminalTabs.find((candidate) => candidate.key === activeTerminalTabKey)
    return tab?.run ?? null
  }, [activeTerminalTabKey, terminalTabs])
  const activeTerminalRunLive = activeTerminalRun ? activeProviderRunIds.has(activeTerminalRun.id) : false
  const mountedTerminalRuns = useMemo(() => {
    const mounted = new Map<number, { run: AgentRun; runLive: boolean }>()
    for (const tab of terminalTabs) {
      if (!tab.run) continue
      mounted.set(tab.run.id, { run: tab.run, runLive: Boolean(tab.runLive) })
    }
    for (const run of allRunsQuery.data ?? []) {
      if (!activeProviderRunIds.has(run.id)) continue
      mounted.set(run.id, { run, runLive: true })
    }
    return Array.from(mounted.values())
  }, [terminalTabs, allRunsQuery.data, activeProviderRunIds])
  const mainTerminalTab = terminalTabs.find((tab) => tab.key === 'main') ?? null
  const mainTerminalProfile = mainTerminalTab?.run
    ? agentProfilesQuery.data?.find((profile) => profile.id === mainTerminalTab.run?.profileId) ?? null
    : null
  const forkMainDisabledReason = !mainTerminalTab?.run
    ? 'start main before forking'
    : !mainTerminalTab.run.providerSessionId
      ? 'main has no provider session id yet'
      : !mainTerminalProfile?.forkCommandTemplate
        ? 'profile has no fork command'
        : null

  async function refreshAgentRunState(tabKey?: string | null) {
    setActiveTerminalTabKey(tabKey ?? 'main')
    await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
    await queryClient.invalidateQueries({ queryKey: ['agent-runs', 'active-provider-ids'] })
    await queryClient.invalidateQueries({ queryKey: ['app-state'] })
  }

  const commitsQuery = useQuery({
    queryKey: ['task-commits', selectedTask?.id],
    queryFn: () => window.effortless.getTaskCommits(selectedTask!.id),
    enabled: Boolean(selectedTask),
  })

  const conflictsQuery = useQuery({
    queryKey: ['task-conflicts', selectedTask?.id],
    queryFn: () => window.effortless.getTaskConflicts(selectedTask!.id),
    enabled: Boolean(selectedTask),
  })

  const { createEffort, deleteEffort } = useEffortMutations(selectedEffort?.id ?? null)
  const repoMutations = useRepoMutations(selectedEffort?.id ?? null)
  const mandateMutations = useMandateMutations()
  const planMutations = usePlanMutations(
    selectedEffort?.id ?? null,
    selectedPlan?.id ?? null,
  )
  const taskMutations = useTaskMutations(selectedEffort?.id ?? null)
  const reviewMutations = useReviewMutations(selectedEffort?.id ?? null)
  const referenceMutations = useReferenceMutations(selectedEffort?.id ?? null)
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

  const updateTemplatePlaybook = useMutation({
    mutationFn: (input: { template: 'bugfix' | 'delivery' | 'investigation'; body: string }) =>
      window.effortless.updateTemplatePlaybook(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['template-playbooks'] }),
        queryClient.invalidateQueries({ queryKey: ['app-state'] }),
      ])
    },
  })

  const startEffortRun = useMutation({
    mutationFn: async (effortId: number) => {
      const prepared = await window.effortless.prepareEffortRun({ effortId, purpose: 'main' })
      await window.effortless.startAgentRun(prepared.run.id, DEFAULT_TERMINAL_SIZE)
      return prepared
    },
    onSuccess: async (prepared) => {
      await refreshAgentRunState(prepared.run.terminalTabKey)
    },
  })

  const resumeAgentRun = useMutation({
    mutationFn: async (runId: number) => {
      const prepared = await window.effortless.prepareResumeRun({ runId })
      await window.effortless.startAgentRun(prepared.run.id, DEFAULT_TERMINAL_SIZE)
      return prepared
    },
    onSuccess: async (prepared) => {
      await refreshAgentRunState(prepared.run.terminalTabKey)
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
      await window.effortless.startAgentRun(prepared.run.id, DEFAULT_TERMINAL_SIZE)
      return prepared
    },
    onSuccess: async (prepared) => {
      await refreshAgentRunState(prepared.run.terminalTabKey)
    },
  })

  const sendTaskToEffortSession = useMutation({
    mutationFn: async (task: Task) => {
      if (!selectedEffort) {
        throw new Error('Select an effort before sending task context.')
      }

      const mainRuns = (effortRunsQuery.data ?? []).filter(
        (run) => (run.terminalTabKey ?? 'main') === 'main',
      )
      const liveMainRun =
        mainRuns.find((run) => activeProviderRunIds.has(run.id)) ?? null
      const latestMainRun = mainRuns[0] ?? null
      const prompt = buildTaskWorkPrompt(task)

      if (liveMainRun) {
        await window.effortless.writeAgentRun(liveMainRun.id, `${prompt}\r`)
        return liveMainRun
      }

      if (latestMainRun?.providerSessionId) {
        const prepared = await window.effortless.prepareResumeRun({ runId: latestMainRun.id })
        await window.effortless.startAgentRun(prepared.run.id, DEFAULT_TERMINAL_SIZE)
        await delay(650)
        await window.effortless.writeAgentRun(prepared.run.id, `${prompt}\r`)
        return prepared.run
      }

      const prepared = await window.effortless.prepareEffortRun({ effortId: selectedEffort.id, purpose: 'main' })
      await window.effortless.startAgentRun(prepared.run.id, DEFAULT_TERMINAL_SIZE)
      await delay(650)
      await window.effortless.writeAgentRun(prepared.run.id, `${prompt}\r`)
      return prepared.run
    },
    onSuccess: async (run) => {
      setActiveTerminalTabKey(run.terminalTabKey ?? 'main')
      setActiveEffortDrawer(null)
      await queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['agent-runs', 'active-provider-ids'] })
      await queryClient.invalidateQueries({ queryKey: ['app-state'] })
    },
  })

  const resetTemplatePlaybook = useMutation({
    mutationFn: (template: 'bugfix' | 'delivery' | 'investigation') =>
      window.effortless.resetTemplatePlaybook(template),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['template-playbooks'] }),
        queryClient.invalidateQueries({ queryKey: ['app-state'] }),
      ])
    },
  })

  useEffect(() => {
    if (!selectedEffortId && effortsQuery.data?.[0]) {
      setSelectedEffortId(effortsQuery.data[0].id)
    }
  }, [effortsQuery.data, selectedEffortId])

  useEffect(() => {
    setActiveTerminalTabKey('main')
  }, [selectedEffortId])

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
      if (event.kind !== 'exit' && event.kind !== 'error') return
      void queryClient.invalidateQueries({ queryKey: ['agent-runs'] })
      void queryClient.invalidateQueries({ queryKey: ['agent-runs', 'active-provider-ids'] })
      void queryClient.invalidateQueries({ queryKey: ['app-state'] })
      if (selectedEffort?.id) {
        void queryClient.invalidateQueries({ queryKey: ['tasks', selectedEffort.id] })
      }
    })
  }, [queryClient, selectedEffort?.id])

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
        : THEME_PALETTES.grass
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
    setTerminalMenuOpen(false)
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

  async function openReference(reference: Reference) {
    if (reference.targetType === 'file') {
      if (reference.filePath) {
        await window.effortless.openPath(reference.filePath)
      }
      return
    }

    if (!reference.targetId) {
      return
    }

    setSurfaceMode('effort')

    if (reference.targetType === 'effort') {
      setSelectedEffortId(reference.targetId)
      return
    }

    const efforts = effortsQuery.data ?? await window.effortless.listEfforts()

    if (reference.targetType === 'plan') {
      for (const effort of efforts) {
        const plans = await window.effortless.listPlans(effort.id)
        if (plans.some((plan) => plan.id === reference.targetId)) {
          preserveSelectionOnEffortChangeRef.current = true
          setSelectedEffortId(effort.id)
          setSelectedPlanId(reference.targetId)
          setSelectedTaskId(null)
          setActiveEffortDrawer('plan')
          return
        }
      }
    }

    if (reference.targetType === 'task') {
      for (const effort of efforts) {
        const tasks = await window.effortless.listTasks(effort.id)
        if (tasks.some((task) => task.id === reference.targetId)) {
          preserveSelectionOnEffortChangeRef.current = true
          setSelectedEffortId(effort.id)
          setSelectedTaskId(reference.targetId)
          setSelectedPlanId(null)
          setActiveEffortDrawer('tasks')
          return
        }
      }
    }

    if (reference.targetType === 'review') {
      for (const effort of efforts) {
        const tasks = await window.effortless.listTasks(effort.id)
        for (const task of tasks) {
          const reviews = await window.effortless.listReviews(task.id)
          if (reviews.some((review) => review.id === reference.targetId)) {
            preserveSelectionOnEffortChangeRef.current = true
            setSelectedEffortId(effort.id)
            setSelectedTaskId(task.id)
            setSelectedPlanId(null)
            setActiveEffortDrawer('tasks')
            return
          }
        }
      }
    }
  }

  async function handleNotificationNavigate(notification: PendingNotification) {
    setSurfaceMode('effort')
    setSelectedEffortId(notification.effortId)

    if (notification.kind === 'task-review') {
      setSelectedTaskId(notification.entityId)
      setSelectedPlanId(null)
      setActiveEffortDrawer('tasks')
      return
    }

    if (notification.kind === 'input-request') {
      setActiveEffortDrawer('inputs')
      const input = await window.effortless.getInputRequest(notification.entityShortRef)
      setFocusedInputId(input.id)
      if (input.taskId) {
        setSelectedTaskId(input.taskId)
        setSelectedPlanId(null)
      }
    }
  }

  useEffect(() => {
    if (!selectedPlanId && plansQuery.data?.[0]) {
      setSelectedPlanId(plansQuery.data[0].id)
    }
  }, [plansQuery.data, selectedPlanId])

  useEffect(() => {
    if (!selectedTaskId && tasksQuery.data?.[0]) {
      setSelectedTaskId(tasksQuery.data[0].id)
    }
  }, [selectedTaskId, tasksQuery.data])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setActiveEffortDrawer(null)
      setTerminalMenuOpen(false)
      setDrawerClosedAt((n) => n + 1)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <main className={`app-shell ${sidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <TitleBar />
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
            <button
              type="button"
              className={`collapsed-sidebar-button ${surfaceMode === 'effort' ? 'active' : ''}`}
              aria-label="efforts"
              title="efforts"
              onClick={() => setSurfaceMode('effort')}
            >
              <Home size={16} />
            </button>
            <button
              type="button"
              className={`collapsed-sidebar-button ${surfaceMode === 'manage' ? 'active' : ''}`}
              aria-label="manage"
              title="manage"
              onClick={() => {
                setSurfaceMode('manage')
                setManageSection(manageSection)
              }}
            >
              <Settings size={16} />
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
            <button
              type="button"
              className="collapsed-sidebar-button"
              aria-label="create effort"
              title="create effort"
              onClick={() => setCreateEffortOpen(true)}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="collapsed-sidebar-footer">
            <NotificationFooter
              count={notificationCount}
              notifications={notifications}
              onNavigate={handleNotificationNavigate}
            />
          </div>
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

        {surfaceMode === 'manage' ? (
          <ManageSurface
            repos={reposQuery.data ?? []}
            agentProfiles={agentProfilesQuery.data ?? []}
            mandates={mandatesQuery.data ?? []}
            playbooks={templatePlaybooksQuery.data ?? []}
            createRepo={repoMutations.createRepo.mutateAsync}
            updateRepo={repoMutations.updateRepo.mutateAsync}
            deleteRepo={repoMutations.deleteRepo.mutateAsync}
            createAgentProfile={createAgentProfile.mutateAsync}
            updateAgentProfile={updateAgentProfile.mutateAsync}
            createMandate={mandateMutations.createMandate.mutateAsync}
            updateMandate={mandateMutations.updateMandate.mutateAsync}
            deleteMandate={mandateMutations.deleteMandate.mutateAsync}
            updateTemplatePlaybook={updateTemplatePlaybook.mutateAsync}
            resetTemplatePlaybook={resetTemplatePlaybook.mutateAsync}
            isCreatingRepo={repoMutations.createRepo.isPending}
            isUpdatingRepo={repoMutations.updateRepo.isPending}
            isDeletingRepo={repoMutations.deleteRepo.isPending}
            isCreatingAgentProfile={createAgentProfile.isPending}
            isUpdatingAgentProfile={updateAgentProfile.isPending}
            isCreatingMandate={mandateMutations.createMandate.isPending}
            isUpdatingMandate={mandateMutations.updateMandate.isPending}
            isDeletingMandate={mandateMutations.deleteMandate.isPending}
            isUpdatingPlaybook={updateTemplatePlaybook.isPending}
            isResettingPlaybook={resetTemplatePlaybook.isPending}
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
            currentTheme={appStateQuery.data?.theme ?? 'grass'}
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
        ) : selectedEffort ? (
          <>
            <header className="effort-header">
              <div className="effort-header-copy">
                <div className="effort-title-row">
                  <div style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                    <h2>{selectedEffort.title}</h2>
                    <div className="effort-header-meta">
                      <div className="chip-group">
                        <small>ref</small>
                        <span>{selectedEffort.shortRef}</span>
                      </div>
                      <div className="chip-group">
                        <small>type</small>
                        <span>{selectedEffort.template.replace('-', ' ')}</span>
                      </div>
                      <div className="chip-group">
                        <small>status</small>
                        <span style={{ borderColor: effortStatusColor(selectedEffort.status), boxShadow: `0 0 8px ${effortStatusColor(selectedEffort.status)}` }}>{selectedEffort.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                className="effort-delete-button"
                onClick={() => setDeleteEffortOpen(true)}
                type="button"
                aria-label="delete effort"
                title="delete effort"
                disabled={deleteEffort.isPending}
              >
                <Trash2 size={13} />
              </button>
            </header>

            <div className="terminal-first-stage">
              <div className="terminal-first-canvas">
                <AgentRunTerminal
                  activeRun={activeTerminalRun}
                  activeRunLive={activeTerminalRunLive}
                  tabs={terminalTabs}
                  mountedRuns={mountedTerminalRuns}
                  activeTabKey={activeTerminalTabKey}
                  isStarting={startEffortRun.isPending || resumeAgentRun.isPending || forkMainRun.isPending}
                  emptyLabel="ready for effort"
                  menuOpen={terminalMenuOpen}
                  onStart={() => {
                    startEffortRun.mutate(selectedEffort.id)
                  }}
                  onForkMain={() => forkMainRun.mutate()}
                  onResume={(runId) => resumeAgentRun.mutate(runId)}
                  onSelectTab={(key) => {
                    setActiveTerminalTabKey(key)
                    setTerminalMenuOpen(false)
                  }}
                  onOpenTask={(taskId) => {
                    setSelectedTaskId(taskId)
                    setActiveEffortDrawer('tasks')
                  }}
                  onStop={(runId) => taskMutations.stopAgentRun.mutate(runId)}
                  onToggleMenu={setTerminalMenuOpen}
                  drawerClosedAt={drawerClosedAt}
                  forkMainDisabledReason={forkMainRun.isPending ? 'fork is starting' : forkMainDisabledReason}
                />
              </div>
              <aside className="effort-rail" aria-label="effort views">
                {[
                  { id: 'description' as const, label: 'description', Icon: ScrollText, badge: selectedEffort.shortRef },
                  { id: 'references' as const, label: 'references', Icon: Glasses, badge: String(referencesQuery.data?.length ?? 0) },
                  { id: 'inputs' as const, label: 'inputs', Icon: CircleHelp, badge: pendingInputCount > 0 ? String(pendingInputCount) : String(inputsQuery.data?.length ?? 0) },
                  { id: 'plan' as const, label: 'plan', Icon: ListOrdered, badge: supportsPlans ? String(plansQuery.data?.length ?? 0) : '', disabled: !supportsPlans },
                  { id: 'tasks' as const, label: 'tasks', Icon: Hammer, badge: supportsTasks ? String(filteredTasks.length) : '', disabled: !supportsTasks },
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
                >
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
                    {activeEffortDrawer === 'description' ? (
                      <div className="drawer-stack">
                        {(selectedEffort.status === 'complete' || selectedEffort.status === 'archived') ? (
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
                        <section className={`effort-description-section ${usesBugfixOverview ? 'bugfix-description-section' : ''}`}>
                          <div className="drawer-effort-meta">
                            <div className="chip-group">
                              <small>ref</small>
                              <span>{selectedEffort.shortRef}</span>
                            </div>
                            <div className="chip-group">
                              <small>type</small>
                              <span>{selectedEffort.template.replace('-', ' ')}</span>
                            </div>
                            <div className="chip-group">
                              <small>status</small>
                              <span>{selectedEffort.status}</span>
                            </div>
                          </div>
                          <p className="effort-description">{selectedEffort.description}</p>
                        </section>
                      </div>
                    ) : null}
                    {activeEffortDrawer === 'references' ? (
                      <ReferenceSection
                        references={referencesQuery.data ?? []}
                        effortId={selectedEffort.id}
                        isCreating={referenceMutations.createReference.isPending}
                        isDeleting={referenceMutations.deleteReference.isPending}
                        onAddReference={(input) => referenceMutations.createReference.mutate(input)}
                        onRemoveReference={(refId) => referenceMutations.deleteReference.mutate(refId)}
                        onOpenReference={(reference) => void openReference(reference)}
                      />
                    ) : null}
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
                          onReadyPlan={(planId) => planMutations.readyPlan.mutate(planId)}
                          onRequestPlanChanges={(input) => planMutations.requestPlanChanges.mutate(input)}
                          isAcceptingPlan={planMutations.acceptPlan.isPending}
                          isReadyingPlan={planMutations.readyPlan.isPending}
                          isRequestingPlanChanges={planMutations.requestPlanChanges.isPending}
                        />
                      ) : (
                        <p className="empty-state">no plan surface for this effort</p>
                      )
                    ) : null}
                    {activeEffortDrawer === 'tasks' ? (
                      supportsTasks ? (
                        <section className="task-section">
                          <div className="task-workspace">
                            <div className="task-switcher-row">
                              <TaskList
                                tasks={filteredTasks}
                                selectedTaskId={selectedTaskId}
                                onSelectTask={setSelectedTaskId}
                                pendingTaskIds={taskPendingInputIds}
                                variant="strip"
                              />
                              <div className="task-switcher-actions">
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
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setTaskCreateOpen((open) => !open)}
                                >
                                  <Plus size={14} />
                                  <span>{taskCreateOpen ? 'hide' : 'new'}</span>
                                </button>
                              </div>
                            </div>
                            {taskCreateOpen ? (
                              <div className="task-create-drawer">
                                <TaskCreationForm
                                  effortId={selectedEffort.id}
                                  repos={reposQuery.data ?? []}
                                  isCreating={taskMutations.createTask.isPending}
                                  onCreate={(input) => {
                                    taskMutations.createTask.mutate(input, {
                                      onSuccess: (task) => {
                                        setSelectedTaskId(task.id)
                                        setTaskCreateOpen(false)
                                      },
                                    })
                                  }}
                                />
                              </div>
                            ) : null}
                            <TaskDetailPane
                              task={selectedTask}
                              repos={reposQuery.data ?? []}
                              reviews={reviewsQuery.data ?? []}
                              comments={commentsQuery.data ?? []}
                              latestBuild={buildQuery.data ?? null}
                              commitView={commitsQuery.data ?? null}
                              conflictView={conflictsQuery.data ?? null}
                              onRunBuild={(taskId) => taskMutations.runBuild.mutate(taskId)}
                              onWorkOnTask={(task) => sendTaskToEffortSession.mutate(task)}
                              onMergeTask={(taskId) => taskMutations.mergeTask.mutate(taskId)}
                              onApplyReview={(reviewId) => reviewMutations.applyReview.mutate({ reviewId })}
                              onRequestReviewChanges={(input) => reviewMutations.requestReviewChanges.mutate(input)}
                              isRunningBuild={taskMutations.runBuild.isPending}
                              isSendingTaskToTerminal={sendTaskToEffortSession.isPending}
                              isMergingTask={taskMutations.mergeTask.isPending}
                              isApplyingReview={reviewMutations.applyReview.isPending}
                              isRequestingReviewChanges={reviewMutations.requestReviewChanges.isPending}
                            />
                          </div>
                        </section>
                      ) : (
                        <p className="empty-state">no task surface for this effort</p>
                      )
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </>
        ) : (
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
                  reviews, inputs, and references.
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

function effortDrawerTitle(drawer: EffortRailDrawer): string {
  switch (drawer) {
    case 'description':
      return 'description'
    case 'references':
      return 'references'
    case 'inputs':
      return 'inputs'
    case 'plan':
      return 'plan'
    case 'tasks':
      return 'tasks'
  }
}

export default App
