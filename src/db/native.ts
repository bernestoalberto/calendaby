import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import type { SqlDriver, SqlValue } from './driver'

/** The device's own SQLite on iOS and Android. */
export class NativeSqlDriver implements SqlDriver {
  readonly persistent = true
  private readonly conn: SQLiteDBConnection

  private constructor(conn: SQLiteDBConnection) {
    this.conn = conn
  }

  static async open(): Promise<NativeSqlDriver> {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const conn = await sqlite.createConnection('calendaby', false, 'no-encryption', 1, false)
    await conn.open()
    return new NativeSqlDriver(conn)
  }

  async exec(sql: string, params: SqlValue[] = []): Promise<void> {
    if (params.length) await this.conn.run(sql, params, false)
    else await this.conn.execute(sql, false)
  }

  async query<T extends Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return ((await this.conn.query(sql, params)).values ?? []) as T[]
  }
}
