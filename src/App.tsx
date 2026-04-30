import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleHelp,
  Hammer,
  MessageSquare,
  ScrollText,
  Speech,
  X,
} from 'lucide-react'
import { DiscussionPanel } from './components/effort/DiscussionPanel'
import { DiscussionThreadItem } from './components/effort/DiscussionThreadItem'
import { EffortSummarySection } from './components/effort/EffortSummarySection'
import { EffortCreationForm } from './components/sidebar/EffortCreationForm'
import { InputRequestList } from './components/effort/InputRequestList'
import { ManageSurface } from './components/manage/ManageSurface'
import { NotificationToast } from './components/notifications/NotificationToast'

import { PlanSection } from './components/effort/PlanSection'
import { ReferenceSection } from './components/effort/ReferenceSection'
import { Sidebar } from './components/sidebar/Sidebar'
import { TaskDetailPane } from './components/task/TaskDetailPane'
import { TaskList } from './components/task/TaskList'
import {
  effortStatusColor,
  effortSupportsDiscussion,
  effortSupportsPlans,
  effortSupportsTasks,
} from './lib/helpers'
import { useDiscussionMutations } from './hooks/useDiscussionMutations'
import { useEffortMutations } from './hooks/useEffortMutations'
import { useInputMutations } from './hooks/useInputMutations'
import { useMandateMutations } from './hooks/useMandateMutations'
import { usePlanMutations } from './hooks/usePlanMutations'
import { useReferenceMutations } from './hooks/useReferenceMutations'
import { useRepoMutations } from './hooks/useRepoMutations'
import { useReviewMutations } from './hooks/useReviewMutations'
import { useTaskMutations } from './hooks/useTaskMutations'
import { useNotifications } from './hooks/useNotifications'
import type { Reference } from '../core/types'
import type { PendingNotification } from '../core/notifications'
import './App.css'

