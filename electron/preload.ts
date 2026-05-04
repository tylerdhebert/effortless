import { contextBridge, ipcRenderer } from 'electron'
import type {
  AnswerInputRequestInput,
  ApplyReviewInput,
  ApproveTaskInput,
  CheckpointTaskInput,
  ClaimTaskInput,
  CreateEffortInput,
  CreateDiscussionMessageInput,
  DiffType,
  CreateInputRequestInput,
  CreateMandateInput,
  CreatePlanInput,
  CreateReferenceInput,
  CreateRepoInput,
  DiscussionMessage,
  Effort,
  EffortTemplate,
  InputRequest,
  Mandate,
  Plan,
  PlanComment,
  Reference,
  ReferenceOwnerType,
  Repo,
  RequestPlanChangesInput,
  RequestReviewChangesInput,
  RequestTaskChangesInput,
  Review,
  SubmitReviewInput,
  Task,
  TaskBuildResult,
  TaskCommitView,
  TaskComment,
  TaskConflictView,
  TaskDiffView,
  TemplatePlaybook,
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
  updateEffortPlanRequiresReview: (effortId: number, planRequiresReview: boolean) =>
    ipcRenderer.invoke('efforts:updatePlanRequiresReview', effortId, planRequiresReview) as Promise<Effort>,
  listTasks: (effortId: number) => ipcRenderer.invoke('tasks:list', effortId) as Promise<Task[]>,
  listAllTasks: () => ipcRenderer.invoke('tasks:listAll') as Promise<Task[]>,
  listPlans: (effortId: number) => ipcRenderer.invoke('plans:list', effortId) as Promise<Plan[]>,
  getPlan: (planRef: string) => ipcRenderer.invoke('plans:show', planRef) as Promise<Plan>,
  listPlanComments: (planId: number) =>
    ipcRenderer.invoke('plans:comments', planId) as Promise<PlanComment[]>,
  createPlan: (input: CreatePlanInput) => ipcRenderer.invoke('plans:create', input) as Promise<Plan>,
  acceptPlan: (planId: number) => ipcRenderer.invoke('plans:accept', planId) as Promise<Plan>,
  markPlanReady: (planId: number) => ipcRenderer.invoke('plans:ready', planId) as Promise<Plan>,
  requestPlanChanges: (input: RequestPlanChangesInput) =>
    ipcRenderer.invoke('plans:requestChanges', input) as Promise<Plan>,
  listDiscussionMessages: (effortId: number) =>
    ipcRenderer.invoke('discussion:list', effortId) as Promise<DiscussionMessage[]>,
  createDiscussionMessage: (input: CreateDiscussionMessageInput) =>
    ipcRenderer.invoke('discussion:create', input) as Promise<DiscussionMessage>,
  listTaskComments: (taskId: number) =>
    ipcRenderer.invoke('tasks:comments', taskId) as Promise<TaskComment[]>,
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
    ipcRenderer.invoke('tasks:checkpoint', input) as Promise<TaskComment>,
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
  updateTaskRequiresReview: (taskId: number, requiresReview: boolean) =>
    ipcRenderer.invoke('tasks:updateRequiresReview', taskId, requiresReview) as Promise<Task>,
  updateTaskReviewRequiresReview: (taskId: number, reviewRequiresReview: boolean) =>
    ipcRenderer.invoke('tasks:updateReviewRequiresReview', taskId, reviewRequiresReview) as Promise<Task>,
  updateTaskAutoMerge: (taskId: number, autoMerge: boolean) =>
    ipcRenderer.invoke('tasks:updateAutoMerge', taskId, autoMerge) as Promise<Task>,
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
  listReferences: (ownerType: ReferenceOwnerType, ownerId: number) =>
    ipcRenderer.invoke('references:list', ownerType, ownerId) as Promise<Reference[]>,
  createReference: (input: CreateReferenceInput) =>
    ipcRenderer.invoke('references:create', input) as Promise<Reference>,
  deleteReference: (refId: number) => ipcRenderer.invoke('references:delete', refId) as Promise<void>,
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
    }>,
})
