import type { DiscussionMessage } from '../../core/types'
import { MessageSquare, X } from 'lucide-react'
import { formatTimestamp } from './helpers'

type DiscussionPanelProps = {
  messages: DiscussionMessage[]
  draft: string
  onDraftChange: (value: string) => void
  onSubmit: () => void
  isPending: boolean
  onClose: () => void
}

export function DiscussionPanel({
  messages,
  draft,
  onDraftChange,
  onSubmit,
  isPending,
  onClose,
}: DiscussionPanelProps) {
  return (
    <section className="discussion-popper">
      <div className="discussion-popper-header">
        <div className="discussion-popper-title">
          <MessageSquare size={14} />
          <span>discussion</span>
        </div>
        <span className="discussion-popper-count">{messages.length} messages</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="close">
          <X size={14} />
        </button>
      </div>

      <div className="discussion-popper-stream">
        {messages.length === 0 ? (
          <div className="discussion-popper-empty">
            <p className="empty-state">no discussion yet</p>
          </div>
        ) : (
          messages.map((message) => (
            <article className={`discussion-message ${message.author}`} key={message.id}>
              <div>
                <span>{message.author}</span>
                <small>{message.agentId ?? formatTimestamp(message.createdAt)}</small>
              </div>
              <p>{message.body}</p>
            </article>
          ))
        )}
      </div>

      <form
        className="discussion-popper-compose"
        onSubmit={(event) => {
          event.preventDefault()
          if (draft.trim()) {
            onSubmit()
          }
        }}
      >
        <textarea
          aria-label="discussion draft"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          rows={3}
          placeholder="message..."
        />
        <div className="discussion-popper-compose-actions">
          <button type="submit" disabled={isPending || !draft.trim()}>
            send
          </button>
        </div>
      </form>
    </section>
  )
}
