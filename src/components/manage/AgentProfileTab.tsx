import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  DEFAULT_AGENT_COMMAND_TEMPLATE,
  DEFAULT_FORK_COMMAND_TEMPLATE,
  type AgentProfile,
  type CreateAgentProfileInput,
  type UpdateAgentProfileInput,
} from '../../../core/types'
import { PathPicker } from '../ui/PathPicker'
import styles from './AgentProfileTab.module.css'

type AgentProfileTabProps = {
  profiles: AgentProfile[]
  createProfile: (input: CreateAgentProfileInput) => Promise<AgentProfile>
  updateProfile: (input: UpdateAgentProfileInput) => Promise<AgentProfile>
  isCreating: boolean
  isUpdating: boolean
}

export function AgentProfileTab({
  profiles,
  createProfile,
  updateProfile,
  isCreating,
  isUpdating,
}: AgentProfileTabProps) {
  const [selectedProfileKey, setSelectedProfileKey] = useState<string>('new')
  const [name, setName] = useState('')
  const [commandTemplate, setCommandTemplate] = useState(DEFAULT_AGENT_COMMAND_TEMPLATE)
  const [forkCommandTemplate, setForkCommandTemplate] = useState(DEFAULT_FORK_COMMAND_TEMPLATE)
  const [environment, setEnvironment] = useState<'windows' | 'wsl'>('windows')
  const [wslDistro, setWslDistro] = useState('')
  const [defaultCwdKind, setDefaultCwdKind] = useState<AgentProfile['defaultCwdKind']>('task_worktree')
  const [customCwd, setCustomCwd] = useState('')
  const [envText, setEnvText] = useState('')
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  const selectedProfile = useMemo(
    () => profiles.find((profile) => String(profile.id) === selectedProfileKey) ?? null,
    [profiles, selectedProfileKey],
  )

  useEffect(() => {
    if (selectedProfileKey === 'new') {
      setName('')
      setCommandTemplate(DEFAULT_AGENT_COMMAND_TEMPLATE)
      setForkCommandTemplate(DEFAULT_FORK_COMMAND_TEMPLATE)
      setEnvironment('windows')
      setWslDistro('')
      setDefaultCwdKind('task_worktree')
      setCustomCwd('')
      setEnvText('')
      return
    }

    if (!selectedProfile) return

    setName(selectedProfile.name)
    setCommandTemplate(selectedProfile.commandTemplate)
    setForkCommandTemplate(selectedProfile.forkCommandTemplate ?? '')
    setEnvironment(selectedProfile.environment)
    setWslDistro(selectedProfile.wslDistro ?? '')
    setDefaultCwdKind(selectedProfile.defaultCwdKind)
    setCustomCwd(selectedProfile.customCwd ?? '')
    setEnvText(formatEnv(selectedProfile.env))
  }, [selectedProfile, selectedProfileKey])

  const baseline = selectedProfile
    ? {
        name: selectedProfile.name,
        commandTemplate: selectedProfile.commandTemplate,
        forkCommandTemplate: selectedProfile.forkCommandTemplate ?? '',
        environment: selectedProfile.environment,
        wslDistro: selectedProfile.wslDistro ?? '',
        defaultCwdKind: selectedProfile.defaultCwdKind,
        customCwd: selectedProfile.customCwd ?? '',
        envText: formatEnv(selectedProfile.env),
      }
    : {
        name: '',
        commandTemplate: DEFAULT_AGENT_COMMAND_TEMPLATE,
        forkCommandTemplate: DEFAULT_FORK_COMMAND_TEMPLATE,
        environment: 'windows',
        wslDistro: '',
        defaultCwdKind: 'task_worktree',
        customCwd: '',
        envText: '',
      }

  const dirty =
    name !== baseline.name ||
    commandTemplate !== baseline.commandTemplate ||
    forkCommandTemplate !== baseline.forkCommandTemplate ||
    environment !== baseline.environment ||
    wslDistro !== baseline.wslDistro ||
    defaultCwdKind !== baseline.defaultCwdKind ||
    customCwd !== baseline.customCwd ||
    envText !== baseline.envText

  const unknownVariables = findUnknownTemplateVariables(commandTemplate)
  const unknownForkVariables = findUnknownForkTemplateVariables(forkCommandTemplate)
  const invalidEnvLines = findInvalidEnvLines(envText)
  const ready =
    name.trim().length > 0 &&
    commandTemplate.trim().length > 0 &&
    (defaultCwdKind !== 'custom' || customCwd.trim().length > 0) &&
    unknownVariables.length === 0 &&
    unknownForkVariables.length === 0 &&
    (!forkCommandTemplate.trim() || forkCommandTemplate.includes('{provider_session_id}')) &&
    (!forkCommandTemplate.trim() || forkCommandTemplate.includes('{prompt}')) &&
    invalidEnvLines.length === 0

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready) return

    const input = {
      name,
      commandTemplate,
      forkCommandTemplate: forkCommandTemplate.trim() || null,
      environment,
      wslDistro: environment === 'wsl' ? wslDistro || null : null,
      defaultCwdKind,
      customCwd: defaultCwdKind === 'custom' ? customCwd || null : null,
      env: parseEnv(envText),
    }

    if (selectedProfile) {
      await updateProfile({ ...input, profileId: selectedProfile.id })
      return
    }

    const created = await createProfile(input)
    setSelectedProfileKey(String(created.id))
  }

  function validateProfileDraft() {
    if (!name.trim()) {
      setValidationMessage('profile name is required')
      return
    }
    if (!commandTemplate.trim()) {
      setValidationMessage('command template is required')
      return
    }
    if (unknownVariables.length > 0) {
      setValidationMessage(`unknown command variable: ${unknownVariables.join(', ')}`)
      return
    }
    if (unknownForkVariables.length > 0) {
      setValidationMessage(`unknown fork variable: ${unknownForkVariables.join(', ')}`)
      return
    }
    if (forkCommandTemplate.trim() && !forkCommandTemplate.includes('{provider_session_id}')) {
      setValidationMessage('fork command needs {provider_session_id}')
      return
    }
    if (forkCommandTemplate.trim() && !forkCommandTemplate.includes('{prompt}')) {
      setValidationMessage('fork command needs {prompt}')
      return
    }
    if (defaultCwdKind === 'custom' && !customCwd.trim()) {
      setValidationMessage('custom cwd is required when cwd mode is custom')
      return
    }
    if (invalidEnvLines.length > 0) {
      setValidationMessage(`environment lines need KEY=value: ${invalidEnvLines.join(', ')}`)
      return
    }
    setValidationMessage('profile looks ready')
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.rail}>
        <button
          type="button"
          className={`${styles.profileButton} ${selectedProfileKey === 'new' ? styles.selected : ''}`}
          onClick={() => setSelectedProfileKey('new')}
        >
          <span>
            <strong>new profile</strong>
            <Plus size={14} />
          </span>
        </button>

        <div className={styles.profileList}>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={`${styles.profileButton} ${selectedProfile?.id === profile.id ? styles.selected : ''}`}
              onClick={() => setSelectedProfileKey(String(profile.id))}
              title={profile.commandTemplate}
            >
              <span>
                <strong>{profile.name}</strong>
                <small>{profile.shortRef}</small>
              </span>
              <small>{profile.environment}{profile.wslDistro ? `/${profile.wslDistro}` : ''}</small>
              <small>env {Object.keys(profile.env).length}</small>
              <p>{profile.commandTemplate}</p>
            </button>
          ))}
        </div>
      </div>

      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
        <div className={styles.header}>
          <div>
            <span className={styles.label}>{selectedProfile ? `${selectedProfile.name} profile` : 'new profile'}</span>
            {selectedProfile ? <small>{selectedProfile.shortRef}</small> : null}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={validateProfileDraft}>
              validate
            </button>
            <button type="submit" disabled={!ready || !dirty || (selectedProfile ? isUpdating : isCreating)}>
              {selectedProfile ? (isUpdating ? 'saving' : 'save profile') : isCreating ? 'creating' : 'add profile'}
            </button>
          </div>
        </div>

        <label className={styles.field}>
          <span>name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="default agent" />
        </label>

        <label className={styles.field}>
          <span>command template</span>
          <input value={commandTemplate} onChange={(event) => setCommandTemplate(event.target.value)} placeholder={DEFAULT_AGENT_COMMAND_TEMPLATE} />
          {unknownVariables.length > 0 ? (
            <small className={styles.error}>unknown variable: {unknownVariables.join(', ')}</small>
          ) : null}
        </label>

        <label className={styles.field}>
          <span>fork command template</span>
          <input
            value={forkCommandTemplate}
            onChange={(event) => setForkCommandTemplate(event.target.value)}
            placeholder={DEFAULT_FORK_COMMAND_TEMPLATE}
          />
          {unknownForkVariables.length > 0 ? (
            <small className={styles.error}>unknown variable: {unknownForkVariables.join(', ')}</small>
          ) : null}
          {forkCommandTemplate.trim() && !forkCommandTemplate.includes('{provider_session_id}') ? (
            <small className={styles.error}>requires {'{provider_session_id}'}</small>
          ) : null}
          {forkCommandTemplate.trim() && !forkCommandTemplate.includes('{prompt}') ? (
            <small className={styles.error}>requires {'{prompt}'}</small>
          ) : null}
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>environment</span>
            <select value={environment} onChange={(event) => setEnvironment(event.target.value as 'windows' | 'wsl')}>
              <option value="windows">windows</option>
              <option value="wsl">wsl</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>wsl distro</span>
            <input
              value={wslDistro}
              onChange={(event) => setWslDistro(event.target.value)}
              placeholder="default"
              disabled={environment !== 'wsl'}
            />
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>cwd mode</span>
            <select
              value={defaultCwdKind}
              onChange={(event) => setDefaultCwdKind(event.target.value as AgentProfile['defaultCwdKind'])}
            >
              <option value="task_worktree">task worktree</option>
              <option value="repo_root">repo root</option>
              <option value="custom">custom</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>custom cwd</span>
            <PathPicker
              ariaLabel="custom cwd"
              value={customCwd}
              onChange={setCustomCwd}
              placeholder="custom working directory"
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>environment variables</span>
          <textarea
            value={envText}
            onChange={(event) => setEnvText(event.target.value)}
            placeholder={'KEY=value\nOTHER=value'}
            rows={5}
            spellCheck={false}
          />
          {invalidEnvLines.length > 0 ? (
            <small className={styles.error}>invalid lines: {invalidEnvLines.join(', ')}</small>
          ) : null}
        </label>

        <div className={styles.variables}>
          <span>template variables</span>
          <code>{'{prompt}'}</code>
          <code>{'{effort_ref}'}</code>
          <code>{'{task_ref}'}</code>
          <code>{'{plan_ref}'}</code>
          <code>{'{review_ref}'}</code>
          <code>{'{worktree_path}'}</code>
          <code>{'{repo_path}'}</code>
          <code>{'{provider_session_id}'}</code>
        </div>

        {validationMessage ? <p className={styles.validation}>{validationMessage}</p> : null}
      </form>
    </div>
  )
}

