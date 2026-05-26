import { useEffect, useMemo, useRef, useState } from 'react'
import type { Effort, Plan, Reference, ReferenceTargetType, Review, Task } from '../../../core/types'
import { ChevronDown, ChevronLeft, ChevronRight, List, Plus, Trash2, X } from 'lucide-react'
import { PathPicker } from '../ui/PathPicker'
import styles from './ReferenceSection.module.css'

type ReferenceTreeEffort = {
  effort: Effort
  plans: Plan[]
  tasks: Array<{
    task: Task
    reviews: Review[]
  }>
}

type ReferenceSectionProps = {
  references: Reference[]
  effortId: number
  isCreating: boolean
  isDeleting: boolean
  onAddReference: (input: {
    ownerType: 'effort' | 'plan' | 'task' | 'review'
    ownerId: number
    targetType: 'effort' | 'plan' | 'task' | 'review' | 'file'
    targetId?: number | null
    filePath?: string | null
    label?: string | null
  }) => void
  onRemoveReference: (refId: number) => void
  onOpenReference: (reference: Reference) => void
}

export function ReferenceSection({
  references,
  effortId,
  isCreating,
  isDeleting,
  onAddReference,
  onRemoveReference,
  onOpenReference,
}: ReferenceSectionProps) {
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [refTargetType, setRefTargetType] = useState<'effort' | 'plan' | 'task' | 'review' | 'file'>('file')
  const [refTargetId, setRefTargetId] = useState('')
  const [refFilePath, setRefFilePath] = useState('')
  const [refLabel, setRefLabel] = useState('')
  const [refError, setRefError] = useState<string | null>(null)
  const [targetTree, setTargetTree] = useState<ReferenceTreeEffort[]>([])
  const [targetTreeLoading, setTargetTreeLoading] = useState(false)
  const [targetTreeError, setTargetTreeError] = useState<string | null>(null)
  const [expandedEffortIds, setExpandedEffortIds] = useState<Set<number>>(() => new Set())
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(() => new Set())
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const listButtonRef = useRef<HTMLButtonElement | null>(null)

  const boundedIndex = Math.min(selectedIndex, Math.max(0, references.length - 1))
  const activeReference = references[boundedIndex] ?? null
  const counterLabel = references.length > 0 ? `${boundedIndex + 1} of ${references.length}` : 'no references'
  const trimmedTargetId = refTargetId.trim()
  const trimmedFilePath = refFilePath.trim()
  const trimmedLabel = refLabel.trim()
  const canSubmitReference =
    refTargetType === 'file' ? trimmedFilePath.length > 0 : /^[1-9]\d*$/.test(trimmedTargetId)
  const showTargetTree = refTargetType !== 'file'
  const selectedTarget = useMemo(
    () => findTreeTarget(targetTree, refTargetType, Number(trimmedTargetId)),
    [refTargetType, targetTree, trimmedTargetId],
  )

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, references.length - 1)))
  }, [references.length])

  useEffect(() => {
    if (!listOpen) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (!popoverRef.current?.contains(target) && !listButtonRef.current?.contains(target)) {
        setListOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [listOpen])

  useEffect(() => {
    if (!flyoutOpen || refTargetType === 'file') return

    let cancelled = false
    setTargetTreeLoading(true)
    setTargetTreeError(null)

    async function loadTargetTree() {
      try {
        const efforts = await window.effortless.listEfforts()
        const tree = await Promise.all(
          efforts.map(async (effort) => {
            const [plans, tasks] = await Promise.all([
              window.effortless.listPlans(effort.id),
              window.effortless.listTasks(effort.id),
            ])
            const tasksWithReviews = await Promise.all(
              tasks.map(async (task) => ({
                task,
                reviews: await window.effortless.listReviews(task.id),
              })),
            )
            return { effort, plans, tasks: tasksWithReviews }
          }),
        )

        if (!cancelled) {
          setTargetTree(tree)
          setExpandedEffortIds((current) => {
            if (current.size > 0) return current
            return new Set(tree.slice(0, 3).map((entry) => entry.effort.id))
          })
        }
      } catch {
        if (!cancelled) {
          setTargetTreeError('could not load reference targets')
        }
      } finally {
        if (!cancelled) {
          setTargetTreeLoading(false)
        }
      }
    }

    void loadTargetTree()

    return () => {
      cancelled = true
    }
  }, [flyoutOpen, refTargetType])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (refTargetType === 'file' && !trimmedFilePath) {
      setRefError('choose a file path')
      return
    }

    if (refTargetType !== 'file' && !/^[1-9]\d*$/.test(trimmedTargetId)) {
      setRefError('choose a reference target')
      return
    }

    onAddReference({
      ownerType: 'effort',
      ownerId: effortId,
      targetType: refTargetType,
      targetId: refTargetType !== 'file' ? Number(trimmedTargetId) : null,
      filePath: refTargetType === 'file' ? trimmedFilePath : null,
      label: trimmedLabel || null,
    })
    setRefTargetId('')
    setRefFilePath('')
    setRefLabel('')
    setRefError(null)
    setFlyoutOpen(false)
  }

  function closeFlyout() {
    setRefError(null)
    setFlyoutOpen(false)
  }

  function toggleExpandedEffort(effortId: number) {
    setExpandedEffortIds((current) => {
      const next = new Set(current)
      if (next.has(effortId)) {
        next.delete(effortId)
      } else {
        next.add(effortId)
      }
      return next
    })
  }

  function toggleExpandedTask(taskId: number) {
    setExpandedTaskIds((current) => {
      const next = new Set(current)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  function selectTarget(targetType: Exclude<ReferenceTargetType, 'file'>, targetId: number) {
    setRefTargetType(targetType)
    setRefTargetId(String(targetId))
    setRefError(null)
  }

  const activeReferenceBody = useMemo(() => {
    if (!activeReference) {
      return null
    }

    if (activeReference.targetType === 'file') {
      return activeReference.filePath
    }

    if (activeReference.targetId) {
      return `${activeReference.targetType}-${activeReference.targetId}`
    }

    return null
  }, [activeReference])

  return (
    <section className={`effort-zone ${styles['reference-section']}`}>
      <div className={styles['reference-toolbar']}>
        <span>{references.length} refs</span>
        <div className={styles['reference-title-actions']}>
          {references.length > 1 ? (
            <button
              ref={listButtonRef}
              type="button"
              onClick={() => setListOpen((open) => !open)}
              aria-label="show reference list"
              aria-expanded={listOpen}
              title="show reference list"
            >
              <List size={14} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setRefError(null)
              setFlyoutOpen(true)
            }}
            aria-label="add reference"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {listOpen ? (
        <div ref={popoverRef} className={styles['reference-popover']}>
          <div className={styles['reference-popover-title']}>all references</div>
          <div className={styles['reference-popover-list']}>
            {references.map((reference, index) => (
              <button
                key={reference.id}
                type="button"
                className={`${styles['reference-popover-item']} ${index === boundedIndex ? styles.selected : ''}`}
                onClick={() => {
                  setSelectedIndex(index)
                  setListOpen(false)
                }}
              >
                <strong>{reference.shortRef}</strong>
                <span>{reference.label ?? reference.targetType}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {flyoutOpen ? (
        <div className="modal-overlay">
          <div className={`modal-card ${styles['reference-modal-card']}`}>
            <header className={`modal-header ${styles['reference-modal-header']}`}>
              <h4>add reference</h4>
              <button type="button" onClick={closeFlyout} aria-label="close">
                <X size={14} />
              </button>
            </header>
            <form className={`modal-form ${styles['reference-form']}`} onSubmit={handleSubmit} noValidate>
              <div className={`${styles['reference-form-grid']} ${!showTargetTree ? styles['reference-form-grid--file'] : ''}`}>
                <div className={styles['reference-form-primary']}>
                  <label className={styles['reference-field']}>
                    <span>type</span>
                    <select
                      value={refTargetType}
                      onChange={(event) => {
                        setRefTargetType(
                          event.target.value as 'effort' | 'plan' | 'task' | 'review' | 'file',
                        )
                        setRefTargetId('')
                        setRefError(null)
                      }}
                    >
                      <option value="file">file</option>
                      <option value="effort">effort</option>
                      <option value="plan">plan</option>
                      <option value="task">task</option>
                      <option value="review">review</option>
                    </select>
                  </label>
                  {showTargetTree ? (
                    <label className={styles['reference-field']}>
                      <span>target</span>
                      <input
                        disabled
                        placeholder="choose an item from the tree"
                        value={selectedTarget?.label ?? ''}
                      />
                    </label>
                  ) : (
                    <label className={styles['reference-field']}>
                      <span>file path</span>
                    <PathPicker
                      ariaLabel="reference file path"
                      placeholder="file path"
                      selectFiles
                      value={refFilePath}
                      onChange={(value) => {
                        setRefFilePath(value)
                        setRefError(null)
                      }}
                    />
                    </label>
                  )}
                  <label className={styles['reference-field']}>
                    <span>label</span>
                    <input
                      placeholder="optional"
                      value={refLabel}
                      onChange={(event) => setRefLabel(event.target.value)}
                    />
                  </label>
                </div>
                {showTargetTree ? (
                  <div className={styles['reference-form-targets']}>
                    <div className={styles['reference-target-header']}>
                      <span>target</span>
                      <small>{refTargetType}</small>
                    </div>
                    <ReferenceTargetTree
                      targetType={refTargetType}
                      tree={targetTree}
                      isLoading={targetTreeLoading}
                      error={targetTreeError}
                      selectedTargetId={Number(trimmedTargetId)}
                      expandedEffortIds={expandedEffortIds}
                      expandedTaskIds={expandedTaskIds}
                      onToggleEffort={toggleExpandedEffort}
                      onToggleTask={toggleExpandedTask}
                      onSelectTarget={selectTarget}
                    />
                  </div>
                ) : null}
              </div>
              {refError ? <p className={styles['reference-error']}>{refError}</p> : null}
              <div className={styles['reference-submit-row']}>
                <button type="button" className={styles['reference-cancel']} onClick={closeFlyout}>
                  cancel
                </button>
                <button
                  type="submit"
                  className={styles['reference-submit']}
                  disabled={isCreating || !canSubmitReference}
                >
                  {isCreating ? 'adding' : 'add ref'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div
        className={
          activeReference
            ? `effort-zone-section ${styles['reference-preview-shell']}`
            : styles['reference-preview-shell']
        }
      >
        {activeReference ? (
          <>
            <h4>reference</h4>
            {references.length > 1 ? (
              <div className={styles['reference-preview-nav']}>
                <button
                  type="button"
                  className="pager-arrow"
                  onClick={() => setSelectedIndex((current) => Math.max(0, current - 1))}
                  disabled={boundedIndex === 0}
                  aria-label="previous reference"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{counterLabel}</span>
                <button
                  type="button"
                  className="pager-arrow"
                  onClick={() =>
                    setSelectedIndex((current) =>
                      Math.min(references.length - 1, current + 1),
                    )
                  }
                  disabled={boundedIndex === references.length - 1}
                  aria-label="next reference"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : null}

            <article className={`${styles['reference-card']} ${styles['reference-card--featured']}`}>
              <div className={styles['reference-card-header']}>
                <strong>{activeReference.shortRef}</strong>
                <span>{activeReference.targetType}</span>
                {activeReference.label ? <small>{activeReference.label}</small> : null}
                {(activeReference.targetType === 'file' && activeReference.filePath) ||
                (activeReference.targetType !== 'file' && activeReference.targetId) ? (
                  <button
                    type="button"
                    className={styles['reference-open-button']}
                    onClick={() => onOpenReference(activeReference)}
                  >
                    open
                  </button>
                ) : null}
                <button
                  type="button"
                  className="icon-btn remove-btn"
                  onClick={() => onRemoveReference(activeReference.id)}
                  disabled={isDeleting}
                  aria-label="remove reference"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {activeReferenceBody ? <p>{activeReferenceBody}</p> : null}
            </article>
          </>
        ) : (
          <p className="empty-state">no references</p>
        )}
      </div>
    </section>
  )
}

type ReferenceTargetTreeProps = {
  targetType: Exclude<ReferenceTargetType, 'file'>
  tree: ReferenceTreeEffort[]
  isLoading: boolean
  error: string | null
  selectedTargetId: number
  expandedEffortIds: Set<number>
  expandedTaskIds: Set<number>
  onToggleEffort: (effortId: number) => void
  onToggleTask: (taskId: number) => void
  onSelectTarget: (targetType: Exclude<ReferenceTargetType, 'file'>, targetId: number) => void
}

function ReferenceTargetTree({
  targetType,
  tree,
  isLoading,
  error,
  selectedTargetId,
  expandedEffortIds,
  expandedTaskIds,
  onToggleEffort,
  onToggleTask,
  onSelectTarget,
}: ReferenceTargetTreeProps) {
  if (isLoading) {
    return <div className={styles['reference-tree-status']}>loading targets</div>
  }

  if (error) {
    return <div className={styles['reference-tree-status']}>{error}</div>
  }

  if (tree.length === 0) {
    return <div className={styles['reference-tree-status']}>no targets</div>
  }

  const visibleTree = tree.filter((entry) => hasTargetsForType(entry, targetType))

  if (visibleTree.length === 0) {
    return <div className={styles['reference-tree-status']}>no {targetType} targets</div>
  }

  return (
    <div className={styles['reference-tree-shell']}>
      <div className={styles['reference-tree']}>
        {visibleTree.map((entry) => {
          const expanded = expandedEffortIds.has(entry.effort.id)
          const isEffortTarget = targetType === 'effort'
          return (
            <div key={entry.effort.id} className={styles['reference-tree-effort']}>
              {isEffortTarget ? (
                <button
                  type="button"
                  className={`${styles['reference-tree-item']} ${selectedTargetId === entry.effort.id ? styles.selected : ''}`}
                  onClick={() => onSelectTarget('effort', entry.effort.id)}
                >
                  <strong>{entry.effort.shortRef}</strong>
                  <span>{entry.effort.title}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className={styles['reference-tree-group-row']}
                  onClick={() => onToggleEffort(entry.effort.id)}
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <strong>{entry.effort.shortRef}</strong>
                  <span>{entry.effort.title}</span>
                </button>
              )}

              {expanded ? (
                <div className={styles['reference-tree-children']}>
                  {targetType === 'plan' ? (
                    <ReferencePlanTargets
                      plans={entry.plans}
                      selectedTargetId={selectedTargetId}
                      onSelectTarget={onSelectTarget}
                    />
                  ) : null}
                  {targetType === 'task' ? (
                    <ReferenceTaskTargets
                      tasks={entry.tasks}
                      selectedTargetId={selectedTargetId}
                      onSelectTarget={onSelectTarget}
                    />
                  ) : null}
                  {targetType === 'review' ? (
                    <ReferenceReviewTargets
                      tasks={entry.tasks}
                      selectedTargetId={selectedTargetId}
                      expandedTaskIds={expandedTaskIds}
                      onToggleTask={onToggleTask}
                      onSelectTarget={onSelectTarget}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function hasTargetsForType(
  entry: ReferenceTreeEffort,
  targetType: Exclude<ReferenceTargetType, 'file'>,
) {
  if (targetType === 'effort') {
    return true
  }

  if (targetType === 'plan') {
    return entry.plans.length > 0
  }

  if (targetType === 'task') {
    return entry.tasks.length > 0
  }

  return entry.tasks.some((taskEntry) => taskEntry.reviews.length > 0)
}

function ReferencePlanTargets({
  plans,
  selectedTargetId,
  onSelectTarget,
}: {
  plans: Plan[]
  selectedTargetId: number
  onSelectTarget: (targetType: Exclude<ReferenceTargetType, 'file'>, targetId: number) => void
}) {
  if (plans.length === 0) {
    return <p className={styles['reference-tree-empty']}>no plans</p>
  }

  return plans.map((plan) => (
    <button
      key={plan.id}
      type="button"
      className={`${styles['reference-tree-leaf']} ${selectedTargetId === plan.id ? styles.selected : ''}`}
      onClick={() => onSelectTarget('plan', plan.id)}
    >
      <strong>{plan.shortRef}</strong>
      <span>{plan.summary ?? (plan.accepted ? 'accepted plan' : 'plan')}</span>
    </button>
  ))
}

function ReferenceTaskTargets({
  tasks,
  selectedTargetId,
  onSelectTarget,
}: {
  tasks: Array<{ task: Task; reviews: Review[] }>
  selectedTargetId: number
  onSelectTarget: (targetType: Exclude<ReferenceTargetType, 'file'>, targetId: number) => void
}) {
  if (tasks.length === 0) {
    return <p className={styles['reference-tree-empty']}>no tasks</p>
  }

  return tasks.map(({ task }) => (
    <button
      key={task.id}
      type="button"
      className={`${styles['reference-tree-leaf']} ${selectedTargetId === task.id ? styles.selected : ''}`}
      onClick={() => onSelectTarget('task', task.id)}
    >
      <strong>{task.shortRef}</strong>
      <span>{task.title}</span>
    </button>
  ))
}

function ReferenceReviewTargets({
  tasks,
  selectedTargetId,
  expandedTaskIds,
  onToggleTask,
  onSelectTarget,
}: {
  tasks: Array<{ task: Task; reviews: Review[] }>
  selectedTargetId: number
  expandedTaskIds: Set<number>
  onToggleTask: (taskId: number) => void
  onSelectTarget: (targetType: Exclude<ReferenceTargetType, 'file'>, targetId: number) => void
}) {
  if (tasks.length === 0) {
    return <p className={styles['reference-tree-empty']}>no tasks</p>
  }

  return tasks.map(({ task, reviews }) => {
    const expanded = expandedTaskIds.has(task.id)
    return (
      <div key={task.id} className={styles['reference-tree-task-group']}>
        <button
          type="button"
          className={styles['reference-tree-task-toggle']}
          onClick={() => onToggleTask(task.id)}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <strong>{task.shortRef}</strong>
          <span>{task.title}</span>
        </button>
        {expanded ? (
          <div className={styles['reference-tree-review-list']}>
            {reviews.length === 0 ? (
              <p className={styles['reference-tree-empty']}>no reviews</p>
            ) : (
              reviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  className={`${styles['reference-tree-leaf']} ${selectedTargetId === review.id ? styles.selected : ''}`}
                  onClick={() => onSelectTarget('review', review.id)}
                >
                  <strong>{review.shortRef}</strong>
                  <span>{review.summary ?? review.verdict}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    )
  })
}

function findTreeTarget(
  tree: ReferenceTreeEffort[],
  targetType: ReferenceTargetType,
  targetId: number,
) {
  if (!Number.isFinite(targetId)) {
    return null
  }

  for (const entry of tree) {
    if (targetType === 'effort' && entry.effort.id === targetId) {
      return { label: `${entry.effort.shortRef} ${entry.effort.title}` }
    }

    const plan = entry.plans.find((item) => item.id === targetId)
    if (targetType === 'plan' && plan) {
      return { label: `${plan.shortRef} ${plan.summary ?? 'plan'}` }
    }

    const taskEntry = entry.tasks.find((item) => item.task.id === targetId)
    if (targetType === 'task' && taskEntry) {
      return { label: `${taskEntry.task.shortRef} ${taskEntry.task.title}` }
    }

    if (targetType === 'review') {
      const review = entry.tasks.flatMap((item) => item.reviews).find((item) => item.id === targetId)
      if (review) {
        return { label: `${review.shortRef} ${review.summary ?? review.verdict}` }
      }
    }
  }

  return null
}
