import type { AppDatabase } from './db'
import { bumpAppState } from './db'
import { AGENT_PROVIDERS } from './agentProviders'
import type { AgentProvider, RunEnvironment } from './types'

export type ProviderEnvironmentSetting = {
  provider: AgentProvider
  environment: RunEnvironment
  wslDistro: string | null
}

type ProviderSettingsRow = {
  provider: AgentProvider
  environment: string
  wsl_distro: string | null
}

export function listProviderSettings(db: AppDatabase): ProviderEnvironmentSetting[] {
  const rows = db.prepare<ProviderSettingsRow>(`SELECT provider, environment, wsl_distro FROM provider_settings`).all()
  const rowsByProvider = new Map(rows.map((row) => [row.provider, row]))

  return (Object.keys(AGENT_PROVIDERS) as AgentProvider[]).map((provider) => {
    const row = rowsByProvider.get(provider)
    return {
      provider,
      environment: normalizeEnvironment(row?.environment),
      wslDistro: normalizeWslDistro(row?.wsl_distro),
    }
  })
}

export function getProviderEnvironment(
  db: AppDatabase,
  provider: AgentProvider,
): { environment: RunEnvironment; wslDistro: string | null } {
  const row = db
    .prepare<ProviderSettingsRow>(`SELECT provider, environment, wsl_distro FROM provider_settings WHERE provider = ?`)
    .get(provider)

  return {
    environment: normalizeEnvironment(row?.environment),
    wslDistro: normalizeWslDistro(row?.wsl_distro),
  }
}

export function setProviderEnvironment(
  db: AppDatabase,
  provider: AgentProvider,
  environment: RunEnvironment,
  wslDistro: string | null,
): ProviderEnvironmentSetting {
  const normalizedEnvironment = normalizeEnvironment(environment)
  const normalizedDistro = normalizeWslDistro(wslDistro)

  db.prepare(`
    INSERT INTO provider_settings (provider, environment, wsl_distro)
    VALUES (?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      environment = excluded.environment,
      wsl_distro = excluded.wsl_distro
  `).run(provider, normalizedEnvironment, normalizedDistro)

  bumpAppState(db)
  return { provider, environment: normalizedEnvironment, wslDistro: normalizedDistro }
}

function normalizeEnvironment(environment: string | null | undefined): RunEnvironment {
  return environment === 'wsl' ? 'wsl' : 'windows'
}

function normalizeWslDistro(wslDistro: string | null | undefined): string | null {
  const trimmed = wslDistro?.trim()
  return trimmed ? trimmed : null
}
