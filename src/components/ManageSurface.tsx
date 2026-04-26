import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { Mandate, Repo, WorkSurface, MandateSourceType } from '../../core/types'
import { PillSwitcher } from './PillSwitcher'

type ManageSurfaceProps = {
  repos: Repo[]
  mandates: Mandate[]
  createRepo: (input: { name: string; path: string; baseBranch: string; buildCommand: string | null }) => Promise<Repo>
  updateRepo: (input: { repoId: number; name: string; path: string; baseBranch: string; buildCommand: string | null }) => Promise<Repo>
  deleteRepo: (repoId: number) => Promise<void>
  createMandate: (input: { workSurface: WorkSurface; repoId: number | null; sourceType: MandateSourceType; body: string | null; filePath: string | null }) => Promise<Mandate>
  updateMandate: (input: { mandateId: number; workSurface: WorkSurface; repoId: number | null; sourceType: MandateSourceType; body: string | null; filePath: string | null }) => Promise<Mandate>
  deleteMandate: (mandateId: number) => Promise<void>
  isCreatingRepo: boolean
  isUpdatingRepo: boolean
  isDeletingRepo: boolean
  isCreatingMandate: boolean
  isUpdatingMandate: boolean
  isDeletingMandate: boolean
  section: 'repos' | 'mandates'
}

