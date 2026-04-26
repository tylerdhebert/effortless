import type { DiscussionMessage } from '../../core/types'
import { MessageSquare, X } from 'lucide-react'

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
        <button type="button" className="icon-btn" onClick={onClose} aria-label="close">
          <X size={14} />
        </button>
      </div>

      <div className="discussion-popper-stream">
        {messages.map((message) => (
          <article className={`discussion-message ${message.author}`} key={message.id}>
            <div>
              <span>{message.author}</span>
              <small>{message.agentId ?? message.createdAt}</small>
            </div>
            <p>{message.body}</p>
          </article>
        ))}

        {messages.length === 0 ? <p className="empty-state">no discussion yet</p> : null}
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
        <button type="submit" disabled={isPending}>
          send
        </button>
      </form>
    </section>
  )
}