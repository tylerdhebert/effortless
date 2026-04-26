import { useState } from 'react'
import type { Reference } from '../../core/types'
import { Plus, Trash2, X } from 'lucide-react'

type ReferenceSectionProps = {
  references: Reference[]
  effortId: number
  isCreating: boolean
  isDeleting: boolean
  onAddReference: (input: { ownerType: 'effort' | 'plan' | 'task' | 'review'; ownerId: number; targetType: 'effort' | 'plan' | 'task' | 'review' | 'file'; targetId?: number | null; filePath?: string | null; label?: string | null }) => void
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
  const [refTargetType, setRefTargetType] = useState<'effort' | 'plan' | 'task' | 'review' | 'file'>('file')
  const [refTargetId, setRefTargetId] = useState('')
  const [refFilePath, setRefFilePath] = useState('')
  const [refLabel, setRefLabel] = useState('')

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

  return (
    <section className="surface-section reference-section">
      <div className="section-title">
        <span>references ({references.length})</span>
        <button type="button" onClick={() => setFlyoutOpen(true)} aria-label="add reference">
          <Plus size={16} />
        </button>
      </div>

      {flyoutOpen ? (
        <div className="flyout-overlay" onClick={() => setFlyoutOpen(false)}>
          <div className="flyout-card" onClick={(e) => e.stopPropagation()}>
            <header className="flyout-header">
              <h4>add reference</h4>
              <button type="button" onClick={() => setFlyoutOpen(false)} aria-label="close">
                <X size={14} />
              </button>
            </header>
            <form className="flyout-form" onSubmit={handleSubmit}>
              <select
                value={refTargetType}
                onChange={(event) => setRefTargetType(event.target.value as 'effort' | 'plan' | 'task' | 'review' | 'file')}
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

      <div className="reference-list">
        {references.map((ref) => (
          <article className="reference-card" key={ref.id}>
            <div className="reference-card-header">
              <strong>{ref.shortRef}</strong>
              <span>{ref.targetType}</span>
              {ref.label ? <small>{ref.label}</small> : null}
              <button
                type="button"
                className="icon-btn remove-btn"
                onClick={() => onRemoveReference(ref.id)}
                disabled={isDeleting}
                aria-label="remove reference"
              >
                <Trash2 size={12} />
              </button>
            </div>
            {ref.targetType === 'file' ? (
              <p>{ref.filePath}</p>
            ) : ref.targetId ? (
              <p>{ref.targetType}-{ref.targetId}</p>
            ) : null}
          </article>
        ))}
        {references.length === 0 ? <p className="empty-state">no references</p> : null}
      </div>
    </section>
  )
}