export function ManageSurface({
  repos,
  mandates,
  createRepo,
  updateRepo,
  deleteRepo,
  createMandate,
  updateMandate,
  deleteMandate,
  isCreatingRepo,
  isUpdatingRepo,
  isDeletingRepo,
  isCreatingMandate,
  isUpdatingMandate,
  isDeletingMandate,
  section,
}: ManageSurfaceProps) {
  const mandateSourceOptions: Array<{ id: MandateSourceType; label: string }> = [
    { id: 'body', label: 'inline text' },
    { id: 'file', label: 'file path' },
  ]

  const [repoName, setRepoName] = useState('')
  const [repoPath, setRepoPath] = useState('')
  const [repoBaseBranch, setRepoBaseBranch] = useState('main')
  const [repoBuildCommand, setRepoBuildCommand] = useState('')
  const [editingRepoId, setEditingRepoId] = useState<number | null>(null)
  const [editingRepoName, setEditingRepoName] = useState('')
  const [editingRepoPath, setEditingRepoPath] = useState('')
  const [editingRepoBaseBranch, setEditingRepoBaseBranch] = useState('main')
  const [editingRepoBuildCommand, setEditingRepoBuildCommand] = useState('')

  const [mandateWorkSurface, setMandateWorkSurface] = useState<WorkSurface>('task')
  const [mandateSourceType, setMandateSourceType] = useState<MandateSourceType>('body')
  const [mandateBody, setMandateBody] = useState('')
  const [mandateFilePath, setMandateFilePath] = useState('')
  const [mandateRepoId, setMandateRepoId] = useState('')
  const [editingMandateId, setEditingMandateId] = useState<number | null>(null)
  const [editingMandateWorkSurface, setEditingMandateWorkSurface] = useState<WorkSurface>('task')
  const [editingMandateSourceType, setEditingMandateSourceType] = useState<MandateSourceType>('body')
  const [editingMandateBody, setEditingMandateBody] = useState('')
  const [editingMandateFilePath, setEditingMandateFilePath] = useState('')
  const [editingMandateRepoId, setEditingMandateRepoId] = useState('')

  function resetRepoEditor() {
    setEditingRepoId(null)
    setEditingRepoName('')
    setEditingRepoPath('')
    setEditingRepoBaseBranch('main')
    setEditingRepoBuildCommand('')
  }

  function resetMandateEditor() {
    setEditingMandateId(null)
    setEditingMandateWorkSurface('task')
    setEditingMandateSourceType('body')
    setEditingMandateBody('')
    setEditingMandateFilePath('')
    setEditingMandateRepoId('')
  }

  function beginRepoEdit(repo: Repo) {
    setEditingRepoId(repo.id)
    setEditingRepoName(repo.name)
    setEditingRepoPath(repo.path)
    setEditingRepoBaseBranch(repo.baseBranch)
    setEditingRepoBuildCommand(repo.buildCommand ?? '')
  }

  function beginMandateEdit(mandate: Mandate) {
    setEditingMandateId(mandate.id)
    setEditingMandateWorkSurface(mandate.workSurface)
    setEditingMandateSourceType(mandate.sourceType)
    setEditingMandateBody(mandate.body ?? '')
    setEditingMandateFilePath(mandate.filePath ?? '')
    setEditingMandateRepoId(mandate.repoId ? String(mandate.repoId) : '')
  }

  const activeMandateSourceType = editingMandateId ? editingMandateSourceType : mandateSourceType

  return (
    <>
      <div className="effort-scroll manage-scroll">
        {section === 'repos' ? (
          <section className="manage-surface manage-surface-repos">
            <section className="manage-panel">
              <div className="manage-panel-header">
                <div>
                  <h3>{editingRepoId ? 'edit repo' : 'add repo'}</h3>
                </div>
              </div>

              <form
                className="repo-form manage-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (editingRepoId) {
                    if (!editingRepoName.trim() || !editingRepoPath.trim() || !editingRepoBaseBranch.trim()) return
                    updateRepo({
                      repoId: editingRepoId,
                      name: editingRepoName,
                      path: editingRepoPath,
                      baseBranch: editingRepoBaseBranch,
                      buildCommand: editingRepoBuildCommand || null,
                    })
                  } else {
                    if (!repoName.trim() || !repoPath.trim() || !repoBaseBranch.trim()) return
                    createRepo({ name: repoName, path: repoPath, baseBranch: repoBaseBranch, buildCommand: repoBuildCommand || null })
                  }
                }}
              >
                <input
                  aria-label="repo name"
                  placeholder="name"
                  value={editingRepoId ? editingRepoName : repoName}
                  onChange={(event) =>
                    editingRepoId ? setEditingRepoName(event.target.value) : setRepoName(event.target.value)
                  }
                />
                <input
                  aria-label="repo path"
                  placeholder="path"
                  value={editingRepoId ? editingRepoPath : repoPath}
                  onChange={(event) =>
                    editingRepoId ? setEditingRepoPath(event.target.value) : setRepoPath(event.target.value)
                  }
                />
                <div className="repo-form-row">
                  <input
                    aria-label="repo base branch"
                    placeholder="base branch"
                    value={editingRepoId ? editingRepoBaseBranch : repoBaseBranch}
                    onChange={(event) =>
                      editingRepoId ? setEditingRepoBaseBranch(event.target.value) : setRepoBaseBranch(event.target.value)
                    }
                  />
                  <input
                    aria-label="repo build command"
                    placeholder="build command"
                    value={editingRepoId ? editingRepoBuildCommand : repoBuildCommand}
                    onChange={(event) =>
                      editingRepoId ? setEditingRepoBuildCommand(event.target.value) : setRepoBuildCommand(event.target.value)
                    }
                  />
                </div>
                <div className="manage-repo-actions">
                  <button type="submit" disabled={editingRepoId ? isUpdatingRepo : isCreatingRepo}>
                    {editingRepoId ? (isUpdatingRepo ? 'saving' : 'save repo') : isCreatingRepo ? 'creating' : 'add repo'}
                  </button>
                  {editingRepoId ? (
                    <button type="button" onClick={resetRepoEditor} disabled={isUpdatingRepo}>
                      cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>

            <section className="manage-panel">
              <div className="manage-panel-header">
                <div>
                  <h3>repos</h3>
                </div>
              </div>

              <div className="repo-list manage-repo-list">
                {repos.map((repo) => (
                  <article className="repo-row manage-repo-row" key={repo.id}>
                    <div>
                      <strong>{repo.name}</strong>
                      <span>{repo.shortRef}</span>
                    </div>
                    <p>{repo.path}</p>
                    <small>{repo.baseBranch}</small>
                    <div className="manage-repo-actions">
                      <button type="button" className="icon-btn" onClick={() => beginRepoEdit(repo)} aria-label="edit">
                        <Pencil size={12} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => deleteRepo(repo.id)} disabled={isDeletingRepo} aria-label="remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))}

                {repos.length === 0 ? <p className="empty-state">no repos</p> : null}
              </div>
            </section>
          </section>
        ) : section === 'mandates' ? (
          <section className="manage-surface manage-surface-mandates">
            <section className="manage-panel">
              <div className="manage-panel-header">
                <div>
                  <h3>{editingMandateId ? 'edit mandate' : 'add mandate'}</h3>
                </div>
              </div>

              <form
                className="repo-form manage-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (editingMandateId) {
                    if (editingMandateSourceType === 'body' && !editingMandateBody.trim()) return
                    if (editingMandateSourceType === 'file' && !editingMandateFilePath.trim()) return
                    updateMandate({
                      mandateId: editingMandateId,
                      workSurface: editingMandateWorkSurface,
                      repoId: editingMandateRepoId ? Number(editingMandateRepoId) : null,
                      sourceType: editingMandateSourceType,
                      body: editingMandateSourceType === 'body' ? editingMandateBody : null,
                      filePath: editingMandateSourceType === 'file' ? editingMandateFilePath : null,
                    }).then(() => resetMandateEditor())
                  } else {
                    if (mandateSourceType === 'body' && !mandateBody.trim()) return
                    if (mandateSourceType === 'file' && !mandateFilePath.trim()) return
                    createMandate({
                      workSurface: mandateWorkSurface,
                      repoId: mandateRepoId ? Number(mandateRepoId) : null,
                      sourceType: mandateSourceType,
                      body: mandateSourceType === 'body' ? mandateBody : null,
                      filePath: mandateSourceType === 'file' ? mandateFilePath : null,
                    }).then(() => { setMandateBody(''); setMandateFilePath('') })
                  }
                }}
              >
                <select
                  aria-label="work surface"
                  value={editingMandateId ? editingMandateWorkSurface : mandateWorkSurface}
                  onChange={(event) =>
                    editingMandateId
                      ? setEditingMandateWorkSurface(event.target.value as WorkSurface)
                      : setMandateWorkSurface(event.target.value as WorkSurface)
                  }
                >
                  <option value="effort">effort</option>
                  <option value="plan">plan</option>
                  <option value="task">task</option>
                  <option value="review">review</option>
                  <option value="discussion">discussion</option>
                </select>
                <select
                  aria-label="repo override"
                  value={editingMandateId ? editingMandateRepoId : mandateRepoId}
                  onChange={(event) =>
                    editingMandateId ? setEditingMandateRepoId(event.target.value) : setMandateRepoId(event.target.value)
                  }
                >
                  <option value="">global (no repo override)</option>
                  {repos.map((repo) => (
                    <option key={repo.id} value={String(repo.id)}>
                      {repo.name}
                    </option>
                  ))}
                </select>
                <PillSwitcher
                  ariaLabel="mandate source type"
                  options={mandateSourceOptions}
                  value={activeMandateSourceType}
                  onChange={(nextValue) => {
                    if (editingMandateId) {
                      setEditingMandateSourceType(nextValue)
                    } else {
                      setMandateSourceType(nextValue)
                    }
                  }}
                />
                {activeMandateSourceType === 'body' ? (
                  <textarea
                    aria-label="mandate body"
                    placeholder="mandate instructions"
                    value={editingMandateId ? editingMandateBody : mandateBody}
                    onChange={(event) =>
                      editingMandateId ? setEditingMandateBody(event.target.value) : setMandateBody(event.target.value)
                    }
                    rows={4}
                  />
                ) : (
                  <input
                    aria-label="mandate file path"
                    placeholder="file path"
                    value={editingMandateId ? editingMandateFilePath : mandateFilePath}
                    onChange={(event) =>
                      editingMandateId ? setEditingMandateFilePath(event.target.value) : setMandateFilePath(event.target.value)
                    }
                  />
                )}
                <div className="manage-repo-actions">
                  <button type="submit" disabled={editingMandateId ? isUpdatingMandate : isCreatingMandate}>
                    {editingMandateId ? (isUpdatingMandate ? 'saving' : 'save mandate') : isCreatingMandate ? 'creating' : 'add mandate'}
                  </button>
                  {editingMandateId ? (
                    <button type="button" onClick={resetMandateEditor} disabled={isUpdatingMandate}>
                      cancel
                    </button>
                  ) : null}
                </div>
              </form>
            </section>

            <section className="manage-panel">
              <div className="manage-panel-header">
                <div>
                  <h3>mandates</h3>
                </div>
              </div>

              <div className="repo-list manage-repo-list">
                {mandates.map((mandate) => (
                  <article className="repo-row manage-repo-row" key={mandate.id}>
                    <div>
                      <strong>{mandate.workSurface}</strong>
                      <span>{mandate.shortRef}</span>
                      {mandate.repoId ? (
                        <small>repo:{repos.find((r) => r.id === mandate.repoId)?.name ?? mandate.repoId}</small>
                      ) : (
                        <small>global</small>
                      )}
                    </div>
                    {mandate.sourceType === 'body' ? (
                      <p className="mandate-body-preview">
                        {mandate.body ? (mandate.body.length > 120 ? mandate.body.slice(0, 120) + '...' : mandate.body) : '(empty)'}
                      </p>
                    ) : (
                      <p>{mandate.filePath}</p>
                    )}
                    <div className="manage-repo-actions">
                      <button type="button" className="icon-btn" onClick={() => beginMandateEdit(mandate)} aria-label="edit">
                        <Pencil size={12} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => deleteMandate(mandate.id)} disabled={isDeletingMandate} aria-label="remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))}

                {mandates.length === 0 ? <p className="empty-state">no mandates</p> : null}
              </div>
            </section>
          </section>
        ) : null}
      </div>
    </>
  )
}
