export type EffortTemplate = 'bugfix' | 'delivery' | 'investigation'

export type EffortStatus = 'active' | 'complete' | 'archived'

export type TaskStatus =
  | 'open'
  | 'in-flight'
  | 'reviewing'
  | 'changes-requested'
  | 'conflicted'
  | 'accepted'
  | 'merged'

export type ReviewVerdict = 'approve' | 'request-changes'
export type BuildStatus = 'running' | 'passed' | 'failed'
export type InputRequestType = 'yesno' | 'choice' | 'text'
export type InputRequestStatus = 'pending' | 'answered'
export type DiffType = 'uncommitted' | 'branch' | 'combined'

export type Repo = {
  id: number
  shortRef: string
  name: string
  path: string
  baseBranch: string
  buildCommand: string | null
  createdAt: string
  updatedAt: string
}

export type Effort = {
  id: number
  shortRef: string
  title: string
  description: string
  template: EffortTemplate
  defaultProvider: AgentProvider
  defaultProfileId: number | null
  acceptedPlanId: number | null
  status: EffortStatus
  summary: string | null
  createdAt: string
  updatedAt: string
}

export type Plan = {
  id: number
  effortId: number
  shortRef: string
  body: string
  summary: string | null
  createdAt: string
  accepted: boolean
}

export type Task = {
  id: number
  effortId: number
  shortRef: string
  title: string
  description: string
  status: TaskStatus
  repoId: number | null
  branchName: string | null
  baseBranch: string | null
  worktreePath: string | null
  artifact: string | null
  createdAt: string
  updatedAt: string
}

export type TaskBuildResult = {
  id: number
  shortRef: string
  taskId: number
  status: BuildStatus
  output: string
  triggeredAt: string
  completedAt: string | null
}

export type TaskDiffView = {
  taskId: number
  type: DiffType
  output: string
}

export type TaskCommitView = {
  taskId: number
  output: string
}

export type TaskConflictView = {
  taskId: number
  hasConflicts: boolean
  files: string[]
  details: string | null
}

export type InputChoice = {
  value: string
  label: string
}

export type InputRequest = {
  id: number
  shortRef: string
  effortId: number
  taskId: number | null
  runId: number | null
  type: InputRequestType
  prompt: string
  choices: InputChoice[] | null
  answer: string | null
  status: InputRequestStatus
  requestedAt: string
  answeredAt: string | null
}

export type ActivityEvent = {
  id: number
  effortId: number
  taskId: number | null
  runId: number | null
  author: 'user' | 'agent'
  kind: string
  body: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export type Review = {
  id: number
  taskId: number
  shortRef: string
  verdict: ReviewVerdict
  body: string
  summary: string | null
  createdAt: string
}

export type CreateEffortInput = {
  title: string
  description: string
  template: EffortTemplate
  defaultProvider?: AgentProvider | null
  defaultProfileId?: number | null
}

export type CreateTaskInput = {
  effortId: number
  title: string
  description: string
  repoId?: number | null
  branchName?: string | null
  baseBranch?: string | null
}

export type UpdateTaskDetailsInput = {
  taskId: number
  repoId?: number | null
  branchName?: string | null
  baseBranch?: string | null
  artifact?: string | null
}

export type ClaimTaskInput = {
  taskId: number
  agentId: string
}

export type CheckpointTaskInput = {
  taskId: number
  agentId: string
  body: string
}

export type ApproveTaskInput = {
  taskId: number
  commitHash?: string | null
}

export type RequestTaskChangesInput = {
  taskId: number
  body: string
}

export type SubmitReviewInput = {
  taskId: number
  verdict: ReviewVerdict
  body: string
  summary?: string | null
}

export type ApplyReviewInput = {
  reviewId: number
  commitHash?: string | null
}

export type RequestReviewChangesInput = {
  reviewId: number
  body: string
}

export type CreatePlanInput = {
  effortId: number
  body: string
  summary?: string | null
}

export type RequestPlanChangesInput = {
  planId: number
  body: string
}

export type CreateInputRequestInput = {
  effortId?: number | null
  taskId?: number | null
  runId?: number | null
  type: InputRequestType
  prompt: string
  choices?: InputChoice[] | null
}

export type AnswerInputRequestInput = {
  inputRequestId: number
  answer: string
}

export type CreateRepoInput = {
  name: string
  path: string
  baseBranch: string
  buildCommand?: string | null
}

export type UpdateRepoInput = {
  repoId: number
  name: string
  path: string
  baseBranch: string
  buildCommand?: string | null
}

export type RunEnvironment = 'windows' | 'wsl'
export type AgentProvider = 'codex' | 'claude' | 'opencode' | 'cursor' | 'copilot'
export type AgentRunPurpose = 'main' | 'fork' | 'extra'
export type AgentRunStatus = 'prepared' | 'running' | 'orphaned' | 'exited' | 'failed' | 'cancelled'
export type LiveAgentRunSession = {
  attachmentId: string
  runId: number
  effortId: number
  taskId: number | null
  profileId: number
  provider: AgentProvider
  purpose: AgentRunPurpose
  terminalTabKey: string | null
  cwd: string
  providerSessionId: string | null
  providerLive: boolean
  cols: number
  rows: number
}

export type Instructions = {
  id: number
  shortRef: string
  repoId: number | null
  sourceType: 'body' | 'file'
  body: string | null
  filePath: string | null
  updatedAt: string
}

export type SetInstructionsInput = {
  repoId?: number | null
  sourceType: 'body' | 'file'
  body?: string | null
  filePath?: string | null
}

export type AgentProfile = {
  id: number
  shortRef: string
  name: string
  environment: RunEnvironment
  wslDistro: string | null
  defaultCwdKind: 'task_worktree' | 'repo_root' | 'custom'
  customCwd: string | null
  env: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type CreateAgentProfileInput = {
  name: string
  environment?: RunEnvironment
  wslDistro?: string | null
  defaultCwdKind?: AgentProfile['defaultCwdKind']
  customCwd?: string | null
  env?: Record<string, string>
}

export type UpdateAgentProfileInput = CreateAgentProfileInput & {
  profileId: number
}

export type AgentRun = {
  id: number
  shortRef: string
  effortId: number
  taskId: number | null
  profileId: number
  provider: AgentProvider
  purpose: AgentRunPurpose
  label: string
  status: AgentRunStatus
  environment: RunEnvironment
  cwd: string
  command: string
  providerSessionId: string | null
  terminalTabKey: string | null
  exitCode: number | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type PrepareTaskRunInput = {
  taskId: number
  provider?: AgentProvider | null
  profileId?: number | null
  purpose?: AgentRunPurpose
  label?: string
}

export type PrepareEffortRunInput = {
  effortId: number
  provider?: AgentProvider | null
  profileId?: number | null
  purpose?: AgentRunPurpose
  label?: string
}

export type PrepareResumeRunInput = {
  runId: number
}

export type PrepareForkRunInput = {
  sourceRunId: number
  prompt: string
  taskId?: number | null
  label?: string | null
}
