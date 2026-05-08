import { useState, type FormEvent } from 'react'
import type { EffortTemplate } from '../../../core/types'
import styles from './EffortCreationForm.module.css'

const templateOptions: Array<{
  value: EffortTemplate
  label: string
}> = [
  {
    value: 'delivery',
    label: 'delivery',
  },
  {
    value: 'investigation',
    label: 'investigation',
  },
  {
    value: 'bugfix',
    label: 'bugfix',
  },
]

type EffortCreationFormProps = {
  isPending: boolean
  onSubmit: (input: { title: string; description: string; template: EffortTemplate }) => void
}

export function EffortCreationForm({ isPending, onSubmit }: EffortCreationFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState<EffortTemplate | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !description.trim()) {
      return
    }
    if (!template) {
      return
    }
    onSubmit({ title, description, template })
  }

  return (
    <form className={styles['quick-create']} onSubmit={handleSubmit}>
      <div className={styles['template-picker']} role="radiogroup" aria-label="template">
        {templateOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles['template-option']} ${template === option.value ? styles.selected : !!template ? styles.deemphasized : ''}`}
            onClick={() => {
              setTemplate(option.value)
            }}
            aria-pressed={template === option.value}
          >
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
      <input
        aria-label="title"
        placeholder="effort title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        aria-label="description"
        placeholder="what should this effort accomplish?"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={5}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? 'creating' : 'create effort'}
      </button>
    </form>
  )
}