function formatEnv(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n')
}

function parseEnv(value: string): Record<string, string> {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf('=')
      if (separator === -1) return null
      const name = line.slice(0, separator).trim()
      const envValue = line.slice(separator + 1).trim()
      return name ? [name, envValue] as const : null
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry))

  return Object.fromEntries(entries)
}

function findInvalidEnvLines(value: string): string[] {
  return value
    .split('\n')
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter(({ line }) => line.length > 0 && !/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(line))
    .map(({ index }) => String(index))
}

const TEMPLATE_VARIABLES = new Set([
  'prompt',
  'effort_ref',
  'task_ref',
  'plan_ref',
  'review_ref',
  'worktree_path',
  'repo_path',
])

const FORK_TEMPLATE_VARIABLES = new Set([
  'provider_session_id',
  'prompt',
  'effort_ref',
  'task_ref',
  'plan_ref',
  'review_ref',
  'worktree_path',
  'repo_path',
])

function findUnknownTemplateVariables(value: string): string[] {
  return findUnknownVariables(value, TEMPLATE_VARIABLES)
}

function findUnknownForkTemplateVariables(value: string): string[] {
  return findUnknownVariables(value, FORK_TEMPLATE_VARIABLES)
}

function findUnknownVariables(value: string, allowed: Set<string>): string[] {
  const matches = value.matchAll(/\{([^}]+)\}/g)
  return Array.from(new Set(
    Array.from(matches)
      .map((match) => match[1])
      .filter((name) => !allowed.has(name)),
  ))
}
