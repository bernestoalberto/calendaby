import type { DatabaseSync } from 'node:sqlite'
import { BabyEvent } from '../src/domain/events.js'

function memoryDb() {
  const rows = new Map<string, BabyEvent>()
  return {
    insert(events: BabyEvent[]): number {
      let stored = 0
      for (const e of events) {
        if (!rows.has(e.id)) {
          rows.set(e.id, e)
          stored++
        }
      }
      return stored
    },
    since(at: number): BabyEvent[] {
      return [...rows.values()].filter((e) => e.at >= at).sort((a, b) => a.at - b.at)
    },
  }
}

export function openDb(path: string = process.env.DB_PATH || (process.env.VERCEL ? '/tmp/calendaby.db' : 'calendaby.db')) {
  const sqlite = process.getBuiltinModule?.('node:sqlite') as { DatabaseSync?: typeof DatabaseSync } | undefined
  if (!sqlite?.DatabaseSync) return memoryDb()
  let db: DatabaseSync
  try {
    db = new sqlite.DatabaseSync(path)
  } catch {
    return memoryDb()
  }
  db.exec('create table if not exists events (id text primary key, at integer not null, event text not null)')
  const insert = db.prepare('insert or ignore into events (id, at, event) values (?, ?, ?)')
  const since = db.prepare('select event from events where at >= ? order by at')

  return {
    insert(events: BabyEvent[]): number {
      let stored = 0
      for (const e of events) stored += Number(insert.run(e.id, e.at, JSON.stringify(e)).changes)
      return stored
    },
    since(at: number): BabyEvent[] {
      return since.all(at).map((row) => BabyEvent.parse(JSON.parse(String(row.event))))
    },
  }
}

export type Db = ReturnType<typeof openDb>
