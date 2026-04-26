import type { ReactNode } from 'react'

type CollapsibleSectionProps = {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function CollapsibleSection({ title, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <section className={`effort-section ${open ? 'open' : 'collapsed'}`}>
      <button className="section-title" onClick={onToggle} type="button">
        <span>{title}</span>
        <span>{open ? 'open' : 'closed'}</span>
      </button>
      {open ? <div className="section-body">{children}</div> : null}
    </section>
  )
}