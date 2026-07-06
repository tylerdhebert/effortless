declare module 'better-sqlite3' {
  type RunResult = {
    changes: number
    lastInsertRowid: number | bigint
  }

  type Statement<T = unknown> = {
    run(...params: unknown[]): RunResult
    get(...params: unknown[]): T | undefined
    all(...params: unknown[]): T[]
  }

  export default class Database {
    constructor(filename: string, options?: Record<string, unknown>)
    exec(source: string): this
    pragma(source: string, options?: { simple?: boolean }): unknown
    prepare<T = unknown>(source: string): Statement<T>
  }
}
