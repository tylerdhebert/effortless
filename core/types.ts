export type EffortTemplate = 'bugfix' | 'delivery' | 'investigation' | 'discussion'

export type EffortStatus = 'active' | 'complete' | 'archived'

export type TaskStatus =
  | 'open'
  | 'in-flight'
  | 'reviewing'
  | 'changes-requested'
  | 'conflicted'
  | 'accepted'
  | 'merged'

export type TaskCommentKind = 'comment' | 'checkpoint' | 'input-request' | 'input-response' | 'approval'
export type MessageAuthor = 'user' | 'agent'
export type ReviewVerdict = 'approve' | 'request-changes'
export type BuildStatus = 'running' | 'passed' | 'failed'
export type InputRequestType = 'yesno' | 'choice' | 'text'
export type InputRequestStatus = 'pending' | 'answered'
export type PlanCommentKind = 'comment' | 'approval' | 'input-request' | 'input-response'
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
  acceptedPlanId: number | null
  planRequiresReview: boolean
  needsTasks: boolean
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
  authorAgentId: string | null
  createdAt: string
  accepted: boolean
  readyAt: string | null
  acceptedAt: string | null
  latestFeedbackBody: string | null
  latestFeedbackAt: string | null
}

export type PlanComment = {
  id: number
  planId: number
  author: 'user' | 'agent'
  agentId: string | null
  kind: PlanCommentKind
  body: string
  createdAt: string
}

export type DiscussionMessage = {
  id: number
  effortId: number
  author: MessageAuthor
  agentId: string | null
  body: string
  createdAt: string
}

export type Task = {
  id: number
  effortId: number
  shortRef: string
  title: string
  description: string
  status: TaskStatus
  ownerAgentId: string | null
  repoId: number | null
  branchName: string | null
  baseBranch: string | null
  worktreePath: string | null
  requiresReview: boolean
  reviewRequiresReview: boolean
  autoMerge: boolean
  conflictedAt: string | null
  conflictDetails: string | null
  mergedAt: string | null
  handoffSummary: string | null
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
  planId: number | null
  taskId: number | null
  reviewId: number | null
  agentId: string | null
  type: InputRequestType
  prompt: string
  choices: InputChoice[] | null
  answer: string | null
  status: InputRequestStatus
  requestedAt: string
  answeredAt: string | null
}

export type TaskComment = {
  id: number
  taskId: number
  author: 'user' | 'agent'
  agentId: string | null
  kind: TaskCommentKind
  body: string
  commitHash: string | null
  createdAt: string
}

export type Review = {
  id: number
  taskId: number
  shortRef: string
  verdict: ReviewVerdict
  body: string
  summary: string | null
  authorAgentId: string | null
  createdAt: string
  appliedAt: string | null
}

export type CreateEffortInput = {
  title: string
  description: string
  template: EffortTemplate
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
  handoffSummary?: string | null
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
  authorAgentId?: string | null
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
  authorAgentId?: string | null
}

export type RequestPlanChangesInput = {
  planId: number
  body: string
}

export type CreateDiscussionMessageInput = {
  effortId: number
  author: MessageAuthor
  agentId?: string | null
  body: string
}

export type CreateInputRequestInput = {
  effortId?: number | null
  planId?: number | null
  taskId?: number | null
  reviewId?: number | null
  agentId?: string | null
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

export type WorkSurface = 'effort' | 'plan' | 'task' | 'review' | 'discussion'
export type MandateSourceType = 'body' | 'file'

export type Mandate = {
  id: number
  shortRef: string
  workSurface: WorkSurface
  repoId: number | null
  sourceType: MandateSourceType
  body: string | null
  filePath: string | null
  updatedAt: string
}

export type CreateMandateInput = {
  workSurface: WorkSurface
  repoId?: number | null
  sourceType: MandateSourceType
  body?: string | null
  filePath?: string | null
}

export type UpdateMandateInput = {
  mandateId: number
  workSurface?: WorkSurface
  repoId?: number | null
  sourceType?: MandateSourceType
  body?: string | null
  filePath?: string | null
}

export type TemplatePlaybook = {
  template: EffortTemplate
  body: string
  updatedAt: string
}

export type UpdateTemplatePlaybookInput = {
  template: EffortTemplate
  body: string
}

export type ReferenceOwnerType = 'effort' | 'plan' | 'task' | 'review'
export type ReferenceTargetType = 'effort' | 'plan' | 'task' | 'review' | 'file'

export type Reference = {
  id: number
  shortRef: string
  ownerType: ReferenceOwnerType
  ownerId: number
  targetType: ReferenceTargetType
  targetId: number | null
  filePath: string | null
  label: string | null
  createdAt: string
}

export type CreateReferenceInput = {
  ownerType: ReferenceOwnerType
  ownerId: number
  targetType: ReferenceTargetType
  targetId?: number | null
  filePath?: string | null
  label?: string | null
}
