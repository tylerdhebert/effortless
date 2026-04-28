import type { DiscussionMessage } from '../../../core/types'
import { formatTimestamp } from '../../lib/helpers'
import styles from './DiscussionThreadItem.module.css'

type DiscussionThreadItemProps = {
  message: DiscussionMessage
}

export function DiscussionThreadItem({ message }: DiscussionThreadItemProps) {
  const isUser = message.author === 'user'
  const authorLabel = isUser ? 'you' : message.agentId ?? 'agent'

  return (
    <article className={`${styles['discussion-thread-item']} ${isUser ? styles.user : styles.agent}`}>
      <div className={styles['discussion-thread-meta']}>
        <span className={styles['discussion-thread-author']}>{authorLabel}</span>
        <small>{formatTimestamp(message.createdAt)}</small>
      </div>
      <div className={styles['discussion-thread-card']}>
        <p>{message.body}</p>
      </div>
    </article>
  )
}
