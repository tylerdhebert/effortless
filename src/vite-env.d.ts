/// <reference types="vite/client" />

import type {
  AnswerInputRequestInput,
  ApplyReviewInput,
  ApproveTaskInput,
  AgentProfile,
  AgentRun,
  CheckpointTaskInput,
  ClaimTaskInput,
  CreateAgentProfileInput,
  CreateEffortInput,
  DiffType,
  CreateInputRequestInput,
  CreateMandateInput,
  CreatePlanInput,
  CreateReferenceInput,
  CreateRepoInput,
  CreateTaskInput,
  Effort,
  EffortTemplate,
  InputRequest,
  Mandate,
  Plan,
  ActivityEvent,
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
  TaskConflictView,
  TaskDiffView,
  TemplatePlaybook,
  PrepareEffortRunInput,
  PrepareResumeRunInput,
  UpdateAgentProfileInput,
  UpdateMandateInput,
  UpdateRepoInput,
  UpdateTaskDetailsInput,
  UpdateTemplatePlaybookInput,
  WorkSurface,
} from '../core/types'

declare global {
interface Window {
  effortless: {
      platform: string
      minimizeWindow: () => Promise<void>
      maximizeWindow: () => Promise<void>
      closeWindow: () => Promise<void>
      isWindowMaximized: () => Promise<boolean>
      getAppState: () => Promise<{
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
      }>
      browsePath: (targetPath?: string | null, includeFiles?: boolean) => Promise<{
        path: string
        sep: string
        parent: string | null
        entries: Array<{ name: string; isDir: boolean }>
      }>
      openPath: (targetPath: string) => Promise<void>
      listRepos: () => Promise<Repo[]>
      createRepo: (input: CreateRepoInput) => Promise<Repo>
      updateRepo: (input: UpdateRepoInput) => Promise<Repo>
      deleteRepo: (repoId: number) => Promise<void>
      listInputRequests: (effortId: number) => Promise<InputRequest[]>
      listPendingInputRequests: (effortId: number) => Promise<InputRequest[]>
      createInputRequest: (input: CreateInputRequestInput) => Promise<InputRequest>
      answerInputRequest: (input: AnswerInputRequestInput) => Promise<InputRequest>
      getInputRequest: (inputRef: string) => Promise<InputRequest>
      listEfforts: () => Promise<Effort[]>
      createEffort: (input: CreateEffortInput) => Promise<Effort>
      deleteEffort: (effortId: number) => Promise<void>
      updateEffortSummary: (effortId: number, summary: string) => Promise<Effort>
      listTasks: (effortId: number) => Promise<Task[]>
      listAllTasks: () => Promise<Task[]>
      createTask: (input: CreateTaskInput) => Promise<Task>
      listPlans: (effortId: number) => Promise<Plan[]>
      getPlan: (planRef: string) => Promise<Plan>
      listPlanComments: (planId: number) => Promise<ActivityEvent[]>
      createPlan: (input: CreatePlanInput) => Promise<Plan>
      acceptPlan: (planId: number) => Promise<Plan>
      markPlanReady: (planId: number) => Promise<Plan>
      requestPlanChanges: (input: RequestPlanChangesInput) => Promise<Plan>
      listTaskComments: (taskId: number) => Promise<ActivityEvent[]>
      getLatestTaskBuild: (taskId: number) => Promise<TaskBuildResult | null>
      runTaskBuild: (taskId: number) => Promise<TaskBuildResult>
      listReviews: (taskId: number) => Promise<Review[]>
      submitReview: (input: SubmitReviewInput) => Promise<Review>
      applyReview: (input: ApplyReviewInput) => Promise<Review>
      requestReviewChanges: (input: RequestReviewChangesInput) => Promise<Review>
      getReview: (reviewRef: string) => Promise<Review>
      claimTask: (input: ClaimTaskInput) => Promise<Task>
      checkpointTask: (input: CheckpointTaskInput) => Promise<ActivityEvent>
      markTaskReady: (taskId: number) => Promise<Task>
      mergeTask: (taskId: number) => Promise<Task>
      ensureTaskWorktree: (taskId: number) => Promise<Task>
      getTaskDiff: (taskId: number, type?: DiffType) => Promise<TaskDiffView>
      getTaskCommits: (taskId: number) => Promise<TaskCommitView>
      getTaskConflicts: (taskId: number) => Promise<TaskConflictView>
      updateTaskDetails: (input: UpdateTaskDetailsInput) => Promise<Task>
      listAgentProfiles: () => Promise<AgentProfile[]>
      createAgentProfile: (input: CreateAgentProfileInput) => Promise<AgentProfile>
      updateAgentProfile: (input: UpdateAgentProfileInput) => Promise<AgentProfile>
      listAgentRuns: (effortId?: number | null) => Promise<AgentRun[]>
      prepareEffortRun: (input: PrepareEffortRunInput) => Promise<{
        run: AgentRun
        profile: AgentProfile
        env: Record<string, string>
      }>
      prepareResumeRun: (input: PrepareResumeRunInput) => Promise<{
        run: AgentRun
        profile: AgentProfile
        env: Record<string, string>
      }>
      markAgentRunStarted: (runId: number) => Promise<AgentRun>
      markAgentRunExited: (runId: number, exitCode: number) => Promise<AgentRun>
      markAgentRunFailed: (runId: number, error: string) => Promise<AgentRun>
      getPtyRuntimeStatus: () => Promise<{ available: boolean; platform: NodeJS.Platform }>
      listActiveAgentRunIds: () => Promise<number[]>
      listActiveProviderRunIds: () => Promise<number[]>
      startAgentRun: (runId: number, size: { cols: number; rows: number }) => Promise<void>
      writeAgentRun: (runId: number, data: string) => Promise<void>
      resizeAgentRun: (runId: number, size: { cols: number; rows: number }) => Promise<void>
      stopAgentRun: (runId: number) => Promise<void>
      onAgentRunTerminalEvent: (handler: (event: {
        kind: 'data' | 'exit' | 'error'
        runId: number
        body?: string
        exitCode?: number
      }) => void) => () => void
      approveTask: (input: ApproveTaskInput) => Promise<Task>
      requestTaskChanges: (input: RequestTaskChangesInput) => Promise<Task>
      listMandates: () => Promise<Mandate[]>
      listMandatesBySurface: (workSurface: WorkSurface, repoId: number | null) => Promise<Mandate[]>
      createMandate: (input: CreateMandateInput) => Promise<Mandate>
      updateMandate: (input: UpdateMandateInput) => Promise<Mandate>
      deleteMandate: (mandateId: number) => Promise<void>
      resolveMandateText: (workSurface: WorkSurface, repoId: number | null) => Promise<string | null>
      listTemplatePlaybooks: () => Promise<TemplatePlaybook[]>
      updateTemplatePlaybook: (input: UpdateTemplatePlaybookInput) => Promise<TemplatePlaybook>
      resetTemplatePlaybook: (template: EffortTemplate) => Promise<TemplatePlaybook>
      listReferences: (ownerType: ReferenceOwnerType, ownerId: number) => Promise<Reference[]>
      createReference: (input: CreateReferenceInput) => Promise<Reference>
      deleteReference: (refId: number) => Promise<void>
      captureDebugScreenshot: (relativePath?: string) => Promise<{ path: string; sha256: string }>
      listPendingNotifications: () => Promise<Array<{
        id: number
        kind: 'task-review' | 'input-request'
        effortId: number
        effortShortRef: string
        effortTitle: string
        entityId: number
        entityShortRef: string
        entityType: string
        message: string
        startedAt: string
      }>>
      countPendingNotifications: () => Promise<number>
      showOSNotification: (title: string, body: string) => Promise<void>
      updateNotificationSettings: (settings: {
        osNotificationsEnabled?: boolean
        bannerNotificationsEnabled?: boolean
        badgeNotificationsEnabled?: boolean
        soundNotificationsEnabled?: boolean
        toastDurationSeconds?: number
        theme?: string
      }) => Promise<{
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
      }>
      updateCustomThemeState: (state: {
        customThemeActive: boolean
        customThemePalette: Record<string, string> | null
      }) => Promise<{
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
      }>
    }
  }
}
