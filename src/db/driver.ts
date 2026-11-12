export type SqlValue = string | number | null

export interface SqlStatement {
  sql: string
  params?: SqlValue[]
}

/** The few calls the app needs, implemented by SQLite WASM on the web and the Capacitor plugin on iOS/Android. */
export interface SqlDriver {
  exec(sql: string, params?: SqlValue[]): Promise<void>
  /** Runs every statement in one transaction: all of them are saved, or none. */
  batch(statements: SqlStatement[]): Promise<void>
  query<T extends Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>
  /** False when the browser could not give us durable storage and data lives only until reload. */
  readonly persistent: boolean
}
