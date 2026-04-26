import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { CollapsibleSection } from './components/CollapsibleSection'
import { DiscussionPanel } from './components/DiscussionPanel'
import { InputRequestList } from './components/InputRequestList'
import { ManageSurface } from './components/ManageSurface'
import { PlanSection } from './components/PlanSection'
import { ReferenceSection } from './components/ReferenceSection'
import { Sidebar } from './components/Sidebar'
import { TaskDetailPane } from './components/TaskDetailPane'
import { TaskList } from './components/TaskList'
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
  const [descriptionOpen, setDescriptionOpen] = useState(true)
  const [observedAppVersion, setObservedAppVersion] = useState<number | null>(null)

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
    enabled: Boolean(selectedEffort) && discussionOpen,
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
    setDiscussionDraft('')
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
        onCreateEffort={(input) => {
          createEffort.mutate(input, {
            onSuccess: (effort) => {
              setSelectedEffortId(effort.id)
              setSurfaceMode('effort')
            },
          })
        }}
        onSelectEffort={(id) => setSelectedEffortId(id)}
        onSetSurfaceMode={setSurfaceMode}
        onSetManageSection={setManageSection}
        isCreatingEffort={createEffort.isPending}
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
              <div className="effort-title-row">
                <h2>{selectedEffort.title}</h2>
                <div className="effort-header-meta">
                  <span>{selectedEffort.shortRef}</span>
                  <span>{selectedEffort.template.replace('-', ' ')}</span>
                  <span>{selectedEffort.status}</span>
                </div>
              </div>
              <button
                className={`discussion-button ${discussionOpen ? 'active' : ''}`}
                onClick={() => setDiscussionOpen((open) => !open)}
                type="button"
                aria-label="open discussion"
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
                    createDiscussionMessage.mutate({
                      effortId: selectedEffort.id,
                      author: 'user',
                      body: discussionDraft,
                    }, {
                      onSuccess: () => setDiscussionDraft(''),
                    })
                  }
                }}
                isPending={createDiscussionMessage.isPending}
                onClose={() => setDiscussionOpen(false)}
              />
            ) : null}

            <div className="effort-scroll">
              <CollapsibleSection
                title="description"
                open={descriptionOpen}
                onToggle={() => setDescriptionOpen((open) => !open)}
              >
                <p>{selectedEffort.description}</p>
              </CollapsibleSection>

              <div className="surface-row plan-ref-row">
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

                <ReferenceSection
                  references={referencesQuery.data ?? []}
                  effortId={selectedEffort.id}
                  isCreating={referenceMutations.createReference.isPending}
                  isDeleting={referenceMutations.deleteReference.isPending}
                  onAddReference={(input) => referenceMutations.createReference.mutate(input)}
                  onRemoveReference={(refId) => referenceMutations.deleteReference.mutate(refId)}
                />
              </div>

              {selectedEffort.needsTasks ? (
                <div className="surface-row tasks-row">
                  <section className="surface-section task-section">
                    <div className="section-title">
                      <span>tasks ({tasksQuery.data?.length ?? 0})</span>
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
                        onReadyTask={(taskId) => taskMutations.readyTask.mutate(taskId)}
                        onUpdateTaskDetails={(input) => taskMutations.updateTaskDetails.mutate(input)}
                        onEnsureTaskWorktree={(taskId) => taskMutations.ensureTaskWorktree.mutate(taskId)}
                        onRunBuild={(taskId) => taskMutations.runBuild.mutate(taskId)}
                        onSubmitReview={(input) => {
                          reviewMutations.submitReview.mutate(input, {
                            onSuccess: () => {
                            },
                          })
                        }}
                        onApplyReview={(reviewId) => reviewMutations.applyReview.mutate({ reviewId })}
                        onRequestReviewChanges={(input) => reviewMutations.requestReviewChanges.mutate(input)}
                        isReadyingTask={taskMutations.readyTask.isPending}
                        isUpdatingTask={taskMutations.updateTaskDetails.isPending}
                        isEnsuringWorktree={taskMutations.ensureTaskWorktree.isPending}
                        isRunningBuild={taskMutations.runBuild.isPending}
                        isSubmittingReview={reviewMutations.submitReview.isPending}
                        isApplyingReview={reviewMutations.applyReview.isPending}
                        isRequestingReviewChanges={reviewMutations.requestReviewChanges.isPending}
                      />
                    </div>
                  </section>

                  <section className="surface-section input-section">
                    <div className="section-title">
                      <span>inputs ({inputsQuery.data?.length ?? 0})</span>
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
              ) : (
                <section className="surface-section input-section">
                  <div className="section-title">
                    <span>inputs ({inputsQuery.data?.length ?? 0})</span>
                  </div>
                  <InputRequestList
                    inputs={inputsQuery.data ?? []}
                    onAnswer={(inputRequestId, answer) =>
                      answerInput.mutate({ inputRequestId, answer })
                    }
                    isAnswering={answerInput.isPending}
                  />
                </section>
              )}
            </div>
          </>
        ) : (
          <p className="empty-state">no effort selected</p>
        )}
      </section>
    </main>
  )
}

export default App