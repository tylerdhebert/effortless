#!/usr/bin/env -S node --import tsx
import { runCli } from './src/index.ts'

runCli().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
