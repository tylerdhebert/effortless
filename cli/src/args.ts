import { readFileSync } from 'node:fs'

export let rawArgs = process.argv.slice(2)

export function setRawArgs(args: string[]): void {
  rawArgs = args
}

export function option(name: string): string | null {
  const index = rawArgs.indexOf(name)

  if (index === -1) {
    return null
  }

  return rawArgs[index + 1] ?? null
}

export function requiredOption(name: string): string {
  const value = option(name)

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

export function bodyArg(): string {
  const fromFile = option('--from-file')
  if (fromFile) {
    return readFileSync(fromFile, 'utf-8')
  }

  const body = option('--body')

  if (body) {
    return body
  }

  const freeArgs: string[] = []
  for (let index = 2; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    if (arg.startsWith('--')) {
      index += 1
      continue
    }

    freeArgs.push(arg)
  }

  if (freeArgs.length > 0) {
    return freeArgs.join(' ')
  }

  throw new Error('body is required')
}

export function parseChoices(value: string | null): { value: string; label: string }[] | null {
  if (!value) {
    return null
  }

  return value
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [choiceValue, ...labelParts] = part.split(':')
      return {
        value: choiceValue.trim(),
        label: labelParts.join(':').trim() || choiceValue.trim(),
      }
    })
}
