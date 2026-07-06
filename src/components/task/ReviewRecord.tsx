import type { Review } from '../../../core/types'
import { formatTimestamp } from '../../lib/helpers'
import { Ref } from '../ui/Ref'
import { Stamp, statusTone } from '../ui/Stamp'
import styles from './ReviewRecord.module.css'

type ReviewRecordProps = {
  review: Review
  children?: React.ReactNode
}

export function ReviewRecord({ review, children }: ReviewRecordProps) {
  return (
    <article className={styles['review-record']}>
      <div className={styles['review-record-header']}>
        <Ref value={review.shortRef} />
        <small>
          <Stamp label={review.verdict} tone={statusTone(review.verdict)} compact />
          {' · '}
          {formatTimestamp(review.createdAt)}
        </small>
      </div>
      <p>{review.body}</p>
      {children}
    </article>
  )
}
