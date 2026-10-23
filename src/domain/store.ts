import { z } from 'zod'
import type { SqlDriver } from '../db/driver'
import { BabyEvent, type DraftEvent } from './events'

export interface EventStore {
  list(): BabyEvent[]
  append(draft: DraftEvent, loggedBy: string): Promise<BabyEvent>
  remove(id: string): Promise<void>
}

/** Two events of the same kind within this window are treated as one. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000

export class DuplicateEventError extends Error {
  readonly existing: BabyEvent

  constructor(existing: BabyEvent) {
    super(`Looks like a duplicate of the ${existing.kind} logged at ${new Date(existing.at).toLocaleTimeString()}`)
    this.existing = existing
  }
}

export function findDuplicate(events: BabyEvent[], draft: DraftEvent): BabyEvent | undefined {
  return events.find(
    (e) =>
      e.kind === draft.kind &&
      Math.abs(e.at - draft.at) < DUPLICATE_WINDOW_MS &&
      (e.kind !== 'sleep' || draft.kind !== 'sleep' || e.phase === draft.phase),
  )
}

// crypto.randomUUID exists only on https or localhost; getRandomValues works everywhere.
function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

const SCHEMA_VERSION = 1

const MIGRATIONS: Record<number, string[]> = {
  1: [
    `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      at INTEGER NOT NULL,
      logged_by TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS events_at ON events(at)',
    'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  ],
}

/** The localStorage key the first MVP used; its events move into SQLite on first open. */
export const LEGACY_KEY = 'calendaby.events.v1'

/**
 * Events in SQLite, with an in-memory copy so the UI reads synchronously.
 * Each row keeps the full event as JSON and is validated again on read.
 */
export class SqliteEventStore implements EventStore {
  private events: BabyEvent[] = []
  private readonly db: SqlDriver
  private readonly newId: () => string

  private constructor(db: SqlDriver, newId: () => string) {
    this.db = db
    this.newId = newId
  }

  static async open(
    db: SqlDriver,
    legacy?: Storage,
    newId: () => string = randomId,
  ): Promise<SqliteEventStore> {
    const store = new SqliteEventStore(db, newId)
    await store.migrate()
    if (legacy) await store.importLegacy(legacy)
    await store.load()
    return store
  }

  get persistent(): boolean {
    return this.db.persistent
  }

  private async migrate(): Promise<void> {
    const [{ user_version }] = await this.db.query<{ user_version: number }>('PRAGMA user_version')
    for (let v = user_version + 1; v <= SCHEMA_VERSION; v++) {
      for (const sql of MIGRATIONS[v]) await this.db.exec(sql)
      await this.db.exec(`PRAGMA user_version = ${v}`)
    }
  }

  private async importLegacy(storage: Storage): Promise<void> {
    const raw = storage.getItem(LEGACY_KEY)
    if (!raw) return
    const parsed = z.array(BabyEvent).safeParse(JSON.parse(raw))
    if (parsed.success) {
      for (const e of parsed.data) await this.insert(e, 'INSERT OR IGNORE')
    }
    // Keep a copy under another key rather than deleting the parent's only backup.
    storage.setItem(`${LEGACY_KEY}.migrated`, raw)
    storage.removeItem(LEGACY_KEY)
  }

  private async load(): Promise<void> {
    const rows = await this.db.query<{ body: string }>('SELECT body FROM events ORDER BY at')
    this.events = rows.flatMap((r) => {
      const parsed = BabyEvent.safeParse(JSON.parse(r.body))
      return parsed.success ? [parsed.data] : []
    })
  }

  private insert(e: BabyEvent, verb: 'INSERT' | 'INSERT OR IGNORE' = 'INSERT'): Promise<void> {
    return this.db.exec(
      `${verb} INTO events (id, kind, at, logged_by, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [e.id, e.kind, e.at, e.loggedBy, JSON.stringify(e), Date.now()],
    )
  }

  list(): BabyEvent[] {
    return [...this.events]
  }

  async append(draft: DraftEvent, loggedBy: string): Promise<BabyEvent> {
    const dup = findDuplicate(this.events, draft)
    if (dup) throw new DuplicateEventError(dup)
    const event = BabyEvent.parse({ ...draft, id: this.newId(), loggedBy })
    await this.insert(event)
    this.events = [...this.events, event].sort((a, b) => a.at - b.at)
    return event
  }

  async remove(id: string): Promise<void> {
    await this.db.exec('DELETE FROM events WHERE id = ?', [id])
    this.events = this.events.filter((e) => e.id !== id)
  }

  async getSetting(key: string): Promise<string | undefined> {
    const rows = await this.db.query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
    return rows[0]?.value
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db.exec(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    )
  }
}
