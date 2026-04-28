import { useEffect, useMemo, useRef, useState } from 'react'
import type { Reference } from '../../../core/types'
import { ChevronLeft, ChevronRight, Glasses, List, Plus, Trash2, X } from 'lucide-react'
import styles from './ReferenceSection.module.css'

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
}

export function ReferenceSection({
  references,
  effortId,
  isCreating,
  isDeleting,
  onAddReference,
  onRemoveReference,
}: ReferenceSectionProps) {
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [refTargetType, setRefTargetType] = useState<'effort' | 'plan' | 'task' | 'review' | 'file'>('file')
  const [refTargetId, setRefTargetId] = useState('')
  const [refFilePath, setRefFilePath] = useState('')
  const [refLabel, setRefLabel] = useState('')
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const boundedIndex = Math.min(selectedIndex, Math.max(0, references.length - 1))
  const activeReference = references[boundedIndex] ?? null
  const counterLabel = references.length > 0 ? `${boundedIndex + 1} of ${references.length}` : 'no references'

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, references.length - 1)))
  }, [references.length])

  useEffect(() => {
    if (!listOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!popoverRef.current?.contains(event.target as Node)) {
        setListOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [listOpen])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onAddReference({
      ownerType: 'effort',
      ownerId: effortId,
      targetType: refTargetType,
      targetId: refTargetType !== 'file' && refTargetId ? Number(refTargetId) : null,
      filePath: refTargetType === 'file' ? refFilePath || null : null,
      label: refLabel || null,
    })
    setRefTargetId('')
    setRefFilePath('')
    setRefLabel('')
    setFlyoutOpen(false)
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
    <section className={`surface-section ${styles['reference-section']}`}>
      <div className="section-title">
        <span className="section-title-label">
          <Glasses size={14} />
          <span>references ({references.length})</span>
        </span>
        <div className={`section-title-actions ${styles['reference-title-actions']}`}>
          {references.length > 1 ? (
            <button
              type="button"
              onClick={() => setListOpen((open) => !open)}
              aria-label="show reference list"
              title="show reference list"
            >
              <List size={14} />
            </button>
          ) : null}
          <button type="button" onClick={() => setFlyoutOpen(true)} aria-label="add reference">
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
        <div className="flyout-overlay" onClick={() => setFlyoutOpen(false)}>
          <div className="flyout-card" onClick={(event) => event.stopPropagation()}>
            <header className="flyout-header">
              <h4>add reference</h4>
              <button type="button" onClick={() => setFlyoutOpen(false)} aria-label="close">
                <X size={14} />
              </button>
            </header>
            <form className="flyout-form" onSubmit={handleSubmit}>
              <select
                value={refTargetType}
                onChange={(event) =>
                  setRefTargetType(
                    event.target.value as 'effort' | 'plan' | 'task' | 'review' | 'file',
                  )
                }
              >
                <option value="file">file</option>
                <option value="effort">effort</option>
                <option value="plan">plan</option>
                <option value="task">task</option>
                <option value="review">review</option>
              </select>
              {refTargetType === 'file' ? (
                <input
                  placeholder="file path"
                  value={refFilePath}
                  onChange={(event) => setRefFilePath(event.target.value)}
                />
              ) : (
                <input
                  placeholder="target id"
                  value={refTargetId}
                  onChange={(event) => setRefTargetId(event.target.value)}
                />
              )}
              <input
                placeholder="label (optional)"
                value={refLabel}
                onChange={(event) => setRefLabel(event.target.value)}
              />
              <button type="submit" disabled={isCreating}>
                {isCreating ? 'adding' : 'add ref'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className={styles['reference-preview-shell']}>
        {activeReference ? (
          <>
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
