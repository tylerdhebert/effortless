import type { PlanComment } from '../../core/types'

type PlanCommentStreamProps = {
  comments: PlanComment[]
}

export function PlanCommentStream({ comments }: PlanCommentStreamProps) {
  if (comments.length === 0) {
    return <p className="empty-state">no plan history yet</p>
  }

  return (
    <div className="comment-stream">
      {comments.map((comment) => (
        <article className="comment" key={comment.id}>
          <div>
            <span>{comment.kind}</span>
            <small>{comment.agentId ?? comment.author}</small>
          </div>
          <p>{comment.body}</p>
        </article>
      ))}
    </div>
  )
}