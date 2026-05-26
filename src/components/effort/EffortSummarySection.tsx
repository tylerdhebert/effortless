type EffortSummarySectionProps = {
  label: string
  summary: string | null
}

export function EffortSummarySection({ label, summary }: EffortSummarySectionProps) {
  if (!summary) {
    return null
  }

  return (
    <section className="effort-zone-section template-summary-section">
      <h4>{label}</h4>
      <div className="effort-zone-readout">
        <p>{summary}</p>
      </div>
    </section>
  )
}
