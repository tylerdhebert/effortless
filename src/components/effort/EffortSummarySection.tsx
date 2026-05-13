type EffortSummarySectionProps = {
  label: string
  summary: string | null
}

export function EffortSummarySection({ label, summary }: EffortSummarySectionProps) {
  if (!summary) {
    return null
  }

  return (
    <section className="template-summary-section">
      <span className="drawer-inline-label">{label}</span>
      <div className="template-summary-body">
        <p>{summary}</p>
      </div>
    </section>
  )
}
