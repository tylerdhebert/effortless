/// <reference types="vite/client" />

import type { AttentionSnapshot } from '../core/attention'
import type { PendingNotification } from '../core/notifications'
import type { ThemePreference } from '../core/db'
import type { ProviderEnvironmentSetting } from '../core/providerSettings'
import type {
  AnswerInputRequestInput,
  ApplyReviewInput,
  ApproveTaskInput,
  AgentProvider,
  AgentRun,
  CheckpointTaskInput,
  ClaimTaskInput,
  CreateEffortInput,
  DiffType,
  CreateInputRequestInput,
  CreatePlanInput,
  CreateRepoInput,
  CreateTaskInput,
  Effort,
  InputRequest,
  Instructions,
  LiveAgentRunSession,
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
  PrepareEffortRunInput,
  PrepareForkRunInput,
  PrepareResumeRunInput,
  PrepareTaskRunInput,
  SetInstructionsInput,
  UpdateRepoInput,
  UpdateTaskDetailsInput,
  RunEnvironment,
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
        theme: ThemePreference
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
      listAttention: () => Promise<AttentionSnapshot>
      listInputRequests: (effortId: number) => Promise<InputRequest[]>
      listPendingInputRequests: (effortId: number) => Promise<InputRequest[]>
      createInputRequest: (input: CreateInputRequestInput) => Promise<InputRequest>
      answerInputRequest: (input: AnswerInputRequestInput) => Promise<InputRequest>
      getInputRequest: (inputRef: string) => Promise<InputRequest>
      listEfforts: () => Promise<Effort[]>
      createEffort: (input: CreateEffortInput) => Promise<Effort>
      deleteEffort: (effortId: number) => Promise<void>
      updateEffortSummary: (effortId: number, summary: string) => Promise<Effort>
      updateEffortDefaultProvider: (effortId: number, provider: AgentProvider) => Promise<Effort>
      listTasks: (effortId: number) => Promise<Task[]>
      listAllTasks: () => Promise<Task[]>
      createTask: (input: CreateTaskInput) => Promise<Task>
      listPlans: (effortId: number) => Promise<Plan[]>
      getPlan: (planRef: string) => Promise<Plan>
      listPlanComments: (planId: number) => Promise<ActivityEvent[]>
      createPlan: (input: CreatePlanInput) => Promise<Plan>
      acceptPlan: (planId: number) => Promise<Plan>
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
      listProviderSettings: () => Promise<ProviderEnvironmentSetting[]>
      updateProviderEnvironment: (input: { provider: AgentProvider; environment: RunEnvironment; wslDistro: string | null }) => Promise<ProviderEnvironmentSetting>
      listAgentRuns: (effortId?: number | null) => Promise<AgentRun[]>
      prepareEffortRun: (input: PrepareEffortRunInput) => Promise<{
        run: AgentRun
        provider: AgentProvider
        env: Record<string, string>
      }>
      prepareTaskRun: (input: PrepareTaskRunInput) => Promise<{
        run: AgentRun
        task: Task
        provider: AgentProvider
        env: Record<string, string>
      }>
      prepareResumeRun: (input: PrepareResumeRunInput) => Promise<{
        run: AgentRun
        provider: AgentProvider
        env: Record<string, string>
      }>
      prepareForkRun: (input: PrepareForkRunInput) => Promise<{
        run: AgentRun
        provider: AgentProvider
        env: Record<string, string>
      }>
      markAgentRunStarted: (runId: number) => Promise<AgentRun>
      markAgentRunExited: (runId: number, exitCode: number) => Promise<AgentRun>
      markAgentRunFailed: (runId: number, error: string) => Promise<AgentRun>
      getPtyRuntimeStatus: () => Promise<{ available: boolean; platform: NodeJS.Platform }>
      listActiveAgentRunIds: () => Promise<number[]>
      listActiveProviderRunIds: () => Promise<number[]>
      listLiveAgentRunSessions: () => Promise<LiveAgentRunSession[]>
      startAgentRun: (runId: number, size: { cols: number; rows: number }) => Promise<void>
      writeAgentRun: (runId: number, data: string) => Promise<void>
      resizeAgentRun: (runId: number, size: { cols: number; rows: number }) => Promise<void>
      stopAgentRun: (runId: number) => Promise<void>
      onAgentRunTerminalEvent: (handler: (event: {
        kind: 'data' | 'exit' | 'error' | 'started'
        runId: number
        body?: string
        exitCode?: number
      }) => void) => () => void
      approveTask: (input: ApproveTaskInput) => Promise<Task>
      requestTaskChanges: (input: RequestTaskChangesInput) => Promise<Task>
      listInstructions: () => Promise<Instructions[]>
      setInstructions: (input: SetInstructionsInput) => Promise<Instructions>
      deleteInstructions: (id: number) => Promise<void>
      captureDebugScreenshot: (relativePath?: string) => Promise<{ path: string; sha256: string }>
      listPendingNotifications: () => Promise<PendingNotification[]>
      showOSNotification: (title: string, body: string) => Promise<void>
      updateNotificationSettings: (settings: {
        osNotificationsEnabled?: boolean
        bannerNotificationsEnabled?: boolean
        badgeNotificationsEnabled?: boolean
        soundNotificationsEnabled?: boolean
        toastDurationSeconds?: number
        theme?: ThemePreference
      }) => Promise<{
        version: number
        updatedAt: string
        osNotificationsEnabled: boolean
        bannerNotificationsEnabled: boolean
        badgeNotificationsEnabled: boolean
        soundNotificationsEnabled: boolean
        toastDurationSeconds: number
        theme: ThemePreference
      }>
    }
  }
}
