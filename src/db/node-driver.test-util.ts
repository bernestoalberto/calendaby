import { DatabaseSync } from 'node:sqlite'
import type { SqlDriver, SqlValue } from './driver'

/** Node's built-in SQLite, so store tests run the real SQL without a browser or device. */
export class NodeSqlDriver implements SqlDriver {
  readonly persistent = true
  readonly db: DatabaseSync

  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path)
  }

  async exec(sql: string, params: SqlValue[] = []): Promise<void> {
    if (params.length) this.db.prepare(sql).run(...params)
    else this.db.exec(sql)
  }

  async query<T extends Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[]
  }
}
