import type { DiscussionMessage } from '../../core/types'
import { formatTimestamp } from './helpers'

type DiscussionThreadItemProps = {
  message: DiscussionMessage
}

export function DiscussionThreadItem({ message }: DiscussionThreadItemProps) {
  const isUser = message.author === 'user'
  const authorLabel = isUser ? 'you' : message.agentId ?? 'agent'

  return (
    <article className={`discussion-thread-item ${isUser ? 'user' : 'agent'}`}>
      <div className="discussion-thread-meta">
        <span className="discussion-thread-author">{authorLabel}</span>
        <small>{formatTimestamp(message.createdAt)}</small>
      </div>
      <div className="discussion-thread-card">
        <p>{message.body}</p>
      </div>
    </article>
  )
}
