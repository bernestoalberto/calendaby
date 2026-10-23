export type SqlValue = string | number | null

/** The few calls the app needs, implemented by SQLite WASM on the web and the Capacitor plugin on iOS/Android. */
export interface SqlDriver {
  exec(sql: string, params?: SqlValue[]): Promise<void>
  query<T extends Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>
  /** False when the browser could not give us durable storage and data lives only until reload. */
  readonly persistent: boolean
}
