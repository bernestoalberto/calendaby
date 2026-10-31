import { z } from 'zod'
import type { SqlDriver } from '../db/driver'
import { BabyEvent, type DraftEvent } from './events'
import { activityId, type ActivityType } from './activities'
import type { AgeNorm } from './ageNorms'
import type { FeatureRow } from './features'
import { DEFAULT_LISTS, OPTION_LISTS, optionProblem, type ListId } from './options'
import { SEEDS, type Seed } from './seeds'
import { isSharedKey, SHARED_KEYS, type SettingChange, type SharedSetting } from './sharedSettings'

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
      (e.kind !== 'sleep' || draft.kind !== 'sleep' || e.phase === draft.phase) &&
      (e.kind !== 'activity' || draft.kind !== 'activity' || e.type === draft.type),
  )
}

// crypto.randomUUID exists only on https or localhost; getRandomValues works everywhere.
function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

const SCHEMA_VERSION = 10

// An entry this phone already had keeps its origin; the server also sends back what this phone uploaded.
const UPSERT_REMOTE_EVENT_SQL = `INSERT OR REPLACE INTO events (id, kind, at, logged_by, body, created_at, remote)
  VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT remote FROM events WHERE id = ?), 1))`
const DROP_REMOTE_PENDING_SQL = 'DELETE FROM sync_pending WHERE id IN (SELECT id FROM events WHERE remote = 1)'
const DROP_REMOTE_EVENTS_SQL = 'DELETE FROM events WHERE remote = 1'

const LIST_TABLES_SQL = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
const dropTableSql = (name: string) => `DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}"`

const sqlText = (v: string) => `'${v.replaceAll("'", "''")}'`

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
  2: [
    `CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      hint TEXT NOT NULL,
      grp TEXT NOT NULL,
      sort INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    )`,
  ],
  3: [
    `CREATE TABLE IF NOT EXISTS activity_types (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      sort INTEGER NOT NULL
    )`,
  ],
  // Version 4 once added crawling, walking and swimming; the seeds (seeds.ts) now plant every starting row.
  4: [],
  5: [
    `CREATE TABLE IF NOT EXISTS age_norms (
      from_weeks INTEGER PRIMARY KEY,
      to_weeks INTEGER NOT NULL,
      wake_min_low INTEGER NOT NULL,
      wake_min_high INTEGER NOT NULL,
      naps_low INTEGER NOT NULL,
      naps_high INTEGER NOT NULL
    )`,
    // An existing row is renamed here; the seed only adds rows that are missing.
    "UPDATE features SET label = 'Coming up & tonight', hint = 'Next nap, feed and bedtime with time ranges' WHERE id = 'insights'",
  ],
  // The outbox: one row per event with a change not yet sent. A new row number on every change lets a sync tell
  // "sent what I read" from "edited again while sending". Everything already on the phone is queued once.
  6: [
    `CREATE TABLE IF NOT EXISTS sync_pending (
      n INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      op TEXT NOT NULL CHECK (op IN ('put', 'delete'))
    )`,
    "INSERT OR IGNORE INTO sync_pending (id, op) SELECT id, 'put' FROM events ORDER BY at",
  ],
  // Bookkeeping for the settings the household shares (the values stay in `settings`). `version` goes up on every
  // local edit; a setting is unsent while version > synced. `fill` means "offer this, never override the family".
  7: [
    `CREATE TABLE IF NOT EXISTS shared_setting (
      key TEXT PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      synced INTEGER NOT NULL DEFAULT 0,
      fill INTEGER NOT NULL DEFAULT 1
    )`,
    `INSERT OR IGNORE INTO shared_setting (key) SELECT key FROM settings WHERE key IN (${SHARED_KEYS.map(sqlText).join(', ')})`,
  ],
  // The lists a parent can edit. Their starting rows come from the seeds.
  8: [
    `CREATE TABLE IF NOT EXISTS option_list (
      list TEXT NOT NULL,
      value TEXT NOT NULL,
      sort INTEGER NOT NULL,
      PRIMARY KEY (list, value)
    )`,
  ],
  // Which seeds this phone has already planted (see seeds.ts).
  9: ['CREATE TABLE IF NOT EXISTS seed_applied (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'],
  // 1 for an entry that first arrived from another caregiver's phone, so leaving a family can drop those and keep its own.
  // Entries already on a phone count as its own, because their origin was never recorded.
  10: ['ALTER TABLE events ADD COLUMN remote INTEGER NOT NULL DEFAULT 0'],
}

/** What a phone has to send: events to upload, ids to delete, and the outbox rows these came from. */
export interface PendingBatch {
  events: BabyEvent[]
  deleted: string[]
  sent: { n: number; id: string }[]
}

export interface RemoteChange {
  event: BabyEvent
  deleted: boolean
}

