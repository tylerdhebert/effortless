import { useState } from 'react'
import type { Plan } from '../../core/types'
import { PlanCommentStream } from './PlanCommentStream'
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react'
import { isPlanWaiting, planStatus } from './helpers'
import { MarkdownDocument } from './MarkdownDocument'

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
      <section className="surface-section plan-section">
        <div className="section-title">
          <span className="section-title-label">
            <ListOrdered size={14} />
            <span>plan</span>
          </span>
        </div>
        <p className="empty-state">no plans yet</p>
      </section>
    )
  }

  return (
    <section className="surface-section plan-section">
      <div className="section-title">
        <span className="section-title-label">
          <ListOrdered size={14} />
          <span>plan</span>
        </span>
      </div>

      <div className="plan-pager">
        <div className="plan-pager-top">
          <button
            type="button"
            className="pager-arrow"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="previous plan"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="plan-dots">
            {plans.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`plan-dot ${i === index ? 'active' : ''} ${p.accepted ? 'accepted' : ''}`}
                onClick={() => onSelectPlan(p.id)}
                aria-label={`plan ${i + 1}`}
              >
              </button>
            ))}
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
          className={`plan-card ${plan.accepted ? 'accepted' : ''} ${isPlanWaiting(plan) ? 'waiting' : ''}`}
          data-state={planStatus(plan)}
        >
          <div className="plan-card-header">
            <div>
              <span>{plan.shortRef}</span>
              <strong>{planStatus(plan)}</strong>
            </div>
            <div className="plan-card-actions">
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
          <div className="plan-card-body">
            <MarkdownDocument content={plan.body} className="plan-body-markdown" />
          </div>
          {plan.latestFeedbackBody ? (
            <div className="plan-feedback">
              <span>feedback</span>
              <p>{plan.latestFeedbackBody}</p>
            </div>
          ) : null}
          {isPlanWaiting(plan) && !hasAcceptedPlan ? (
            <form
              className="plan-feedback-form"
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

          <section className="plan-history">
            <h4>history</h4>
            <PlanCommentStream comments={planComments} />
          </section>
        </article>
      </div>
    </section>
  )
}