function App() {
  const queryClient = useQueryClient()
  const [surfaceMode, setSurfaceMode] = useState<'effort' | 'manage'>('effort')
  const [manageSection, setManageSection] = useState<'repos' | 'mandates' | 'notifications'>('repos')
  const [selectedEffortId, setSelectedEffortId] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [taskRepoFilter, setTaskRepoFilter] = useState<string>('all')
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const [discussionDraft, setDiscussionDraft] = useState('')
  const [createEffortOpen, setCreateEffortOpen] = useState(false)
  const [observedAppVersion, setObservedAppVersion] = useState<number | null>(null)
  const effortScrollRef = useRef<HTMLDivElement | null>(null)
  const preserveSelectionOnEffortChangeRef = useRef(false)

  const effortsQuery = useQuery({
    queryKey: ['efforts'],
    queryFn: () => window.effortless.listEfforts(),
  })

  const reposQuery = useQuery({
    queryKey: ['repos'],
    queryFn: () => window.effortless.listRepos(),
  })

  const mandatesQuery = useQuery({
    queryKey: ['mandates'],
    queryFn: () => window.effortless.listMandates(),
  })

  const appStateQuery = useQuery({
    queryKey: ['app-state'],
    queryFn: () => window.effortless.getAppState(),
    refetchInterval: 2000,
  })

  const { notifications, count: notificationCount } = useNotifications()

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

  const plansQuery = useQuery({
    queryKey: ['plans', selectedEffort?.id],
    queryFn: () => window.effortless.listPlans(selectedEffort!.id),
    enabled: Boolean(selectedEffort),
  })

  const discussionQuery = useQuery({
    queryKey: ['discussion', selectedEffort?.id],
    queryFn: () => window.effortless.listDiscussionMessages(selectedEffort!.id),
    enabled: Boolean(selectedEffort) && (discussionOpen || (selectedEffort ? effortSupportsDiscussion(selectedEffort.template) : false)),
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
  const supportsDiscussion = template ? effortSupportsDiscussion(template) : false
  const usesBugfixOverview = template === 'bugfix'
  const hasPendingPlan = (plansQuery.data ?? []).some((p) => p.readyAt && !p.acceptedAt)


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

  const { createEffort } = useEffortMutations()
  const repoMutations = useRepoMutations(selectedEffort?.id ?? null)
  const mandateMutations = useMandateMutations()
  const { createDiscussionMessage } = useDiscussionMutations(selectedEffort?.id ?? null)
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
    }) => window.effortless.updateNotificationSettings(settings),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['app-state'] })
    },
  })

  useEffect(() => {
    if (!selectedEffortId && effortsQuery.data?.[0]) {
      setSelectedEffortId(effortsQuery.data[0].id)
    }
  }, [effortsQuery.data, selectedEffortId])

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
    if (preserveSelectionOnEffortChangeRef.current) {
      preserveSelectionOnEffortChangeRef.current = false
      if (effortScrollRef.current) {
        effortScrollRef.current.scrollTop = 0
      }
      return
    }

    setSelectedTaskId(null)
    setSelectedPlanId(null)
    setDiscussionOpen(false)
    setDiscussionDraft('')
    if (effortScrollRef.current) {
      effortScrollRef.current.scrollTop = 0
    }
  }, [selectedEffort?.id])

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
            return
          }
        }
      }
    }
  }

  async function handleNotificationNavigate(notification: PendingNotification) {
    setSurfaceMode('effort')
    setSelectedEffortId(notification.effortId)
    setDiscussionOpen(false)

    if (notification.kind === 'plan-review') {
      setSelectedPlanId(notification.entityId)
      setSelectedTaskId(null)
      return
    }

    if (notification.kind === 'task-review') {
      setSelectedTaskId(notification.entityId)
      setSelectedPlanId(null)
      return
    }

    if (notification.kind === 'review-pass') {
      // notification.entityId is the task id for review-pass
      setSelectedTaskId(notification.entityId)
      setSelectedPlanId(null)
      return
    }

    if (notification.kind === 'input-request') {
      const input = await window.effortless.getInputRequest(notification.entityShortRef)
      if (input.planId) {
        setSelectedPlanId(input.planId)
        setSelectedTaskId(null)
      } else if (input.taskId) {
        setSelectedTaskId(input.taskId)
        setSelectedPlanId(null)
      } else if (input.reviewId) {
        const efforts = effortsQuery.data ?? await window.effortless.listEfforts()
        for (const effort of efforts) {
          const tasks = await window.effortless.listTasks(effort.id)
          for (const task of tasks) {
            const reviews = await window.effortless.listReviews(task.id)
            if (reviews.some((r) => r.id === input.reviewId)) {
              setSelectedTaskId(task.id)
              setSelectedPlanId(null)
              return
            }
          }
        }
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

  return (
    <main className="app-shell">
      <Sidebar
        efforts={effortsQuery.data ?? []}
        selectedEffortId={selectedEffort?.id ?? null}
        reposCount={reposQuery.data?.length ?? 0}
        mandatesCount={mandatesQuery.data?.length ?? 0}
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
      />

      <section className="effort-surface">
        <NotificationToast
          notifications={notifications}
          onNavigate={handleNotificationNavigate}
          toastDurationSeconds={appStateQuery.data?.toastDurationSeconds ?? 5}
          osNotificationsEnabled={appStateQuery.data?.osNotificationsEnabled ?? true}
          soundNotificationsEnabled={appStateQuery.data?.soundNotificationsEnabled ?? false}
          bannerNotificationsEnabled={appStateQuery.data?.bannerNotificationsEnabled ?? true}
        />

        {surfaceMode === 'manage' ? (
          <ManageSurface
            repos={reposQuery.data ?? []}
            mandates={mandatesQuery.data ?? []}
            createRepo={repoMutations.createRepo.mutateAsync}
            updateRepo={repoMutations.updateRepo.mutateAsync}
            deleteRepo={repoMutations.deleteRepo.mutateAsync}
            createMandate={mandateMutations.createMandate.mutateAsync}
            updateMandate={mandateMutations.updateMandate.mutateAsync}
            deleteMandate={mandateMutations.deleteMandate.mutateAsync}
            isCreatingRepo={repoMutations.createRepo.isPending}
            isUpdatingRepo={repoMutations.updateRepo.isPending}
            isDeletingRepo={repoMutations.deleteRepo.isPending}
            isCreatingMandate={mandateMutations.createMandate.isPending}
            isUpdatingMandate={mandateMutations.updateMandate.isPending}
            isDeletingMandate={mandateMutations.deleteMandate.isPending}
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
                className={`discussion-button ${discussionOpen ? 'active' : ''}`}
                onClick={() => {
                  if (supportsDiscussion) {
                    setDiscussionOpen((open) => !open)
                  }
                }}
                type="button"
                aria-label="open discussion"
                title={supportsDiscussion ? 'open discussion' : 'discussion is not part of this effort type'}
                disabled={!supportsDiscussion}
              >
                <MessageSquare size={18} />
              </button>
            </header>

            {discussionOpen ? (
              <DiscussionPanel
                messages={discussionQuery.data ?? []}
                draft={discussionDraft}
                onDraftChange={setDiscussionDraft}
                onSubmit={() => {
                  if (selectedEffort && discussionDraft.trim()) {
                    createDiscussionMessage.mutate(
                      {
                        effortId: selectedEffort.id,
                        author: 'user',
                        body: discussionDraft,
                      },
                      {
                        onSuccess: () => setDiscussionDraft(''),
                      },
                    )
                  }
                }}
                isPending={createDiscussionMessage.isPending}
                onClose={() => setDiscussionOpen(false)}
              />
            ) : null}

            <div
              ref={effortScrollRef}
              className={`effort-scroll ${supportsTasks ? 'effort-scroll--delivery' : 'effort-scroll--compact'}`}
            >
              {(selectedEffort.status === 'complete' || selectedEffort.status === 'archived') ? (
                <div style={{ padding: '0 30px', marginBottom: '18px' }}>
                  {selectedEffort.template === 'investigation' ? (
                    <EffortSummarySection label="findings" summary={selectedEffort.summary} />
                  ) : null}
                  {selectedEffort.template === 'discussion' ? (
                    <EffortSummarySection label="conversation recap" summary={selectedEffort.summary} />
                  ) : null}
                  {selectedEffort.template === 'delivery' ? (
                    <EffortSummarySection label="effort summary" summary={selectedEffort.summary} />
                  ) : null}
                  {selectedEffort.template === 'bugfix' ? (
                    <EffortSummarySection label="bugfix summary" summary={selectedEffort.summary} />
                  ) : null}
                </div>
              ) : null}

              <div
                className={`effort-overview-grid ${supportsDiscussion ? 'has-discussion' : 'no-discussion'} ${usesBugfixOverview ? 'bugfix-overview-grid' : ''}`}
              >
                <div className="effort-overview-main">
                  <section
                    className={`surface-section effort-description-section ${usesBugfixOverview ? 'bugfix-description-section' : ''}`}
                  >
                    <div className="section-title">
                      <span className="section-title-label">
                        <ScrollText size={14} />
                        <span>description</span>
                      </span>
                    </div>
                    <p className="effort-description">{selectedEffort.description}</p>
                  </section>

                  {supportsDiscussion ? (
                    <section className="surface-section discussion-summary-section">
                      <div className="section-title">
                        <span className="section-title-label">
                          <Speech size={14} />
                          <span>recent discussion</span>
                        </span>
                        <span>{discussionQuery.data?.length ?? 0} messages</span>
                      </div>
                      <div className="discussion-preview-list">
                        {(discussionQuery.data ?? []).length === 0 ? (
                          <p className="empty-state">no discussion yet</p>
                        ) : (
                          (discussionQuery.data ?? []).slice(0, 3).map((message) => (
                            <DiscussionThreadItem message={message} key={message.id} />
                          ))
                        )}
                      </div>
                    </section>
                  ) : null}
                </div>

                <div className="effort-overview-side">
                  <ReferenceSection
                    references={referencesQuery.data ?? []}
                    effortId={selectedEffort.id}
                    isCreating={referenceMutations.createReference.isPending}
                    isDeleting={referenceMutations.deleteReference.isPending}
                    onAddReference={(input) => referenceMutations.createReference.mutate(input)}
                    onRemoveReference={(refId) => referenceMutations.deleteReference.mutate(refId)}
                    onOpenReference={(reference) => void openReference(reference)}
                  />

                  <section className="surface-section input-section">
                    <div className="section-title">
                      <span className="section-title-label">
                        <CircleHelp size={14} />
                        <span>inputs ({inputsQuery.data?.length ?? 0})</span>
                      </span>
                      <span>{pendingInputCount} pending</span>
                    </div>
                    <InputRequestList
                      inputs={inputsQuery.data ?? []}
                      onAnswer={(inputRequestId, answer) =>
                        answerInput.mutate({ inputRequestId, answer })
                      }
                      isAnswering={answerInput.isPending}
                    />
                  </section>
                </div>
              </div>

              {supportsPlans ? (
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
                  hasPendingPlan={hasPendingPlan}
                />
              ) : null}

              {supportsTasks ? (
                <section className="surface-section task-section">
                  <div className="section-title">
                    <span className="section-title-label">
                      <Hammer size={14} />
                      <span>tasks ({filteredTasks.length})</span>
                    </span>
                  </div>
                  {taskRepoOptions.length > 0 ? (
                    <div className="task-repo-filter">
                      <select
                        value={taskRepoFilter}
                        onChange={(e) => setTaskRepoFilter(e.target.value)}
                        disabled={taskRepoOptions.length <= 1}
                      >
                        <option value="all">all repos</option>
                        {taskRepoOptions.map(([repoId, repoName]) => (
                          <option key={repoId} value={repoId}>{repoName}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="task-workspace">
                    <TaskList
                      tasks={filteredTasks}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={setSelectedTaskId}
                      pendingTaskIds={taskPendingInputIds}
                    />
                    <TaskDetailPane
                      task={selectedTask}
                      repos={reposQuery.data ?? []}
                      reviews={reviewsQuery.data ?? []}
                      comments={commentsQuery.data ?? []}
                      latestBuild={buildQuery.data ?? null}
                      commitView={commitsQuery.data ?? null}
                      conflictView={conflictsQuery.data ?? null}
                      onRunBuild={(taskId) => taskMutations.runBuild.mutate(taskId)}
                      onApplyReview={(reviewId) => reviewMutations.applyReview.mutate({ reviewId })}
                      onRequestReviewChanges={(input) => reviewMutations.requestReviewChanges.mutate(input)}
                      isRunningBuild={taskMutations.runBuild.isPending}
                      isApplyingReview={reviewMutations.applyReview.isPending}
                      isRequestingReviewChanges={reviewMutations.requestReviewChanges.isPending}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          </>
        ) : (
          <p className="empty-state">no effort selected</p>
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
    </main>
  )
}

export default App
