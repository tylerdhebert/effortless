import type { Review } from '../../../core/types'
import { ReviewRecord } from './ReviewRecord'
import { Stamp, statusTone } from '../ui/Stamp'
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
        <ReviewRecord review={review} key={review.id}>
          <div className={styles['review-record-footer']}>
            <Stamp label={review.verdict} tone={statusTone(review.verdict)} compact />
          </div>
        </ReviewRecord>
      ))}
    </div>
  )
}
