import type { ActivityEvent } from '../../../core/types'
import { formatTimestamp } from '../../lib/helpers'
import styles from './CommentStream.module.css'

type CommentStreamProps = {
  comments: ActivityEvent[]
}

export function CommentStream({ comments }: CommentStreamProps) {
  return (
    <div className={styles['comment-stream']}>
      {comments.map((comment) => (
        <article className={styles.comment} key={comment.id}>
          <div>
            <span>{comment.kind}</span>
            <small>
              {comment.author}
              {' · '}{formatTimestamp(comment.createdAt)}
            </small>
          </div>
          <p>{comment.body}</p>
        </article>
      ))}

      {comments.length === 0 ? <p className="empty-state">no comments</p> : null}
    </div>
  )
}
