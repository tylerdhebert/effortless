import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleDot, Plus } from 'lucide-react'
import type { Instructions, Repo, SetInstructionsInput } from '../../../core/types'
import { PathPicker } from '../ui/PathPicker'
import styles from './InstructionsTab.module.css'

type InstructionsTabProps = {
  repos: Repo[]
  instructions: Instructions[]
  setInstructions: (input: SetInstructionsInput) => Promise<Instructions>
  deleteInstructions: (id: number) => Promise<void>
  isSaving: boolean
  isClearing: boolean
}

export function InstructionsTab({
  repos,
  instructions,
  setInstructions,
  deleteInstructions,
  isSaving,
  isClearing,
}: InstructionsTabProps) {
  const [selectedScope, setSelectedScope] = useState<string>('global')
  const [sourceType, setSourceType] = useState<'body' | 'file'>('body')
  const [body, setBody] = useState('')
  const [filePath, setFilePath] = useState('')
  const [feedback, setFeedback] = useState<Record<string, 'saved' | 'cleared' | null>>({})
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const selectedRepoId = selectedScope === 'global' ? null : Number(selectedScope)
  const selectedInstructions = useMemo(() => {
    return instructions.find((entry) =>
      selectedRepoId == null ? entry.repoId == null : entry.repoId === selectedRepoId,
    ) ?? null
  }, [instructions, selectedRepoId])
  const isBusy = isSaving || isClearing

  useEffect(() => {
    setSourceType(selectedInstructions?.sourceType ?? 'body')
    setBody(selectedInstructions?.body ?? '')
    setFilePath(selectedInstructions?.filePath ?? '')
  }, [selectedInstructions])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer)
      }
    }
  }, [])

  const showFeedback = useCallback((scope: string, kind: 'saved' | 'cleared') => {
    setFeedback((prev) => ({ ...prev, [scope]: kind }))
    if (timersRef.current[scope]) {
      clearTimeout(timersRef.current[scope])
    }
    timersRef.current[scope] = setTimeout(() => {
      setFeedback((prev) => ({ ...prev, [scope]: null }))
    }, 2200)
  }, [])

  const handleSave = useCallback(async () => {
    const nextBody = sourceType === 'body' ? (body.trim() ? body : null) : null
    const nextFilePath = sourceType === 'file' ? (filePath.trim() ? filePath : null) : null

    try {
      await setInstructions({
        repoId: selectedRepoId,
        sourceType,
        body: nextBody,
        filePath: nextFilePath,
      })
      showFeedback(selectedScope, 'saved')
    } catch {
      // Leave the current draft in place.
    }
  }, [body, filePath, selectedRepoId, selectedScope, setInstructions, showFeedback, sourceType])

  const handleClear = useCallback(async () => {
    if (!selectedInstructions) return

    try {
      await deleteInstructions(selectedInstructions.id)
      showFeedback(selectedScope, 'cleared')
    } catch {
      // Leave the current draft in place.
    }
  }, [deleteInstructions, selectedInstructions, selectedScope, showFeedback])

  const hasValue = sourceType === 'body' ? body.trim().length > 0 : filePath.trim().length > 0
  const isDirty =
    sourceType !== (selectedInstructions?.sourceType ?? 'body') ||
    body !== (selectedInstructions?.body ?? '') ||
    filePath !== (selectedInstructions?.filePath ?? '')

  return (
    <div className={styles.tab}>
      <div className={styles.workspace}>
        <div className={styles.scopeRail} aria-label="instruction scopes">
          <span className={styles.railLabel}>scope</span>
          <div className={styles.scopeList}>
            <ScopeButton
              id="global"
              label="global"
              selected={selectedScope === 'global'}
              configured={instructions.some((entry) => entry.repoId == null)}
              onSelect={setSelectedScope}
            />
            {repos.map((repo) => (
              <ScopeButton
                key={repo.id}
                id={String(repo.id)}
                label={repo.name}
                meta={repo.shortRef}
                selected={selectedScope === String(repo.id)}
                configured={instructions.some((entry) => entry.repoId === repo.id)}
                onSelect={setSelectedScope}
              />
            ))}
            {repos.length === 0 ? (
              <div className={styles.emptyScopes}>
                <Plus size={14} />
                <span>add repos to create repo scopes</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.editorColumn}>
          <div className={styles.editorHeader}>
            <div className={styles.editorTitleGroup}>
              <span className={styles.editorLabel}>
                {selectedScope === 'global'
                  ? 'global instructions'
                  : `${repos.find((repo) => String(repo.id) === selectedScope)?.name ?? 'repo'} instructions`}
              </span>
              <div className={styles.sourceToggle} aria-label="instructions source type">
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
              {selectedInstructions ? (
                <button
                  type="button"
                  className={styles.clearAction}
                  onClick={() => void handleClear()}
                  disabled={isBusy}
                >
                  {isClearing ? 'clearing' : 'clear'}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void handleSave()}
                disabled={!hasValue || !isDirty || isBusy}
              >
                {isSaving ? 'saving' : 'save'}
              </button>
            </div>
          </div>

          {sourceType === 'body' ? (
            <textarea
              className={styles.editor}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="instructions"
              spellCheck={false}
            />
          ) : (
            <div className={styles.fileEditor}>
              <PathPicker
                selectFiles
                value={filePath}
                onChange={setFilePath}
                placeholder="no file configured"
                ariaLabel="instructions file path"
              />
            </div>
          )}

          <div className={styles.footer}>
            <span
              className={`${styles.feedback} ${
                feedback[selectedScope] === 'saved'
                  ? styles.feedbackSaved
                  : feedback[selectedScope] === 'cleared'
                    ? styles.feedbackCleared
                    : ''
              }`}
              aria-live="polite"
            >
              {feedback[selectedScope] === 'saved'
                ? 'saved'
                : feedback[selectedScope] === 'cleared'
                  ? 'cleared'
                  : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScopeButton({
  id,
  label,
  meta,
  selected,
  configured,
  onSelect,
}: {
  id: string
  label: string
  meta?: string
  selected: boolean
  configured: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      className={`${styles.scopeButton} ${selected ? styles.scopeButtonActive : ''}`}
      onClick={() => onSelect(id)}
      title={configured ? `${label} configured` : `${label} empty`}
    >
      <span className={styles.scopeButtonContent}>
        <span>
          <strong>{label}</strong>
          {meta ? <small>{meta}</small> : null}
        </span>
        {configured ? (
          <CircleDot
            size={14}
            className={`${styles.scopeIndicator} ${styles.scopeIndicatorPresent}`}
            aria-hidden="true"
          />
        ) : (
          <Circle
            size={14}
            className={`${styles.scopeIndicator} ${styles.scopeIndicatorEmpty}`}
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  )
}