/** The localStorage key the first MVP used; its events move into SQLite on first open. */
export const LEGACY_KEY = 'calendaby.events.v1'

/**
 * Events in SQLite, with an in-memory copy so the UI reads synchronously.
 * Each row keeps the full event as JSON and is validated again on read.
 */
export class SqliteEventStore implements EventStore {
  private events: BabyEvent[] = []
  private settings = new Map<string, string>()
  private lists = new Map<string, string[]>()
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
    seeds: Seed[] = SEEDS,
  ): Promise<SqliteEventStore> {
    const store = new SqliteEventStore(db, newId)
    const from = await store.migrate()
    await store.plant(seeds, from)
    if (legacy) await store.importLegacy(legacy)
    await store.load()
    return store
  }

  get persistent(): boolean {
    return this.db.persistent
  }

  /**
   * SQLite cannot say "ADD COLUMN IF NOT EXISTS". If the app was closed after the column was added but before the version
   * number was saved, the step runs again, and a column that is already there is exactly what it wanted.
   */
  private async runStep(sql: string): Promise<void> {
    try {
      await this.db.exec(sql)
    } catch (err) {
      const again = /^ALTER TABLE \w+ ADD COLUMN/i.test(sql) && err instanceof Error && /duplicate column name/i.test(err.message)
      if (!again) throw err
    }
  }

  /** Runs the schema steps this phone has not had yet. Returns the version it started from. */
  private async migrate(): Promise<number> {
    const [{ user_version }] = await this.db.query<{ user_version: number }>('PRAGMA user_version')
    for (let v = user_version + 1; v <= SCHEMA_VERSION; v++) {
      for (const sql of MIGRATIONS[v]) await this.runStep(sql)
      await this.db.exec(`PRAGMA user_version = ${v}`)
    }
    return user_version
  }

  /** Plants each seed this phone has not had. `from` is the schema version the phone started at. */
  private async plant(seeds: Seed[], from: number): Promise<void> {
    const done = new Set((await this.db.query<{ id: string }>('SELECT id FROM seed_applied')).map((r) => r.id))
    for (const seed of seeds) {
      if (done.has(seed.id)) continue
      // A phone already past `since` got this data from the migrations that used to plant it; do not plant it again.
      if (!(from > 0 && from >= seed.since)) for (const sql of seed.statements) await this.db.exec(sql)
      await this.db.exec('INSERT OR IGNORE INTO seed_applied (id, applied_at) VALUES (?, ?)', [seed.id, Date.now()])
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
    for (const r of await this.db.query<{ key: string; value: string }>('SELECT key, value FROM settings')) this.settings.set(r.key, r.value)
    await this.loadLists()
    await this.reloadEvents()
  }

  private async reloadEvents(): Promise<void> {
    const rows = await this.db.query<{ body: string }>('SELECT body FROM events ORDER BY at')
    this.events = rows.flatMap((r) => {
      const parsed = BabyEvent.safeParse(JSON.parse(r.body))
      return parsed.success ? [parsed.data] : []
    })
  }

  private async insert(e: BabyEvent, verb: 'INSERT' | 'INSERT OR IGNORE' = 'INSERT'): Promise<void> {
    await this.db.exec(
      `${verb} INTO events (id, kind, at, logged_by, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [e.id, e.kind, e.at, e.loggedBy, JSON.stringify(e), Date.now()],
    )
    await this.queue(e.id, 'put')
  }

  /** REPLACE gives the row a new number, so a sync in flight will not clear a change made after it read. */
  private queue(id: string, op: 'put' | 'delete'): Promise<void> {
    return this.db.exec('INSERT OR REPLACE INTO sync_pending (id, op) VALUES (?, ?)', [id, op])
  }

  private async loadLists(): Promise<void> {
    this.lists.clear()
    const rows = await this.db.query<{ list: string; value: string }>('SELECT list, value FROM option_list ORDER BY sort, value')
    for (const r of rows) this.lists.set(r.list, [...(this.lists.get(r.list) ?? []), r.value])
  }

  /** What a list holds right now, in order. Read straight from memory, so screens need not wait. */
  options(list: ListId): string[] {
    return [...(this.lists.get(list) ?? [])]
  }

  allOptions(): Record<ListId, string[]> {
    return Object.fromEntries(OPTION_LISTS.map((l) => [l.id, this.options(l.id)])) as Record<ListId, string[]>
  }

  async addOption(list: ListId, raw: string): Promise<void> {
    const problem = optionProblem(list, raw)
    if (problem) throw new Error(problem)
    await this.db.exec(
      'INSERT OR IGNORE INTO option_list (list, value, sort) VALUES (?, ?, (SELECT COALESCE(MAX(sort), -1) + 1 FROM option_list WHERE list = ?))',
      [list, raw.trim(), list],
    )
    await this.loadLists()
  }

  async removeOption(list: ListId, value: string): Promise<void> {
    await this.db.exec('DELETE FROM option_list WHERE list = ? AND value = ?', [list, value])
    await this.loadLists()
  }

  /** Puts back any of the original items that were removed; anything added stays. */
  async restoreOptions(list: ListId): Promise<void> {
    for (const [i, value] of DEFAULT_LISTS[list].entries()) {
      await this.db.exec('INSERT OR IGNORE INTO option_list (list, value, sort) VALUES (?, ?, ?)', [list, value, i])
    }
    await this.loadLists()
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
    await this.queue(id, 'delete')
    this.events = this.events.filter((e) => e.id !== id)
  }

  /** Replaces an event's contents in place, keeping its id and who logged it. */
  async update(id: string, draft: DraftEvent): Promise<BabyEvent> {
    const existing = this.events.find((e) => e.id === id)
    if (!existing) throw new Error('That entry no longer exists')
    const event = BabyEvent.parse({ ...draft, id, loggedBy: existing.loggedBy })
    await this.db.exec('UPDATE events SET kind = ?, at = ?, body = ? WHERE id = ?', [event.kind, event.at, JSON.stringify(event), id])
    await this.queue(id, 'put')
    this.events = this.events.map((e) => (e.id === id ? event : e)).sort((a, b) => a.at - b.at)
    return event
  }

  /** Up to `limit` unsent changes, oldest first. */
  async pending(limit: number): Promise<PendingBatch> {
    const rows = await this.db.query<{ n: number; id: string; op: string; body: string | null }>(
      `SELECT p.n, p.id, p.op, e.body FROM sync_pending p LEFT JOIN events e ON e.id = p.id ORDER BY p.n LIMIT ?`,
      [limit],
    )
    const batch: PendingBatch = { events: [], deleted: [], sent: [] }
    for (const r of rows) {
      batch.sent.push({ n: r.n, id: r.id })
      if (r.op === 'delete') batch.deleted.push(r.id)
      else {
        const parsed = r.body === null ? undefined : BabyEvent.safeParse(JSON.parse(r.body))
        if (parsed?.success) batch.events.push(parsed.data)
      }
    }
    return batch
  }

  /** Clears what the server has taken. A row that changed since it was read has a new number and stays. */
  async markSynced(sent: PendingBatch['sent']): Promise<void> {
    for (const { n, id } of sent) await this.db.exec('DELETE FROM sync_pending WHERE n = ? AND id = ?', [n, id])
  }

  /**
   * Applies what other phones changed. An event with an unsent local change is skipped: that change goes up next
   * and wins, as the later save. Nothing here is queued, or it would bounce back to the server.
   */
  async applyRemote(changes: RemoteChange[]): Promise<number> {
    let applied = 0
    for (const { event, deleted } of changes) {
      const [waiting] = await this.db.query<{ n: number }>('SELECT n FROM sync_pending WHERE id = ?', [event.id])
      if (waiting) continue
      if (deleted) {
        await this.db.exec('DELETE FROM events WHERE id = ?', [event.id])
        this.events = this.events.filter((e) => e.id !== event.id)
      } else {
        await this.db.exec(UPSERT_REMOTE_EVENT_SQL, [event.id, event.kind, event.at, event.loggedBy, JSON.stringify(event), Date.now(), event.id])
        this.events = [...this.events.filter((e) => e.id !== event.id), event].sort((a, b) => a.at - b.at)
      }
      applied++
    }
    return applied
  }

  /** The household this phone last synced with and the last change number it saw there. */
  async syncState(): Promise<{ household: string | undefined; seq: number }> {
    const seq = Number(await this.getSetting('syncSeq'))
    return { household: await this.getSetting('syncHousehold'), seq: Number.isInteger(seq) && seq > 0 ? seq : 0 }
  }

  async setSyncState(household: string, seq: number): Promise<void> {
    await this.setSetting('syncHousehold', household)
    await this.setSetting('syncSeq', String(seq))
  }

  /** The first household this phone ever meets: offer its unsent settings without overriding what the family already has. */
  async offerSettings(): Promise<void> {
    await this.db.exec('UPDATE shared_setting SET fill = 1 WHERE version > synced')
  }

  /**
   * A different household: forget the position, drop what other caregivers logged in the one left (it belongs to that
   * family, not this one), and send what this phone logged itself.
   */
  async resetSync(household: string): Promise<void> {
    await this.setSyncState(household, 0)
    await this.db.exec(DROP_REMOTE_PENDING_SQL)
    await this.db.exec(DROP_REMOTE_EVENTS_SQL)
    await this.reloadEvents()
    await this.db.exec("INSERT OR REPLACE INTO sync_pending (id, op) SELECT id, 'put' FROM events ORDER BY at")
    await this.db.exec('UPDATE shared_setting SET version = version + 1, fill = 1')
  }

  /** Drops every table and the schema version, so the next open starts like a fresh install with only the seeds. */
  async wipe(): Promise<void> {
    for (const { name } of await this.db.query<{ name: string }>(LIST_TABLES_SQL)) await this.db.exec(dropTableSql(name))
    await this.db.exec('PRAGMA user_version = 0')
    this.events = []
    this.settings.clear()
    this.lists.clear()
  }

  async listFeatures(): Promise<FeatureRow[]> {
    const rows = await this.db.query<{ id: string; label: string; hint: string; grp: string; enabled: number }>(
      'SELECT id, label, hint, grp, enabled FROM features ORDER BY sort',
    )
    return rows.map((r) => ({ id: r.id, label: r.label, hint: r.hint, group: r.grp, enabled: r.enabled === 1 }))
  }

  async setFeature(id: string, enabled: boolean): Promise<void> {
    await this.db.exec('UPDATE features SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id])
  }

  async listAgeNorms(): Promise<AgeNorm[]> {
    return this.db.query<AgeNorm>(
      `SELECT from_weeks AS fromWeeks, to_weeks AS toWeeks, wake_min_low AS wakeMinLow, wake_min_high AS wakeMinHigh,
        naps_low AS napsLow, naps_high AS napsHigh FROM age_norms ORDER BY from_weeks`,
    )
  }

  async listActivityTypes(): Promise<ActivityType[]> {
    return this.db.query<ActivityType>('SELECT id, label FROM activity_types ORDER BY sort, label')
  }

  /** Adds a custom activity ("Music time"); returns the existing one when the id is taken. */
  async addActivityType(label: string): Promise<ActivityType> {
    const id = activityId(label)
    if (!id) throw new Error('Give the activity a name')
    await this.db.exec(
      'INSERT OR IGNORE INTO activity_types (id, label, sort) VALUES (?, ?, (SELECT COALESCE(MAX(sort), -1) + 1 FROM activity_types))',
      [id, label.trim()],
    )
    const [row] = await this.db.query<ActivityType>('SELECT id, label FROM activity_types WHERE id = ?', [id])
    return row
  }

  async getSetting(key: string): Promise<string | undefined> {
    return this.settings.get(key)
  }

  /** Same as getSetting, for screens that need the value on their first render. */
  setting(key: string): string | undefined {
    return this.settings.get(key)
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.putSetting(key, value)
    if (isSharedKey(key)) {
      // A deliberate edit wins over the family's value, so it is no longer "fill only".
      await this.db.exec(
        `INSERT INTO shared_setting (key, version, synced, fill) VALUES (?, 1, 0, 0)
         ON CONFLICT(key) DO UPDATE SET version = version + 1, fill = 0`,
        [key],
      )
    }
  }

  private async putSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value)
    await this.db.exec(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    )
  }

  /** Shared settings with an edit not yet sent. */
  async pendingSettings(): Promise<{ changes: SettingChange[]; sent: { key: string; version: number }[] }> {
    const rows = await this.db.query<{ key: string; value: string; version: number; fill: number }>(
      `SELECT s.key, v.value, s.version, s.fill FROM shared_setting s JOIN settings v ON v.key = s.key
       WHERE s.version > s.synced ORDER BY s.key`,
    )
    return {
      changes: rows.flatMap((r) => (isSharedKey(r.key) ? [{ key: r.key, value: r.value, onlyIfMissing: r.fill === 1 }] : [])),
      sent: rows.map((r) => ({ key: r.key, version: r.version })),
    }
  }

  /** A setting edited again while it was being sent keeps its newer version, so it goes up next time. */
  async markSettingsSynced(sent: { key: string; version: number }[]): Promise<void> {
    for (const { key, version } of sent) {
      await this.db.exec('UPDATE shared_setting SET synced = ? WHERE key = ? AND version = ?', [version, key, version])
    }
  }

  /** Takes the household's values, except for a setting with an unsent edit. True when anything on screen changes. */
  async applyRemoteSettings(settings: SharedSetting[]): Promise<boolean> {
    let changed = false
    for (const { key, value } of settings) {
      const [row] = await this.db.query<{ dirty: number }>('SELECT version > synced AS dirty FROM shared_setting WHERE key = ?', [key])
      if (row?.dirty === 1) continue
      if ((await this.getSetting(key)) === value) {
        await this.db.exec('INSERT OR IGNORE INTO shared_setting (key, version, synced, fill) VALUES (?, 0, 0, 0)', [key])
        continue
      }
      await this.putSetting(key, value)
      await this.db.exec(
        `INSERT INTO shared_setting (key, version, synced, fill) VALUES (?, 0, 0, 0)
         ON CONFLICT(key) DO UPDATE SET fill = 0`,
        [key],
      )
      changed = true
    }
    return changed
  }
}
