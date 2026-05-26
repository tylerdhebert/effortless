import type { Review } from '../../../core/types'
import { formatTimestamp } from '../../lib/helpers'
import styles from './ReviewRecord.module.css'

type ReviewRecordProps = {
  review: Review
  children?: React.ReactNode
}

export function ReviewRecord({ review, children }: ReviewRecordProps) {
  return (
    <article className={styles['review-record']}>
      <div className={styles['review-record-header']}>
        <span>{review.shortRef}</span>
        <small>
          {review.verdict}
          {' · '}
          {formatTimestamp(review.createdAt)}
        </small>
      </div>
      <p>{review.body}</p>
      {children}
    </article>
  )
}
