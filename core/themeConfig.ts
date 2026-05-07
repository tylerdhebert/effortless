import fs from 'node:fs/promises'
import { getAppPaths } from './appPaths'

export type CustomThemeState = {
  customThemeActive: boolean
  customThemePalette: Record<string, string> | null
}

type AppConfig = {
  customThemeActive?: boolean
  customThemePalette?: Record<string, string> | null
}

const DEFAULT_CUSTOM_THEME_STATE: CustomThemeState = {
  customThemeActive: false,
  customThemePalette: null,
}

async function readAppConfig(): Promise<AppConfig> {
  const { configPath } = getAppPaths()
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as AppConfig
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError?.code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

async function writeAppConfig(nextConfig: AppConfig): Promise<void> {
  const { home, configPath } = getAppPaths()
  await fs.mkdir(home, { recursive: true })
  await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8')
}

export async function getCustomThemeState(): Promise<CustomThemeState> {
  const config = await readAppConfig()
  const palette =
    config.customThemePalette && typeof config.customThemePalette === 'object'
      ? Object.fromEntries(
          Object.entries(config.customThemePalette).filter(
            ([key, value]) => typeof key === 'string' && typeof value === 'string',
          ),
        )
      : null

  return {
    customThemeActive: Boolean(config.customThemeActive),
    customThemePalette: palette,
  }
}

export async function updateCustomThemeState(nextState: CustomThemeState): Promise<CustomThemeState> {
  const config = await readAppConfig()
  const merged: AppConfig = {
    ...config,
    customThemeActive: nextState.customThemeActive,
    customThemePalette: nextState.customThemePalette,
  }
  await writeAppConfig(merged)
  return getCustomThemeState()
}
