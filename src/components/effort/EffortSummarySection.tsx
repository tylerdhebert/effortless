type EffortSummarySectionProps = {
  label: string
  summary: string | null
}

export function EffortSummarySection({ label, summary }: EffortSummarySectionProps) {
  if (!summary) {
    return null
  }

  return (
    <section className="surface-section template-summary-section">
      <div className="section-title">
        <span>{label}</span>
      </div>
      <div className="template-summary-body">
        <p>{summary}</p>
      </div>
    </section>
  )
}
