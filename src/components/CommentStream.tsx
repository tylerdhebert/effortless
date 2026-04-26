import type { TaskComment } from '../../core/types'

type CommentStreamProps = {
  comments: TaskComment[]
}

export function CommentStream({ comments }: CommentStreamProps) {
  return (
    <div className="comment-stream">
      {comments.map((comment) => (
        <article className="comment" key={comment.id}>
          <div>
            <span>{comment.kind}</span>
            <small>{comment.agentId ?? comment.author}</small>
          </div>
          <p>{comment.body}</p>
          {comment.commitHash ? <code>{comment.commitHash}</code> : null}
        </article>
      ))}

      {comments.length === 0 ? <p className="empty-state">no comments</p> : null}
    </div>
  )
}