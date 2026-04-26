import os from 'node:os'
import path from 'node:path'

export type AppPaths = {
  home: string
  databasePath: string
  configPath: string
}

export function getAppPaths(): AppPaths {
  const home =
    process.env.EFFORTLESS_HOME ??
    path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'effortless')

  return {
    home,
    databasePath: process.env.EFFORTLESS_DB ?? path.join(home, 'effortless.db'),
    configPath: path.join(home, 'config.json'),
  }
}
