import { type FormEvent, useMemo, useState } from 'react'
import type { Repo, Task } from '../../../core/types'
import styles from './TaskCreationForm.module.css'

type TaskCreationFormProps = {
  effortId: number
  repos: Repo[]
  isCreating: boolean
  onCreate: (input: {
    effortId: number
    title: string
    description: string
    repoId?: number | null
    branchName?: string | null
    baseBranch?: string | null
  }) => void
  onCreated?: (task: Task) => void
}

export function TaskCreationForm({ effortId, repos, isCreating, onCreate }: TaskCreationFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repoId, setRepoId] = useState<string>('none')
  const [branchName, setBranchName] = useState('')
  const [baseBranch, setBaseBranch] = useState('')

  const selectedRepo = useMemo(
    () => repos.find((repo) => String(repo.id) === repoId) ?? null,
    [repoId, repos],
  )
  const ready = title.trim().length > 0 && description.trim().length > 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || isCreating) return

    onCreate({
      effortId,
      title,
      description,
      repoId: selectedRepo?.id ?? null,
      branchName: branchName || null,
      baseBranch: baseBranch || (selectedRepo?.baseBranch ?? null),
    })
    setTitle('')
    setDescription('')
    setBranchName('')
    setBaseBranch('')
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.primary}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="task title"
        />
        <button type="submit" disabled={!ready || isCreating}>
          {isCreating ? 'adding' : 'add task'}
        </button>
      </div>
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="task description"
        rows={2}
      />
      <div className={styles.meta}>
        <select value={repoId} onChange={(event) => setRepoId(event.target.value)}>
          <option value="none">no repo</option>
          {repos.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
        <input
          value={branchName}
          onChange={(event) => setBranchName(event.target.value)}
          placeholder="branch"
          disabled={!selectedRepo}
        />
        <input
          value={baseBranch}
          onChange={(event) => setBaseBranch(event.target.value)}
          placeholder={selectedRepo?.baseBranch ?? 'base branch'}
          disabled={!selectedRepo}
        />
      </div>
    </form>
  )
}
