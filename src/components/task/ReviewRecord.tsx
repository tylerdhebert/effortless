import type { Review } from '../../../core/types'
import { formatTimestamp } from '../../lib/helpers'
import styles from './ReviewRecord.module.css'

type ReviewRecordProps = {
  review: Review
  dateLabel?: string
  children?: React.ReactNode
}

export function ReviewRecord({ review, dateLabel, children }: ReviewRecordProps) {
  return (
    <article
      className={`${styles['review-record']} ${review.appliedAt ? styles.applied : ''}`}
    >
      <div className={styles['review-record-header']}>
        <div>
          <span>{review.shortRef}</span>
          <strong>{review.verdict}</strong>
          {review.authorAgentId ? <span className={styles['review-record-agent']}>{review.authorAgentId}</span> : null}
        </div>
        <small>{dateLabel ?? formatTimestamp(review.createdAt)}</small>
      </div>
      <p>{review.body}</p>
      {children}
    </article>
  )
}
