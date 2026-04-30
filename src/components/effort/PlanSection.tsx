import { useState } from 'react'
import type { Plan } from '../../../core/types'
import { PlanCommentStream } from './PlanCommentStream'
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react'
import { isPlanWaiting, planStatus } from '../../lib/helpers'
import { MarkdownDocument } from '../ui/MarkdownDocument'
import { WarningIndicator } from '../notifications/WarningIndicator'
import styles from './PlanSection.module.css'

type PlanSectionProps = {
  plans: Plan[]
  selectedPlanId: number | null
  onSelectPlan: (planId: number) => void
  planComments: Awaited<ReturnType<typeof window.effortless.listPlanComments>>
  onAcceptPlan: (planId: number) => void
  onReadyPlan: (planId: number) => void
  onRequestPlanChanges: (input: { planId: number; body: string }) => void
  isAcceptingPlan: boolean
  isReadyingPlan: boolean
  isRequestingPlanChanges: boolean
  hasPendingPlan?: boolean
}

export function PlanSection({
  plans,
  selectedPlanId,
  onSelectPlan,
  planComments,
  onAcceptPlan,
  onReadyPlan,
  onRequestPlanChanges,
  isAcceptingPlan,
  isReadyingPlan,
  isRequestingPlanChanges,
  hasPendingPlan = false,
}: PlanSectionProps) {
  const [planFeedbackDrafts, setPlanFeedbackDrafts] = useState<Record<number, string>>({})

  const hasAcceptedPlan = plans.some((p) => p.accepted)
  const index = Math.max(0, plans.findIndex((p) => p.id === selectedPlanId))
  const plan = plans[index] ?? null

  function goPrev() {
    if (index > 0) onSelectPlan(plans[index - 1].id)
  }

  function goNext() {
    if (index < plans.length - 1) onSelectPlan(plans[index + 1].id)
  }

  if (plans.length === 0) {
    return (
      <section className={`surface-section ${styles['plan-section']}`}>
        <div className="section-title">
          <span className="section-title-label">
            <ListOrdered size={14} />
            <span>plan</span>
          </span>
          {hasPendingPlan ? (
            <WarningIndicator title="plan needs review" pulse size={14} />
          ) : null}
        </div>
        <p className="empty-state">no plans yet</p>
      </section>
    )
  }

  return (
    <section className={`surface-section ${styles['plan-section']}`}>
      <div className="section-title">
        <span className="section-title-label">
          <ListOrdered size={14} />
          <span>plan</span>
        </span>
        {hasPendingPlan ? (
          <WarningIndicator title="plan needs review" pulse size={14} />
        ) : null}
      </div>

      <div className={styles['plan-pager']}>
        <div className={styles['plan-pager-top']}>
          <button
            type="button"
            className="pager-arrow"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="previous plan"
          >
            <ChevronLeft size={18} />
          </button>

          <div className={styles['plan-pager-nav']}>
            <span className={styles['plan-pager-count']}>
              {plans.length === 1 ? '1 plan' : `plan ${index + 1} of ${plans.length}`}
            </span>

            <div className={styles['plan-dots']}>
            {plans.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`${styles['plan-dot']} ${i === index ? styles.active : ''} ${p.accepted ? styles.accepted : ''}`}
                onClick={() => onSelectPlan(p.id)}
                aria-label={`show plan ${i + 1}`}
              >
              </button>
            ))}
            </div>
          </div>

          <button
            type="button"
            className="pager-arrow"
            onClick={goNext}
            disabled={index === plans.length - 1}
            aria-label="next plan"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <article
          className={`${styles['plan-card']} ${plan.accepted ? styles.accepted : ''} ${isPlanWaiting(plan) ? styles.waiting : ''}`}
          data-state={planStatus(plan)}
        >
          <div className={styles['plan-card-header']}>
            <div>
              <span>{plan.shortRef}</span>
              <strong>{planStatus(plan)}</strong>
            </div>
            <div className={styles['plan-card-actions']}>
              {!plan.accepted && !hasAcceptedPlan ? (
                <button
                  type="button"
                  onClick={() => onReadyPlan(plan.id)}
                  disabled={isReadyingPlan}
                >
                  ready
                </button>
              ) : null}
              {!plan.accepted && !hasAcceptedPlan ? (
                <button
                  type="button"
                  onClick={() => onAcceptPlan(plan.id)}
                  disabled={isAcceptingPlan}
                >
                  accept
                </button>
              ) : null}
            </div>
          </div>
          <div className={styles['plan-card-body']}>
            <MarkdownDocument content={plan.body} className={styles['plan-body-markdown']} />
          </div>
          {plan.latestFeedbackBody ? (
            <div className={styles['plan-feedback']}>
              <span>feedback</span>
              <p>{plan.latestFeedbackBody}</p>
            </div>
          ) : null}
          {isPlanWaiting(plan) && !hasAcceptedPlan ? (
            <form
              className={styles['plan-feedback-form']}
              onSubmit={(event) => {
                event.preventDefault()
                if ((planFeedbackDrafts[plan.id] ?? '').trim()) {
                  onRequestPlanChanges({ planId: plan.id, body: planFeedbackDrafts[plan.id] ?? '' })
                }
              }}
            >
              <textarea
                aria-label={`plan feedback ${plan.shortRef}`}
                value={planFeedbackDrafts[plan.id] ?? ''}
                onChange={(event) =>
                  setPlanFeedbackDrafts((current) => ({
                    ...current,
                    [plan.id]: event.target.value,
                  }))
                }
                rows={3}
                placeholder="request changes..."
              />
              <button type="submit" disabled={isRequestingPlanChanges}>
                request changes
              </button>
            </form>
          ) : null}

          <section className={styles['plan-history']}>
            <h4>history</h4>
            <PlanCommentStream comments={planComments} />
          </section>
        </article>
      </div>
    </section>
  )
}
