import type { Review } from '../../core/types'

type ReviewHistoryProps = {
  reviews: Review[]
}

export function ReviewHistory({ reviews }: ReviewHistoryProps) {
  if (reviews.length === 0) {
    return <p className="empty-state">no reviews</p>
  }

  return (
    <div className="review-history">
      {reviews.map((review) => (
        <article className={`review-record ${review.appliedAt ? 'applied' : 'pending'}`} key={review.id}>
          <div className="review-record-header">
            <div>
              <span>{review.shortRef}</span>
              <strong>{review.verdict}</strong>
            </div>
            <small>{review.authorAgentId ?? review.createdAt}</small>
          </div>
          <p>{review.body}</p>
          <div className="review-record-footer">
            <span>{review.appliedAt ? 'applied' : 'awaiting human input'}</span>
          </div>
        </article>
      ))}
    </div>
  )
}