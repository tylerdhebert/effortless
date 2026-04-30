import { useMemo, useState, useRef, useCallback } from 'react'
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
}: MandateTabProps) {
  const [selectedContext, setSelectedContext] = useState<string>('global')
  const [feedback, setFeedback] = useState<Record<string, 'saved' | 'removed' | null>>({})
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const selectedRepoId = selectedContext === 'global' ? null : Number(selectedContext)

  const filteredMandates = useMemo(() => {
    return mandates.filter((m) =>
      selectedRepoId == null ? m.repoId == null : m.repoId === selectedRepoId,
    )
  }, [mandates, selectedRepoId])

  function showFeedback(surface: string, kind: 'saved' | 'removed') {
    setFeedback((prev) => ({ ...prev, [surface]: kind }))
    if (timersRef.current[surface]) clearTimeout(timersRef.current[surface])
    timersRef.current[surface] = setTimeout(() => {
      setFeedback((prev) => ({ ...prev, [surface]: null }))
    }, 2000)
  }

  const handleSave = useCallback(
    async (surface: WorkSurface, sourceType: 'body' | 'file', body: string | null, filePath: string | null) => {
      const existing = filteredMandates.find((m) => m.workSurface === surface)
      try {
        if (existing) {
          await updateMandate({
            mandateId: existing.id,
            workSurface: surface,
            repoId: selectedRepoId,
            sourceType,
            body,
            filePath,
          })
        } else {
          await createMandate({
            workSurface: surface,
            repoId: selectedRepoId,
            sourceType,
            body,
            filePath,
          })
        }
        showFeedback(surface, 'saved')
      } catch {
        // ignore
      }
    },
    [filteredMandates, selectedRepoId, createMandate, updateMandate],
  )

  const handleRemove = useCallback(
    async (surface: WorkSurface) => {
      const existing = filteredMandates.find((m) => m.workSurface === surface)
      if (!existing) return
      try {
        await deleteMandate(existing.id)
        showFeedback(surface, 'removed')
      } catch {
        // ignore
      }
    },
    [filteredMandates, deleteMandate],
  )

  return (
    <div className={styles.tab}>
      <select
        value={selectedContext}
        onChange={(e) => setSelectedContext(e.target.value)}
        className={styles.contextSelect}
      >
        <option value="global">global</option>
        {repos.map((repo) => (
          <option key={repo.id} value={String(repo.id)}>
            {repo.name}
          </option>
        ))}
      </select>

      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>surface</th>
            <th className={styles.th}>instructions</th>
          </tr>
        </thead>
        <tbody>
          {WORK_SURFACES.map((surface) => {
            const mandate = filteredMandates.find((m) => m.workSurface === surface)
            const activeSource = mandate?.sourceType ?? 'body'
            return (
              <MandateRow
                key={surface}
                surface={surface}
                mandate={mandate}
                activeSource={activeSource}
                feedback={feedback[surface] ?? null}
                onSave={handleSave}
                onRemove={handleRemove}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MandateRow({
  surface,
  mandate,
  activeSource,
  feedback,
  onSave,
  onRemove,
}: {
  surface: WorkSurface
  mandate?: Mandate
  activeSource: 'body' | 'file'
  feedback: 'saved' | 'removed' | null
  onSave: (surface: WorkSurface, sourceType: 'body' | 'file', body: string | null, filePath: string | null) => void
  onRemove: (surface: WorkSurface) => void
}) {
  const [sourceType, setSourceType] = useState<'body' | 'file'>(activeSource)
  const [body, setBody] = useState(mandate?.body ?? '')
  const [filePath, setFilePath] = useState(mandate?.filePath ?? '')

  // sync when mandate changes (e.g. after delete/create)
  const mandateKey = mandate ? `${mandate.id}-${mandate.sourceType}` : 'none'
  const prevKeyRef = useRef(mandateKey)
  if (prevKeyRef.current !== mandateKey) {
    prevKeyRef.current = mandateKey
    setSourceType(activeSource)
    setBody(mandate?.body ?? '')
    setFilePath(mandate?.filePath ?? '')
  }

  function save() {
    const b = sourceType === 'body' ? (body.trim() || null) : null
    const fp = sourceType === 'file' ? (filePath.trim() || null) : null
    onSave(surface, sourceType, b, fp)
  }

  return (
    <tr className={styles.row}>
      <td className={styles.cellSurface}>{surface}</td>
      <td className={styles.cellInput}>
        <div className={styles.rowInner}>
          <div className={styles.sourceToggle}>
            <button
              type="button"
              className={`${styles.sourceBtn} ${sourceType === 'body' ? styles.sourceActive : ''}`}
              onClick={() => {
                setSourceType('body')
                if (mandate && mandate.sourceType !== 'body') {
                  onSave(surface, 'body', body.trim() || null, null)
                }
              }}
            >
              text
            </button>
            <button
              type="button"
              className={`${styles.sourceBtn} ${sourceType === 'file' ? styles.sourceActive : ''}`}
              onClick={() => {
                setSourceType('file')
                if (mandate && mandate.sourceType !== 'file') {
                  onSave(surface, 'file', null, filePath.trim() || null)
                }
              }}
            >
              file
            </button>
          </div>

          {sourceType === 'body' ? (
            <textarea
              className={styles.bodyInput}
              rows={3}
              placeholder="mandate instructions"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onBlur={save}
            />
          ) : (
            <PathPicker
              selectFiles
              value={filePath}
              onChange={(path) => {
                setFilePath(path)
                onSave(surface, 'file', null, path.trim() || null)
              }}
              placeholder="no file configured"
            />
          )}

          <div className={styles.rowActions}>
            {mandate ? (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => onRemove(surface)}
              >
                remove
              </button>
            ) : null}
            {feedback === 'saved' && <span className={styles.feedbackSaved}>saved</span>}
            {feedback === 'removed' && <span className={styles.feedbackRemoved}>removed</span>}
          </div>
        </div>
      </td>
    </tr>
  )
}
