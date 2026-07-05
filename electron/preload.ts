import { contextBridge, ipcRenderer } from 'electron'
import type {
  AnswerInputRequestInput,
  ApplyReviewInput,
  ApproveTaskInput,
  AgentProfile,
  AgentProvider,
  AgentRun,
  CheckpointTaskInput,
  ClaimTaskInput,
  CreateAgentProfileInput,
  CreateEffortInput,
  DiffType,
  CreateInputRequestInput,
  CreateMandateInput,
  CreatePlanInput,
  CreateRepoInput,
  CreateTaskInput,
  Effort,
  EffortTemplate,
  InputRequest,
  LiveAgentRunSession,
  Mandate,
  Plan,
  ActivityEvent,
  Repo,
  RequestPlanChangesInput,
  RequestReviewChangesInput,
  RequestTaskChangesInput,
  Review,
  SubmitReviewInput,
  Task,
  TaskBuildResult,
  TaskCommitView,
  TaskConflictView,
  TaskDiffView,
  TemplatePlaybook,
  PrepareEffortRunInput,
  PrepareForkRunInput,
  PrepareResumeRunInput,
  PrepareTaskRunInput,
  UpdateAgentProfileInput,
  UpdateMandateInput,
  UpdateRepoInput,
  UpdateTaskDetailsInput,
  UpdateTemplatePlaybookInput,
  WorkSurface,
} from '../core/types'
import type { PendingNotification } from '../core/notifications'
import type { NotificationSettings } from '../core/db'

