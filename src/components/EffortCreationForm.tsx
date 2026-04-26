import { useState, type FormEvent } from 'react'
import type { EffortTemplate } from '../../core/types'

type EffortCreationFormProps = {
  isPending: boolean
  onSubmit: (input: { title: string; description: string; template: EffortTemplate }) => void
}

export function EffortCreationForm({ isPending, onSubmit }: EffortCreationFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState<EffortTemplate>('bugfix')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !description.trim()) {
      return
    }
    onSubmit({ title, description, template })
  }

  return (
    <form className="quick-create" onSubmit={handleSubmit}>
      <select
        aria-label="template"
        value={template}
        onChange={(event) => setTemplate(event.target.value as EffortTemplate)}
      >
        <option value="bugfix">bugfix</option>
        <option value="delivery">delivery</option>
        <option value="investigation">investigation</option>
        <option value="discussion">discussion</option>
      </select>
      <input
        aria-label="title"
        placeholder="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        aria-label="description"
        placeholder="description"
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