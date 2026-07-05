import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rawArgs, setRawArgs, wantsHelp } from './args'
import { printHelp, resolveHelpDomain } from './help'
import { handleBuild } from './commands/build'
import { handleEffort } from './commands/effort'
import { handleInput } from './commands/input'
import { handleMandate } from './commands/mandate'
import { handlePlan } from './commands/plan'
import { handlePlaybook } from './commands/playbook'
import { handleRepo } from './commands/repo'
import { handleResume } from './commands/resume'
import { handleReview } from './commands/review'
import { handleRun } from './commands/run'
import { handleSession } from './commands/session'
import { handleTask } from './commands/task'
import { ensureCliDatabase, setCliDatabase } from './context'
import type { AppDatabase } from '../../core/db'

export async function runCli(args = rawArgs, database?: AppDatabase): Promise<void> {
  setRawArgs(args)
  if (database) {
    setCliDatabase(database)
  } else {
    ensureCliDatabase()
  }

  const [surface, command] = args

  if (wantsHelp() && (!surface || command === 'help')) {
    printHelp(resolveHelpDomain(surface) ?? 'root')
    return
  }

  if (!surface || command === 'help') {
    printHelp(resolveHelpDomain(surface) ?? 'root')
    return
  }

  if (wantsHelp()) {
    printHelp(resolveHelpDomain(surface) ?? 'root')
    return
  }

  const handlers = [
    handleTask,
    handlePlan,
    handleReview,
    handleRun,
    handleBuild,
    handleRepo,
    handleInput,
    handleMandate,
    handleEffort,
    handlePlaybook,
    handleSession,
    handleResume,
  ]

  for (const handler of handlers) {
    const handled = await handler(surface, command)
    if (handled) {
      return
    }
  }

  const domain = resolveHelpDomain(surface)
  if (domain) {
    printHelp(domain)
    return
  }
  printHelp('root')
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : null
if (executedPath && fileURLToPath(import.meta.url) === executedPath) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
