import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleDot } from 'lucide-react'
import type { Mandate, Repo, WorkSurface } from '../../../core/types'
import { PathPicker } from '../ui/PathPicker'
import styles from './MandateTab.module.css'

const WORK_SURFACES: WorkSurface[] = ['effort', 'plan', 'task', 'review', 'discussion']

type MandateTabProps = {
  repos: Repo[]
  mandates: Mandate[]
  createMandate: (input: {
    workSurface: WorkSurface
    repoId: number | null
    sourceType: 'body' | 'file'
    body: string | null
    filePath: string | null
  }) => Promise<Mandate>
  updateMandate: (input: {
    mandateId: number
    workSurface: WorkSurface
    repoId: number | null
    sourceType: 'body' | 'file'
    body: string | null
    filePath: string | null
  }) => Promise<Mandate>
  deleteMandate: (mandateId: number) => Promise<void>
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}

export function MandateTab({
  repos,
  mandates,
  createMandate,
  updateMandate,
  deleteMandate,
  isCreating,
  isUpdating,
  isDeleting,
}: MandateTabProps) {
  const [selectedContext, setSelectedContext] = useState<string>('global')
  const [selectedSurface, setSelectedSurface] = useState<WorkSurface>('effort')
  const [sourceType, setSourceType] = useState<'body' | 'file'>('body')
  const [body, setBody] = useState('')
  const [filePath, setFilePath] = useState('')
  const [feedback, setFeedback] = useState<Record<string, 'saved' | 'removed' | null>>({})
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const selectedRepoId = selectedContext === 'global' ? null : Number(selectedContext)
  const isBusy = isCreating || isUpdating || isDeleting
  const showRepoScopedState = selectedRepoId != null

  const filteredMandates = useMemo(() => {
    return mandates.filter((mandate) =>
      selectedRepoId == null ? mandate.repoId == null : mandate.repoId === selectedRepoId,
    )
  }, [mandates, selectedRepoId])

  const repoMandateCounts = useMemo(() => {
    return repos.map((repo) => {
      const configured = mandates.filter((mandate) => mandate.repoId === repo.id).length
      return {
        repoId: repo.id,
        configured,
      }
    })
  }, [mandates, repos])

  const selectedMandate = useMemo(() => {
    return filteredMandates.find((mandate) => mandate.workSurface === selectedSurface) ?? null
  }, [filteredMandates, selectedSurface])

  useEffect(() => {
    setSourceType(selectedMandate?.sourceType ?? 'body')
    setBody(selectedMandate?.body ?? '')
    setFilePath(selectedMandate?.filePath ?? '')
  }, [selectedMandate])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(timersRef.current)) {
        clearTimeout(timer)
      }
    }
  }, [])

  const showFeedback = useCallback((surface: WorkSurface, kind: 'saved' | 'removed') => {
    setFeedback((prev) => ({ ...prev, [surface]: kind }))
    if (timersRef.current[surface]) {
      clearTimeout(timersRef.current[surface])
    }
    timersRef.current[surface] = setTimeout(() => {
      setFeedback((prev) => ({ ...prev, [surface]: null }))
    }, 2200)
  }, [])

  const handleSave = useCallback(async () => {
    const nextBody = sourceType === 'body' ? (body.trim() ? body : null) : null
    const nextFilePath = sourceType === 'file' ? (filePath.trim() ? filePath : null) : null

    try {
      if (selectedMandate) {
        await updateMandate({
          mandateId: selectedMandate.id,
          workSurface: selectedSurface,
          repoId: selectedRepoId,
          sourceType,
          body: nextBody,
          filePath: nextFilePath,
        })
      } else {
        await createMandate({
          workSurface: selectedSurface,
          repoId: selectedRepoId,
          sourceType,
          body: nextBody,
          filePath: nextFilePath,
        })
      }
      showFeedback(selectedSurface, 'saved')
    } catch {
      // ignore save errors here and leave the current draft in place
    }
  }, [
    body,
    createMandate,
    filePath,
    selectedMandate,
    selectedRepoId,
    selectedSurface,
    showFeedback,
    sourceType,
    updateMandate,
  ])

  const handleRemove = useCallback(async () => {
    if (!selectedMandate) return

    try {
      await deleteMandate(selectedMandate.id)
      showFeedback(selectedSurface, 'removed')
    } catch {
      // ignore remove errors here and leave the current draft in place
    }
  }, [deleteMandate, selectedMandate, selectedSurface, showFeedback])

  const hasValue = sourceType === 'body' ? body.trim().length > 0 : filePath.trim().length > 0
  const isDirty =
    sourceType !== (selectedMandate?.sourceType ?? 'body') ||
    body !== (selectedMandate?.body ?? '') ||
    filePath !== (selectedMandate?.filePath ?? '')

  return (
    <div className={styles.tab}>
      <div className={styles.contextRow}>
        <span className={styles.controlLabel}>repo</span>
        <select
          value={selectedContext}
          onChange={(event) => setSelectedContext(event.target.value)}
          className={styles.contextSelect}
          aria-label="mandate repository scope"
        >
          <option value="global">global</option>
          {repos.map((repo) => {
            const counts = repoMandateCounts.find((entry) => entry.repoId === repo.id)
            return (
              <option key={repo.id} value={String(repo.id)}>
                {repo.name} ({counts?.configured ?? 0}/{WORK_SURFACES.length})
              </option>
            )
          })}
        </select>
      </div>

      <div className={styles.workspace}>
        <div className={styles.surfaceRail} aria-label="mandate surfaces">
          <span className={styles.railLabel}>surfaces</span>
          <div className={styles.surfaceList}>
            {WORK_SURFACES.map((surface) => {
              const selected = surface === selectedSurface
              const hasMandate = filteredMandates.some((mandate) => mandate.workSurface === surface)

              return (
                <button
                  key={`${selectedContext}-${surface}`}
                  type="button"
                  className={`${styles.surfaceButton} ${selected ? styles.surfaceButtonActive : ''}`}
                  onClick={() => setSelectedSurface(surface)}
                  title={
                    showRepoScopedState
                      ? hasMandate
                        ? `${surface} mandate configured`
                        : `${surface} mandate empty`
                      : undefined
                  }
                >
                  <span className={styles.surfaceButtonContent}>
                    <span>{surface}</span>
                    {showRepoScopedState ? (
                      hasMandate ? (
                        <CircleDot
                          size={14}
                          className={`${styles.surfaceIndicator} ${styles.surfaceIndicatorPresent}`}
                          aria-hidden="true"
                        />
                      ) : (
                        <Circle
                          size={14}
                          className={`${styles.surfaceIndicator} ${styles.surfaceIndicatorEmpty}`}
                          aria-hidden="true"
                        />
                      )
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.editorColumn}>
          <div className={styles.editorHeader}>
            <div className={styles.editorTitleGroup}>
              <span className={styles.editorLabel}>{selectedSurface} mandate</span>
              <div className={styles.sourceToggle} aria-label="mandate source type">
                <button
                  type="button"
                  className={`${styles.sourceButton} ${sourceType === 'body' ? styles.sourceButtonActive : ''}`}
                  onClick={() => setSourceType('body')}
                  aria-pressed={sourceType === 'body'}
                >
                  text
                </button>
                <button
                  type="button"
                  className={`${styles.sourceButton} ${sourceType === 'file' ? styles.sourceButtonActive : ''}`}
                  onClick={() => setSourceType('file')}
                  aria-pressed={sourceType === 'file'}
                >
                  file
                </button>
              </div>
            </div>

            <div className={styles.actions}>
              {selectedMandate && showRepoScopedState ? (
                <button
                  type="button"
                  className={styles.removeAction}
                  onClick={() => void handleRemove()}
                  disabled={isBusy}
                >
                  {isDeleting ? 'removing' : 'remove'}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void handleSave()}
                disabled={!hasValue || !isDirty || isBusy}
              >
                {isCreating || isUpdating ? 'saving' : 'save'}
              </button>
            </div>
          </div>

          {sourceType === 'body' ? (
            <textarea
              className={styles.editor}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="mandate instructions"
              spellCheck={false}
            />
          ) : (
            <div className={styles.fileEditor}>
              <PathPicker
                selectFiles
                value={filePath}
                onChange={setFilePath}
                placeholder="no file configured"
                ariaLabel={`${selectedSurface} mandate file path`}
              />
            </div>
          )}

          <div className={styles.footer}>
            <span
              className={`${styles.feedback} ${
                feedback[selectedSurface] === 'saved'
                  ? styles.feedbackSaved
                  : feedback[selectedSurface] === 'removed'
                    ? styles.feedbackRemoved
                    : ''
              }`}
              aria-live="polite"
            >
              {feedback[selectedSurface] === 'saved'
                ? 'saved'
                : feedback[selectedSurface] === 'removed'
                  ? 'removed'
                  : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
