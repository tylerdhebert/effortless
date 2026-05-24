import type { AgentProvider, RunEnvironment } from './types'

export const DEFAULT_AGENT_PROVIDER: AgentProvider = 'codex'

export type AgentProviderConfig = {
  key: AgentProvider
  name: string
  commandTemplate: string
  windowsCommandTemplate?: string
  resumeCommandTemplate: string
  windowsResumeCommandTemplate?: string
  forkCommandTemplate?: string
  windowsForkCommandTemplate?: string
  preseedSessionId?: boolean
  sessionHint: string
}

export const AGENT_PROVIDERS: Record<AgentProvider, AgentProviderConfig> = {
  codex: {
    key: 'codex',
    name: 'Codex',
    commandTemplate: 'codex {prompt}',
    resumeCommandTemplate: 'codex resume {provider_session_id}',
    forkCommandTemplate: 'codex resume {provider_session_id} {prompt}',
    sessionHint: 'First, run: efl session set --run {run_ref}',
  },
  claude: {
    key: 'claude',
    name: 'Claude Code',
    commandTemplate: 'claude --session-id {provider_session_id} {prompt}',
    resumeCommandTemplate: 'claude --resume {provider_session_id}',
    forkCommandTemplate: 'claude --resume {provider_session_id} --fork-session {prompt}',
    preseedSessionId: true,
    sessionHint: 'Effortless pre-registered this Claude Code session id.',
  },
  opencode: {
    key: 'opencode',
    name: 'OpenCode',
    commandTemplate: 'opencode --prompt {prompt}',
    resumeCommandTemplate: 'opencode --session {provider_session_id}',
    forkCommandTemplate: 'opencode --session {provider_session_id} --fork --prompt {prompt}',
    sessionHint: 'First, run: efl session set --run {run_ref}. Effortless will match OpenCode by this run timestamp and cwd.',
  },
  cursor: {
    key: 'cursor',
    name: 'Cursor',
    commandTemplate: 'cursor-agent {prompt}',
    windowsCommandTemplate: 'cursor-agent {prompt}',
    resumeCommandTemplate: 'cursor-agent --resume {provider_session_id}',
    windowsResumeCommandTemplate: 'cursor-agent --resume {provider_session_id}',
    sessionHint: 'First, run: efl session set --run {run_ref}. Effortless will match Cursor by this run timestamp and cwd.',
  },
  copilot: {
    key: 'copilot',
    name: 'Copilot',
    commandTemplate: 'copilot --interactive={prompt}',
    resumeCommandTemplate: 'copilot --resume {provider_session_id}',
    sessionHint: 'First, run: efl session set --run {run_ref}. Effortless will match Copilot by this run timestamp and cwd.',
  },
}

export function listAgentProviders(): AgentProviderConfig[] {
  return Object.values(AGENT_PROVIDERS)
}

export function getAgentProviderConfig(provider: AgentProvider): AgentProviderConfig {
  return AGENT_PROVIDERS[provider]
}

export function parseAgentProvider(value: string | null | undefined): AgentProvider {
  if (value && value in AGENT_PROVIDERS) {
    return value as AgentProvider
  }
  throw new Error(`Unknown provider: ${value}`)
}

export function resolveProviderCommandTemplate(
  config: AgentProviderConfig,
  kind: 'start' | 'resume' | 'fork',
  environment: RunEnvironment,
): string | null {
  if (kind === 'start') {
    return environment === 'windows'
      ? config.windowsCommandTemplate ?? config.commandTemplate
      : config.commandTemplate
  }
  if (kind === 'resume') {
    return environment === 'windows'
      ? config.windowsResumeCommandTemplate ?? config.resumeCommandTemplate
      : config.resumeCommandTemplate
  }
  return environment === 'windows'
    ? config.windowsForkCommandTemplate ?? config.forkCommandTemplate ?? null
    : config.forkCommandTemplate ?? null
}
