import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleHelp,
  Hammer,
  MessageSquare,
  ScrollText,
  Speech,
  X,
} from 'lucide-react'
import { DiscussionPanel } from './components/DiscussionPanel'
import { DiscussionThreadItem } from './components/DiscussionThreadItem'
import { EffortCreationForm } from './components/EffortCreationForm'
import { InputRequestList } from './components/InputRequestList'
import { ManageSurface } from './components/ManageSurface'
import { PlanSection } from './components/PlanSection'
import { ReferenceSection } from './components/ReferenceSection'
import { Sidebar } from './components/Sidebar'
import { TaskDetailPane } from './components/TaskDetailPane'
import { TaskList } from './components/TaskList'
import {
  effortSupportsDiscussion,
  effortSupportsPlans,
  effortSupportsTasks,
  preferredDiscussionSummary,
  preferredPlanSummary,
} from './components/helpers'
import { useDiscussionMutations } from './hooks/useDiscussionMutations'
import { useEffortMutations } from './hooks/useEffortMutations'
import { useInputMutations } from './hooks/useInputMutations'
import { useMandateMutations } from './hooks/useMandateMutations'
import { usePlanMutations } from './hooks/usePlanMutations'
import { useReferenceMutations } from './hooks/useReferenceMutations'
import { useRepoMutations } from './hooks/useRepoMutations'
import { useReviewMutations } from './hooks/useReviewMutations'
import { useTaskMutations } from './hooks/useTaskMutations'
import './App.css'

function App() {
  const queryClient = useQueryClient()
  const [surfaceMode, setSurfaceMode] = useState<'effort' | 'manage'>('effort')
  const [manageSection, setManageSection] = useState<'repos' | 'mandates'>('repos')
  const [selectedEffortId, setSelectedEffortId] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [discussionOpen, setDiscussionOpen] = useState(false)
  const [discussionDraft, setDiscussionDraft] = useState('')
  const [createEffortOpen, setCreateEffortOpen] = useState(false)
  const [observedAppVersion, setObservedAppVersion] = useState<number | null>(null)
  const effortScrollRef = useRef<HTMLDivElement | null>(null)

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
  const preferredPlan = preferredPlanSummary(plansQuery.data ?? [])
  const preferredDiscussion = preferredDiscussionSummary(
    discussionQuery.data ?? [],
    inputsQuery.data ?? [],
  )

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
    setSelectedTaskId(null)
    setSelectedPlanId(null)
    setDiscussionOpen(false)
    setDiscussionDraft('')
    if (effortScrollRef.current) {
      effortScrollRef.current.scrollTop = 0
    }
  }, [selectedEffort?.id])

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
      />

      <section className="effort-surface">
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
          />
        ) : selectedEffort ? (
          <>
            <header className="effort-header">
              <div className="effort-header-copy">
                <div className="effort-title-row">
                  <h2>{selectedEffort.title}</h2>
                  <div className="effort-header-meta">
                    <span>{selectedEffort.shortRef}</span>
                    <span>{selectedEffort.template.replace('-', ' ')}</span>
                    <span>{selectedEffort.status}</span>
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
                          (discussionQuery.data ?? []).slice(-3).map((message) => (
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
                />
              ) : null}

              {selectedEffort.template === 'investigation' && !supportsPlans ? (
                <section className="surface-section template-summary-section">
                  <div className="section-title">
                    <span>findings</span>
                    <span>{preferredPlan?.plan.shortRef ?? 'no summary yet'}</span>
                  </div>
                  <div className="template-summary-body">
                    {preferredPlan ? (
                      <p>{preferredPlan.body}</p>
                    ) : (
                      <p className="empty-state">no findings yet</p>
                    )}
                  </div>
                </section>
              ) : null}

              {selectedEffort.template === 'discussion' ? (
                <section className="surface-section template-summary-section">
                  <div className="section-title">
                    <span>summary</span>
                    <span>{preferredDiscussion?.label ?? 'no summary yet'}</span>
                  </div>
                  <div className="template-summary-body">
                    {preferredDiscussion ? (
                      <p>{preferredDiscussion.body}</p>
                    ) : (
                      <p className="empty-state">no summary yet</p>
                    )}
                  </div>
                </section>
              ) : null}

              {supportsTasks ? (
                <section className="surface-section task-section">
                  <div className="section-title">
                    <span className="section-title-label">
                      <Hammer size={14} />
                      <span>tasks ({tasksQuery.data?.length ?? 0})</span>
                    </span>
                    {selectedTask ? <span>{selectedTask.status}</span> : null}
                  </div>
                  <div className="task-workspace">
                    <TaskList
                      tasks={tasksQuery.data ?? []}
                      selectedTaskId={selectedTaskId}
                      onSelectTask={setSelectedTaskId}
                    />
                    <TaskDetailPane
                      task={selectedTask}
                      repos={reposQuery.data ?? []}
                      reviews={reviewsQuery.data ?? []}
                      comments={commentsQuery.data ?? []}
                      latestBuild={buildQuery.data ?? null}
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
        <div className="flyout-overlay" onClick={() => setCreateEffortOpen(false)}>
          <div className="flyout-card create-effort-modal" onClick={(event) => event.stopPropagation()}>
            <header className="flyout-header create-effort-modal-header">
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
