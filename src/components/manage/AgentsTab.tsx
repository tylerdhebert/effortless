import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgentProvider, RunEnvironment } from '../../../core/types'
import type { AgentProviderConfig } from '../../../core/agentProviders'
import { listAgentProviders } from '../../../core/agentProviders'
import type { ProviderEnvironmentSetting } from '../../../core/providerSettings'
import styles from './AgentsTab.module.css'

type UpdateProviderEnvironmentInput = {
  provider: AgentProvider
  environment: RunEnvironment
  wslDistro: string | null
}

export function AgentsTab() {
  const queryClient = useQueryClient()
  const providers = useMemo(() => listAgentProviders(), [])
  const isWindows = window.effortless.platform === 'win32'
  const settingsQuery = useQuery({
    queryKey: ['provider-settings'],
    queryFn: () => window.effortless.listProviderSettings(),
  })
  const updateProviderEnvironment = useMutation({
    mutationFn: (input: UpdateProviderEnvironmentInput) =>
      window.effortless.updateProviderEnvironment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-settings'] })
    },
  })

  const settingsByProvider = new Map(
    (settingsQuery.data ?? []).map((setting) => [setting.provider, setting]),
  )

  return (
    <div className={styles['agents-list']}>
      {providers.map((provider) => (
        <AgentRow
          key={provider.key}
          provider={provider}
          setting={settingsByProvider.get(provider.key) ?? null}
          isWindows={isWindows}
          onUpdate={(input) => updateProviderEnvironment.mutate(input)}
        />
      ))}
    </div>
  )
}

function AgentRow({
  provider,
  setting,
  isWindows,
  onUpdate,
}: {
  provider: AgentProviderConfig
  setting: ProviderEnvironmentSetting | null
  isWindows: boolean
  onUpdate: (input: UpdateProviderEnvironmentInput) => void
}) {
  const environment = setting?.environment ?? 'windows'
  const wslDistro = setting?.wslDistro ?? ''
  const [distroDraft, setDistroDraft] = useState(wslDistro)

  useEffect(() => {
    setDistroDraft(wslDistro)
  }, [wslDistro])

  const commitDistro = () => {
    if (distroDraft.trim() === wslDistro) return
    onUpdate({ provider: provider.key, environment, wslDistro: distroDraft })
  }

  return (
    <div className={styles['agent-row']}>
      <div className={styles['agent-identity']}>
        <strong>{provider.name}</strong>
        <small>{provider.key}</small>
      </div>

      {isWindows ? (
        <div className={styles['agent-controls']}>
          <label className={styles['agent-field']}>
            <span>runs in</span>
            <select
              aria-label={`${provider.name} run environment`}
              value={environment}
              onChange={(event) => {
                const nextEnvironment = event.target.value as RunEnvironment
                onUpdate({
                  provider: provider.key,
                  environment: nextEnvironment,
                  wslDistro: distroDraft,
                })
              }}
            >
              <option value="windows">native</option>
              <option value="wsl">wsl</option>
            </select>
          </label>
          {environment === 'wsl' ? (
            <label className={styles['agent-field']}>
              <span>distro</span>
              <input
                aria-label={`${provider.name} wsl distro`}
                placeholder="default distro"
                value={distroDraft}
                onChange={(event) => setDistroDraft(event.target.value)}
                onBlur={commitDistro}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
              />
            </label>
          ) : null}
        </div>
      ) : (
        <span className={styles['native-note']}>runs natively</span>
      )}
    </div>
  )
}
