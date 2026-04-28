import type { Review } from '../../../core/types'
import { formatTimestamp } from '../../lib/helpers'
import styles from './ReviewHistory.module.css'

type ReviewHistoryProps = {
  reviews: Review[]
}

export function ReviewHistory({ reviews }: ReviewHistoryProps) {
  if (reviews.length === 0) {
    return <p className="empty-state">no reviews</p>
  }

  return (
    <div className={styles['review-history']}>
      {reviews.map((review) => (
        <article className={`${styles['review-record']} ${review.appliedAt ? styles.applied : styles.pending}`} key={review.id}>
          <div className={styles['review-record-header']}>
            <div>
              <span>{review.shortRef}</span>
              <strong>{review.verdict}</strong>
            </div>
            <small>{review.authorAgentId ?? formatTimestamp(review.createdAt)}</small>
          </div>
          <p>{review.body}</p>
          <div className={styles['review-record-footer']}>
            <span>{review.appliedAt ? 'applied' : 'awaiting human input'}</span>
          </div>
        </article>
      ))}
    </div>
  )
}
