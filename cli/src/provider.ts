import type { AgentProfile } from '../../core/types'

export type Provider = 'codex' | 'opencode' | 'claude' | 'custom'

export interface ProviderConfig {
  label: string
  envVar: string | null
  resumeCommand: ((sessionId: string) => string) | null
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  codex: {
    label: 'codex',
    envVar: 'CODEX_THREAD_ID',
    resumeCommand: (sessionId) => `codex resume ${sessionId}`,
  },
  opencode: {
    label: 'opencode',
    envVar: null,
    resumeCommand: null,
  },
  claude: {
    label: 'claude',
    envVar: null,
    resumeCommand: null,
  },
  custom: {
    label: 'custom',
    envVar: null,
    resumeCommand: null,
  },
}

export function inferProvider(profile: AgentProfile): Provider {
  const cmd = profile.commandTemplate.toLowerCase()
  if (cmd.includes('codex')) return 'codex'
  if (cmd.includes('opencode')) return 'opencode'
  if (cmd.includes('claude')) return 'claude'
  return 'custom'
}

export function resolveProvider(label?: string | null): Provider {
  if (label && label in PROVIDERS) return label as Provider
  throw new Error(`Unknown provider: ${label}`)
}

export function resolveSessionId(
  provider: Provider,
  explicitId?: string | null,
): string {
  if (explicitId) return explicitId

  const envVar = PROVIDERS[provider].envVar
  if (envVar) {
    const value = process.env[envVar]
    if (value) return value
  }

  const providerLabel = PROVIDERS[provider].label
  throw new Error(
    `No ${providerLabel} session id found. Pass --id or run this command inside ${providerLabel}.`,
  )
}

export function getResumeCommand(
  provider: Provider,
  sessionId: string,
): string | null {
  const resumeFn = PROVIDERS[provider].resumeCommand
  return resumeFn ? resumeFn(sessionId) : null
}
