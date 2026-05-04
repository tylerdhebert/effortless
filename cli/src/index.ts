import { rawArgs } from './args'
import { printHelp } from './render'
import { handleBuild } from './commands/build'
import { handleDiscuss } from './commands/discuss'
import { handleEffort } from './commands/effort'
import { handleInput } from './commands/input'
import { handleMandate } from './commands/mandate'
import { handlePlan } from './commands/plan'
import { handlePlaybook } from './commands/playbook'
import { handleRef } from './commands/ref'
import { handleRepo } from './commands/repo'
import { handleReview } from './commands/review'
import { handleTask } from './commands/task'

async function main() {
  const [surface, command] = rawArgs

  if (!surface || !command) {
    printHelp()
    return
  }

  const handlers = [
    handleTask,
    handlePlan,
    handleReview,
    handleBuild,
    handleRepo,
    handleInput,
    handleMandate,
    handleRef,
    handleEffort,
    handlePlaybook,
    handleDiscuss,
  ]

  for (const handler of handlers) {
    const handled = await handler(surface, command)
    if (handled) {
      return
    }
  }

  printHelp()
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