contextBridge.exposeInMainWorld('effortless', {
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  getAppState: () =>
    ipcRenderer.invoke('app-state:get') as Promise<{
      version: number
      updatedAt: string
      osNotificationsEnabled: boolean
      bannerNotificationsEnabled: boolean
      badgeNotificationsEnabled: boolean
      soundNotificationsEnabled: boolean
      toastDurationSeconds: number
      theme: string
      customThemeActive: boolean
      customThemePalette: Record<string, string> | null
    }>,
  browsePath: (targetPath?: string | null, includeFiles = false) =>
    ipcRenderer.invoke('filesystem:browse', targetPath, includeFiles) as Promise<{
      path: string
      sep: string
      parent: string | null
      entries: Array<{ name: string; isDir: boolean }>
    }>,
  openPath: (targetPath: string) =>
    ipcRenderer.invoke('filesystem:open', targetPath) as Promise<void>,
  listRepos: () => ipcRenderer.invoke('repos:list') as Promise<Repo[]>,
  createRepo: (input: CreateRepoInput) => ipcRenderer.invoke('repos:create', input) as Promise<Repo>,
  updateRepo: (input: UpdateRepoInput) => ipcRenderer.invoke('repos:update', input) as Promise<Repo>,
  deleteRepo: (repoId: number) => ipcRenderer.invoke('repos:delete', repoId) as Promise<void>,
  listInputRequests: (effortId: number) =>
    ipcRenderer.invoke('inputs:list', effortId) as Promise<InputRequest[]>,
  listPendingInputRequests: (effortId: number) =>
    ipcRenderer.invoke('inputs:pending', effortId) as Promise<InputRequest[]>,
  createInputRequest: (input: CreateInputRequestInput) =>
    ipcRenderer.invoke('inputs:create', input) as Promise<InputRequest>,
  answerInputRequest: (input: AnswerInputRequestInput) =>
    ipcRenderer.invoke('inputs:answer', input) as Promise<InputRequest>,
  getInputRequest: (inputRef: string) =>
    ipcRenderer.invoke('inputs:show', inputRef) as Promise<InputRequest>,
  listEfforts: () => ipcRenderer.invoke('efforts:list') as Promise<Effort[]>,
  createEffort: (input: CreateEffortInput) =>
    ipcRenderer.invoke('efforts:create', input) as Promise<Effort>,
  deleteEffort: (effortId: number) =>
    ipcRenderer.invoke('efforts:delete', effortId) as Promise<void>,
  updateEffortSummary: (effortId: number, summary: string) =>
    ipcRenderer.invoke('efforts:updateSummary', effortId, summary) as Promise<Effort>,
  updateEffortDefaultProfile: (effortId: number, profileId: number | null) =>
    ipcRenderer.invoke('efforts:updateDefaultProfile', effortId, profileId) as Promise<Effort>,
  updateEffortDefaultProvider: (effortId: number, provider: AgentProvider) =>
    ipcRenderer.invoke('efforts:updateDefaultProvider', effortId, provider) as Promise<Effort>,
  listTasks: (effortId: number) => ipcRenderer.invoke('tasks:list', effortId) as Promise<Task[]>,
  listAllTasks: () => ipcRenderer.invoke('tasks:listAll') as Promise<Task[]>,
  createTask: (input: CreateTaskInput) => ipcRenderer.invoke('tasks:create', input) as Promise<Task>,
  listPlans: (effortId: number) => ipcRenderer.invoke('plans:list', effortId) as Promise<Plan[]>,
  getPlan: (planRef: string) => ipcRenderer.invoke('plans:show', planRef) as Promise<Plan>,
  listPlanComments: (planId: number) =>
    ipcRenderer.invoke('plans:comments', planId) as Promise<ActivityEvent[]>,
  createPlan: (input: CreatePlanInput) => ipcRenderer.invoke('plans:create', input) as Promise<Plan>,
  acceptPlan: (planId: number) => ipcRenderer.invoke('plans:accept', planId) as Promise<Plan>,
  markPlanReady: (planId: number) => ipcRenderer.invoke('plans:ready', planId) as Promise<Plan>,
  requestPlanChanges: (input: RequestPlanChangesInput) =>
    ipcRenderer.invoke('plans:requestChanges', input) as Promise<Plan>,
  listTaskComments: (taskId: number) =>
    ipcRenderer.invoke('tasks:comments', taskId) as Promise<ActivityEvent[]>,
  getLatestTaskBuild: (taskId: number) =>
    ipcRenderer.invoke('builds:latest', taskId) as Promise<TaskBuildResult | null>,
  runTaskBuild: (taskId: number) =>
    ipcRenderer.invoke('builds:run', taskId) as Promise<TaskBuildResult>,
  listReviews: (taskId: number) => ipcRenderer.invoke('reviews:list', taskId) as Promise<Review[]>,
  submitReview: (input: SubmitReviewInput) =>
    ipcRenderer.invoke('reviews:submit', input) as Promise<Review>,
  applyReview: (input: ApplyReviewInput) =>
    ipcRenderer.invoke('reviews:apply', input) as Promise<Review>,
  requestReviewChanges: (input: RequestReviewChangesInput) =>
    ipcRenderer.invoke('reviews:requestChanges', input) as Promise<Review>,
  getReview: (reviewRef: string) => ipcRenderer.invoke('reviews:show', reviewRef) as Promise<Review>,
  claimTask: (input: ClaimTaskInput) => ipcRenderer.invoke('tasks:claim', input) as Promise<Task>,
  checkpointTask: (input: CheckpointTaskInput) =>
    ipcRenderer.invoke('tasks:checkpoint', input) as Promise<ActivityEvent>,
  markTaskReady: (taskId: number) => ipcRenderer.invoke('tasks:ready', taskId) as Promise<Task>,
  mergeTask: (taskId: number) => ipcRenderer.invoke('tasks:merge', taskId) as Promise<Task>,
  ensureTaskWorktree: (taskId: number) =>
    ipcRenderer.invoke('tasks:worktree', taskId) as Promise<Task>,
  getTaskDiff: (taskId: number, type: DiffType = 'combined') =>
    ipcRenderer.invoke('tasks:diff', taskId, type) as Promise<TaskDiffView>,
  getTaskCommits: (taskId: number) =>
    ipcRenderer.invoke('tasks:commits', taskId) as Promise<TaskCommitView>,
  getTaskConflicts: (taskId: number) =>
    ipcRenderer.invoke('tasks:conflicts', taskId) as Promise<TaskConflictView>,
  updateTaskDetails: (input: UpdateTaskDetailsInput) =>
    ipcRenderer.invoke('tasks:updateDetails', input) as Promise<Task>,
  listAgentProfiles: () =>
    ipcRenderer.invoke('agentProfiles:list') as Promise<AgentProfile[]>,
  createAgentProfile: (input: CreateAgentProfileInput) =>
    ipcRenderer.invoke('agentProfiles:create', input) as Promise<AgentProfile>,
  updateAgentProfile: (input: UpdateAgentProfileInput) =>
    ipcRenderer.invoke('agentProfiles:update', input) as Promise<AgentProfile>,
  deleteAgentProfile: (profileId: number) =>
    ipcRenderer.invoke('agentProfiles:delete', profileId) as Promise<void>,
  listAgentRuns: (effortId?: number | null) =>
    ipcRenderer.invoke('agentRuns:list', effortId ?? null) as Promise<AgentRun[]>,
  prepareEffortRun: (input: PrepareEffortRunInput) =>
    ipcRenderer.invoke('agentRuns:prepareEffort', input) as Promise<{
      run: AgentRun
      profile: AgentProfile
      provider: AgentProvider
      env: Record<string, string>
    }>,
  prepareTaskRun: (input: PrepareTaskRunInput) =>
    ipcRenderer.invoke('agentRuns:prepareTask', input) as Promise<{
      run: AgentRun
      task: Task
      profile: AgentProfile
      provider: AgentProvider
      env: Record<string, string>
    }>,
  prepareResumeRun: (input: PrepareResumeRunInput) =>
    ipcRenderer.invoke('agentRuns:prepareResume', input) as Promise<{
      run: AgentRun
      profile: AgentProfile
      provider: AgentProvider
      env: Record<string, string>
    }>,
  prepareForkRun: (input: PrepareForkRunInput) =>
    ipcRenderer.invoke('agentRuns:prepareFork', input) as Promise<{
      run: AgentRun
      profile: AgentProfile
      provider: AgentProvider
      env: Record<string, string>
    }>,
  markAgentRunStarted: (runId: number) =>
    ipcRenderer.invoke('agentRuns:markStarted', runId) as Promise<AgentRun>,
  markAgentRunExited: (runId: number, exitCode: number) =>
    ipcRenderer.invoke('agentRuns:markExited', runId, exitCode) as Promise<AgentRun>,
  markAgentRunFailed: (runId: number, error: string) =>
    ipcRenderer.invoke('agentRuns:markFailed', runId, error) as Promise<AgentRun>,
  getPtyRuntimeStatus: () =>
    ipcRenderer.invoke('agentRuns:ptyStatus') as Promise<{ available: boolean; platform: NodeJS.Platform }>,
  listActiveAgentRunIds: () =>
    ipcRenderer.invoke('agentRuns:activeIds') as Promise<number[]>,
  listActiveProviderRunIds: () =>
    ipcRenderer.invoke('agentRuns:activeProviderIds') as Promise<number[]>,
  listLiveAgentRunSessions: () =>
    ipcRenderer.invoke('agentRuns:liveSessions') as Promise<LiveAgentRunSession[]>,
  startAgentRun: (runId: number, size: { cols: number; rows: number }) =>
    ipcRenderer.invoke('agentRuns:start', runId, size) as Promise<void>,
  writeAgentRun: (runId: number, data: string) =>
    ipcRenderer.invoke('agentRuns:write', runId, data) as Promise<void>,
  resizeAgentRun: (runId: number, size: { cols: number; rows: number }) =>
    ipcRenderer.invoke('agentRuns:resize', runId, size) as Promise<void>,
  stopAgentRun: (runId: number) =>
    ipcRenderer.invoke('agentRuns:stop', runId) as Promise<void>,
  onAgentRunTerminalEvent: (handler: (event: {
    kind: 'data' | 'exit' | 'error' | 'started'
    runId: number
    body?: string
    exitCode?: number
  }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: {
      kind: 'data' | 'exit' | 'error' | 'started'
      runId: number
      body?: string
      exitCode?: number
    }) => handler(payload)
    ipcRenderer.on('agentRuns:terminalEvent', listener)
    return () => ipcRenderer.off('agentRuns:terminalEvent', listener)
  },
  approveTask: (input: ApproveTaskInput) =>
    ipcRenderer.invoke('tasks:approve', input) as Promise<Task>,
  requestTaskChanges: (input: RequestTaskChangesInput) =>
    ipcRenderer.invoke('tasks:requestChanges', input) as Promise<Task>,
  listMandates: () => ipcRenderer.invoke('mandates:list') as Promise<Mandate[]>,
  listMandatesBySurface: (workSurface: WorkSurface, repoId: number | null) =>
    ipcRenderer.invoke('mandates:listBySurface', workSurface, repoId) as Promise<Mandate[]>,
  createMandate: (input: CreateMandateInput) =>
    ipcRenderer.invoke('mandates:create', input) as Promise<Mandate>,
  updateMandate: (input: UpdateMandateInput) =>
    ipcRenderer.invoke('mandates:update', input) as Promise<Mandate>,
  deleteMandate: (mandateId: number) => ipcRenderer.invoke('mandates:delete', mandateId) as Promise<void>,
  resolveMandateText: (workSurface: WorkSurface, repoId: number | null) =>
    ipcRenderer.invoke('mandates:resolve', workSurface, repoId) as Promise<string | null>,
  listTemplatePlaybooks: () =>
    ipcRenderer.invoke('playbooks:list') as Promise<TemplatePlaybook[]>,
  updateTemplatePlaybook: (input: UpdateTemplatePlaybookInput) =>
    ipcRenderer.invoke('playbooks:update', input) as Promise<TemplatePlaybook>,
  resetTemplatePlaybook: (template: EffortTemplate) =>
    ipcRenderer.invoke('playbooks:reset', template) as Promise<TemplatePlaybook>,
  captureDebugScreenshot: (relativePath?: string) =>
    ipcRenderer.invoke('debug:capture-screenshot', relativePath) as Promise<{ path: string; sha256: string }>,
  listPendingNotifications: () =>
    ipcRenderer.invoke('notifications:list') as Promise<PendingNotification[]>,
  countPendingNotifications: () =>
    ipcRenderer.invoke('notifications:count') as Promise<number>,
  showOSNotification: (title: string, body: string) =>
    ipcRenderer.invoke('notifications:show-os', title, body) as Promise<void>,
  updateNotificationSettings: (settings: NotificationSettings) =>
    ipcRenderer.invoke('notifications:updateSettings', settings) as Promise<{
      version: number
      updatedAt: string
      osNotificationsEnabled: boolean
      bannerNotificationsEnabled: boolean
      badgeNotificationsEnabled: boolean
      soundNotificationsEnabled: boolean
      toastDurationSeconds: number
      theme: string
      customThemeActive: boolean
      customThemePalette: Record<string, string> | null
    }>,
  updateCustomThemeState: (state: {
    customThemeActive: boolean
    customThemePalette: Record<string, string> | null
  }) =>
    ipcRenderer.invoke('theme:custom:update', state) as Promise<{
      version: number
      updatedAt: string
      osNotificationsEnabled: boolean
      bannerNotificationsEnabled: boolean
      badgeNotificationsEnabled: boolean
      soundNotificationsEnabled: boolean
      toastDurationSeconds: number
      theme: string
      customThemeActive: boolean
      customThemePalette: Record<string, string> | null
    }>,
})
