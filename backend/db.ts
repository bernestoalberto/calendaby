import type { DatabaseSync } from 'node:sqlite'
import { Appointment } from '../src/domain/appointments.js'
import { BabyEvent } from '../src/domain/events.js'

function byStart(a: Appointment, b: Appointment): number {
  return (a.startsAt ?? Infinity) - (b.startsAt ?? Infinity)
}

function confirmable(a: Appointment, status: 'confirmed' | 'dismissed'): boolean {
  return status === 'dismissed' || a.startsAt !== undefined
}

function memoryDb() {
  const rows = new Map<string, BabyEvent>()
  const appts = new Map<string, Appointment>()
  return {
    putAppointments(list: Appointment[]): number {
      let added = 0
      for (const a of list) {
        if (!appts.has(a.id)) {
          appts.set(a.id, a)
          added++
        }
      }
      return added
    },
    appointments(): Appointment[] {
      return [...appts.values()].sort(byStart)
    },
    setAppointmentStatus(id: string, status: 'confirmed' | 'dismissed'): boolean {
      const a = appts.get(id)
      if (!a || !confirmable(a, status)) return false
      appts.set(id, { ...a, status })
      return true
    },
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
  db.exec('create table if not exists appointments (id text primary key, appointment text not null)')
  const putAppt = db.prepare('insert or ignore into appointments (id, appointment) values (?, ?)')
  const allAppts = db.prepare('select appointment from appointments')
  const oneAppt = db.prepare('select appointment from appointments where id = ?')
  const updateAppt = db.prepare('update appointments set appointment = ? where id = ?')
  const insert = db.prepare('insert or ignore into events (id, at, event) values (?, ?, ?)')
  const since = db.prepare('select event from events where at >= ? order by at')

  return {
    putAppointments(list: Appointment[]): number {
      let added = 0
      for (const a of list) added += Number(putAppt.run(a.id, JSON.stringify(a)).changes)
      return added
    },
    appointments(): Appointment[] {
      return allAppts
        .all()
        .map((row) => Appointment.parse(JSON.parse(String(row.appointment))))
        .sort(byStart)
    },
    setAppointmentStatus(id: string, status: 'confirmed' | 'dismissed'): boolean {
      const row = oneAppt.get(id)
      if (!row) return false
      const a = Appointment.parse(JSON.parse(String(row.appointment)))
      if (!confirmable(a, status)) return false
      return Number(updateAppt.run(JSON.stringify({ ...a, status }), id).changes) > 0
    },
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
