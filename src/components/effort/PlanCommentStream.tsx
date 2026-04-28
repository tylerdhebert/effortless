import type { PlanComment } from '../../../core/types'
import { formatTimestamp } from '../../lib/helpers'
import commentStyles from '../task/CommentStream.module.css'

type PlanCommentStreamProps = {
  comments: PlanComment[]
}

export function PlanCommentStream({ comments }: PlanCommentStreamProps) {
  if (comments.length === 0) {
    return <p className="empty-state">no plan history yet</p>
  }

  return (
    <div className={commentStyles['comment-stream']}>
      {comments.map((comment) => (
        <article className={commentStyles.comment} key={comment.id}>
          <div>
            <span>{comment.kind}</span>
            <small>{comment.agentId ?? `${comment.author} • ${formatTimestamp(comment.createdAt)}`}</small>
          </div>
          <p>{comment.body}</p>
        </article>
      ))}
    </div>
  )
}
