import { useState } from 'react'
import type { InputRequest } from '../../core/types'

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

type InputRequestListProps = {
  inputs: InputRequest[]
  onAnswer: (inputRequestId: number, answer: string) => void
  isAnswering: boolean
}

export function InputRequestList({ inputs, onAnswer, isAnswering }: InputRequestListProps) {
  const [tab, setTab] = useState<'pending' | 'answered'>('pending')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  const filtered = inputs.filter((input) => input.status === tab)

  return (
    <div className="input-panel">
      <div className="input-tabs">
        <button
          type="button"
          className={tab === 'pending' ? 'active' : ''}
          onClick={() => setTab('pending')}
        >
          pending ({inputs.filter((i) => i.status === 'pending').length})
        </button>
        <button
          type="button"
          className={tab === 'answered' ? 'active' : ''}
          onClick={() => setTab('answered')}
        >
          answered ({inputs.filter((i) => i.status === 'answered').length})
        </button>
      </div>

      <div className="input-cards">
        {filtered.length === 0 ? (
          <p className="empty-state">no {tab} inputs</p>
        ) : (
          filtered.map((input) => {
            const isExpanded = expandedId === input.id
            return (
              <article
                className={`input-card ${input.status} ${isExpanded ? 'expanded' : ''}`}
                key={input.id}
                onClick={() => setExpandedId(isExpanded ? null : input.id)}
              >
                <div className="input-card-header">
                  <span>{input.shortRef}</span>
                  <strong>{input.type}</strong>
                  <small>{timeAgo(input.requestedAt)}</small>
                </div>
                <p className="input-card-prompt">{input.prompt}</p>
                <span className="input-card-status">{input.status}</span>

                {isExpanded && input.status === 'pending' ? (
                  <form
                    className="input-answer-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const answer = drafts[input.id] ?? ''
                      if (answer.trim()) {
                        onAnswer(input.id, answer)
                        setDrafts((c) => ({ ...c, [input.id]: '' }))
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {input.choices ? (
                      <div className="input-choice-list">
                        {input.choices.map((choice) => (
                          <button
                            key={choice.value}
                            type="button"
                            className={`input-choice ${drafts[input.id] === choice.value ? 'selected' : ''}`}
                            onClick={() => setDrafts((c) => ({ ...c, [input.id]: choice.value }))}
                            disabled={isAnswering}
                          >
                            {choice.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <textarea
                      aria-label="answer"
                      placeholder="answer"
                      value={drafts[input.id] ?? ''}
                      onChange={(event) => setDrafts((c) => ({ ...c, [input.id]: event.target.value }))}
                      rows={3}
                    />
                    <button type="submit" disabled={isAnswering}>
                      answer
                    </button>
                  </form>
                ) : null}

                {isExpanded && input.status === 'answered' && input.answer ? (
                  <p className="input-answer">{input.answer}</p>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}