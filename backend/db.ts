import { DatabaseSync } from 'node:sqlite'
import { BabyEvent } from '../src/domain/events'

export function openDb(path: string = process.env.DB_PATH ?? 'calendaby.db') {
  const db = new DatabaseSync(path)
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
