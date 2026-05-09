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
    <article className={styles['review-record']}>
      <div className={styles['review-record-header']}>
        <div>
          <span>{review.shortRef}</span>
          <strong>{review.verdict}</strong>
        </div>
        <small>{dateLabel ?? formatTimestamp(review.createdAt)}</small>
      </div>
      <p>{review.body}</p>
      {children}
    </article>
  )
}
