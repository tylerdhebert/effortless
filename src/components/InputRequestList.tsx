import { useState } from 'react'
import type { InputRequest } from '../../core/types'
import { PillSwitcher } from './PillSwitcher'

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
  const pendingCount = inputs.filter((input) => input.status === 'pending').length
  const answeredCount = inputs.filter((input) => input.status === 'answered').length

  return (
    <div className="input-panel">
      <div className="input-tabs">
        <PillSwitcher
          ariaLabel="input status"
          value={tab}
          onChange={setTab}
          options={[
            { id: 'pending', label: `pending (${pendingCount})` },
            { id: 'answered', label: `answered (${answeredCount})` },
          ]}
        />
      </div>

      <div className="input-cards">
        {filtered.length === 0 ? (
          <p className="empty-state">no {tab} inputs</p>
        ) : (
          filtered.map((input) => {
            const isAnswered = input.status === 'answered'
            const isExpanded = isAnswered || expandedId === input.id
            return (
              <article
                className={`input-card ${input.status} ${isExpanded ? 'expanded' : ''} ${isAnswered ? 'read-only' : 'interactive'}`}
                key={input.id}
                onClick={() => {
                  if (!isAnswered) {
                    setExpandedId(isExpanded ? null : input.id)
                  }
                }}
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
                    <div className="input-answer-context">
                      <span>question</span>
                      <p>{input.prompt}</p>
                    </div>
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

                {input.status === 'answered' && input.answer ? (
                  <div className="input-answer">
                    <span>answer</span>
                    <p>{input.answer}</p>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
