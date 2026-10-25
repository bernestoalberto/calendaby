import { describe, expect, it } from 'vitest'
import { NodeSqlDriver } from '../db/node-driver.test-util'
import { DuplicateEventError, LEGACY_KEY, SqliteEventStore } from './store'

class MapStorage implements Storage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  clear() {
    this.m.clear()
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  setItem(k: string, v: string) {
    this.m.set(k, v)
  }
}

describe('SqliteEventStore', () => {
  it('rejects a duplicate logged by the other caregiver a minute later', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    await store.append({ kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 120 }, 'dad')
    await expect(store.append({ kind: 'feed', at: 1_060_000, method: 'bottle', amountMl: 120 }, 'mom')).rejects.toThrow(
      DuplicateEventError,
    )
  })

  it('allows different activities within the duplicate window but not the same one', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    await store.append({ kind: 'activity', at: 1_000_000, type: 'tummy', durationMin: 5 }, 'dad')
    await expect(store.append({ kind: 'activity', at: 1_030_000, type: 'bath' }, 'dad')).resolves.toBeDefined()
    await expect(store.append({ kind: 'activity', at: 1_060_000, type: 'tummy', durationMin: 5 }, 'mom')).rejects.toThrow(
      DuplicateEventError,
    )
  })

  it('seeds activity types in SQLite and keeps edits across reopen', async () => {
    const driver = new NodeSqlDriver()
    const store = await SqliteEventStore.open(driver)
    expect((await store.listActivityTypes()).map((t) => t.id)).toEqual(['tummy', 'bath', 'outdoor', 'indoor', 'crawl', 'walk', 'swim'])
    await store.addActivityType('Music time')
    const again = await SqliteEventStore.open(driver)
    expect((await again.listActivityTypes()).map((t) => [t.id, t.label]).at(-1)).toEqual(['music-time', 'Music time'])
  })

  it('allows a sleep end right after a sleep start', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    await store.append({ kind: 'sleep', at: 1_000_000, phase: 'start' }, 'dad')
    await expect(store.append({ kind: 'sleep', at: 1_030_000, phase: 'end' }, 'dad')).resolves.toBeDefined()
  })

  it('rejects impossible amounts without writing them', async () => {
    const driver = new NodeSqlDriver()
    const store = await SqliteEventStore.open(driver)
    await expect(store.append({ kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 1200 }, 'dad')).rejects.toThrow()
    expect(await driver.query('SELECT * FROM events')).toEqual([])
  })

  it('persists to SQLite and reloads in time order', async () => {
    const driver = new NodeSqlDriver()
    const first = await SqliteEventStore.open(driver)
    await first.append({ kind: 'diaper', at: 2_000_000, contents: 'wet' }, 'dad')
    await first.append({ kind: 'feed', at: 1_000_000, method: 'breast', side: 'left' }, 'mom')
    const reopened = await SqliteEventStore.open(driver)
    expect(reopened.list().map((e) => [e.kind, e.loggedBy])).toEqual([
      ['feed', 'mom'],
      ['diaper', 'dad'],
    ])
    const [row] = await driver.query<{ kind: string; at: number }>('SELECT kind, at FROM events WHERE kind = ?', ['diaper'])
    expect(row).toEqual({ kind: 'diaper', at: 2_000_000 })
  })

  it('deletes events', async () => {
    const driver = new NodeSqlDriver()
    const store = await SqliteEventStore.open(driver)
    const e = await store.append({ kind: 'diaper', at: 1_000_000, contents: 'dirty' }, 'dad')
    await store.remove(e.id)
    expect((await SqliteEventStore.open(driver)).list()).toEqual([])
  })

  it('moves events from the old localStorage format once and keeps a backup', async () => {
    const legacy = new MapStorage()
    const old = [{ id: 'a', at: 1_000_000, loggedBy: 'dad', kind: 'diaper', contents: 'wet' }]
    legacy.setItem(LEGACY_KEY, JSON.stringify(old))
    const driver = new NodeSqlDriver()
    await SqliteEventStore.open(driver, legacy)
    const again = await SqliteEventStore.open(driver, legacy)
    expect(again.list()).toEqual(old)
    expect(legacy.getItem(LEGACY_KEY)).toBeNull()
    expect(legacy.getItem(`${LEGACY_KEY}.migrated`)).toBe(JSON.stringify(old))
  })

  it('stores settings', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    expect(await store.getSetting('caregiver')).toBeUndefined()
    await store.setSetting('caregiver', 'Ernesto')
    await store.setSetting('caregiver', 'Dad')
    expect(await store.getSetting('caregiver')).toBe('Dad')
  })

  it('edits an event in place, keeps who logged it and re-sorts', async () => {
    const driver = new NodeSqlDriver()
    const store = await SqliteEventStore.open(driver)
    const a = await store.append({ kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 120 }, 'dad')
    await store.append({ kind: 'diaper', at: 2_000_000, contents: 'wet' }, 'mom')
    await store.update(a.id, { kind: 'feed', at: 3_000_000, method: 'bottle', amountMl: 90 })
    const reopened = await SqliteEventStore.open(driver)
    expect(reopened.list().map((e) => [e.kind, e.at, e.loggedBy])).toEqual([
      ['diaper', 2_000_000, 'mom'],
      ['feed', 3_000_000, 'dad'],
    ])
  })

  it('refuses an invalid edit and an edit of a missing entry', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    const a = await store.append({ kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 120 }, 'dad')
    await expect(store.update(a.id, { kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 1200 })).rejects.toThrow()
    expect(store.list()[0]).toMatchObject({ amountMl: 120 })
    await expect(store.update('nope', { kind: 'note', at: 1, note: 'x' })).rejects.toThrow()
  })

  it('seeds features with their defaults and keeps a choice across reopen', async () => {
    const driver = new NodeSqlDriver()
    const store = await SqliteEventStore.open(driver)
    const seeded = await store.listFeatures()
    expect(seeded.filter((f) => !f.enabled).map((f) => f.id)).toEqual(['alertNapDue', 'alertWake', 'alertFeed', 'alertDiaper'])
    await store.setFeature('timeline', false)
    const rows = await (await SqliteEventStore.open(driver)).listFeatures()
    expect(rows.find((f) => f.id === 'timeline')?.enabled).toBe(false)
    expect(rows.find((f) => f.id === 'agent')?.enabled).toBe(true)
  })

  it('seeds the age norms table', async () => {
    const norms = await (await SqliteEventStore.open(new NodeSqlDriver())).listAgeNorms()
    expect(norms).toHaveLength(8)
    expect(norms[0]).toEqual({ fromWeeks: 0, toWeeks: 4, wakeMinLow: 35, wakeMinHigh: 60, napsLow: 4, napsHigh: 8 })
  })
})

describe('sync outbox', () => {
  const feed = { kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 120 } as const

  it('queues what is logged, edited and removed, and sends one entry per event', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    const a = await store.append(feed, 'dad')
    await store.update(a.id, { ...feed, amountMl: 150 })
    let batch = await store.pending(200)
    expect(batch.events).toHaveLength(1)
    expect(batch.events[0]).toMatchObject({ id: a.id, amountMl: 150 })
    await store.markSynced(batch.sent)
    expect((await store.pending(200)).sent).toEqual([])

    await store.remove(a.id)
    batch = await store.pending(200)
    expect(batch.events).toEqual([])
    expect(batch.deleted).toEqual([a.id])
  })

  it('keeps a change made while a sync was in flight', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    const a = await store.append(feed, 'dad')
    const batch = await store.pending(200)
    await store.update(a.id, { ...feed, amountMl: 90 })
    await store.markSynced(batch.sent)
    expect((await store.pending(200)).events[0]).toMatchObject({ amountMl: 90 })
  })

  it('queues events that were already on the phone when sync arrived', async () => {
    const driver = new NodeSqlDriver()
    await SqliteEventStore.open(driver)
    const old = { id: 'old1', kind: 'note', at: 5_000, loggedBy: 'dad', note: 'before sync' }
    driver.db.exec('DROP TABLE sync_pending; PRAGMA user_version = 5')
    driver.db.prepare('INSERT INTO events (id, kind, at, logged_by, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      old.id, old.kind, old.at, old.loggedBy, JSON.stringify(old), 1,
    )
    const store = await SqliteEventStore.open(driver)
    expect((await store.pending(200)).events.map((e) => e.id)).toEqual(['old1'])
  })

  it('applies changes from another phone without queueing them back', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    const remote = { ...feed, id: 'r1', loggedBy: 'mom' }
    expect(await store.applyRemote([{ event: remote, deleted: false }])).toBe(1)
    expect(store.list().map((e) => e.id)).toEqual(['r1'])
    expect((await store.pending(200)).sent).toEqual([])

    await store.applyRemote([{ event: remote, deleted: true }])
    expect(store.list()).toEqual([])
    expect((await store.pending(200)).sent).toEqual([])
  })

  it('does not overwrite a local change that has not been sent yet', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    const a = await store.append(feed, 'dad')
    await store.update(a.id, { ...feed, amountMl: 99 })
    expect(await store.applyRemote([{ event: { ...feed, id: a.id, loggedBy: 'dad', amountMl: 10 }, deleted: false }])).toBe(0)
    expect(store.list()[0]).toMatchObject({ amountMl: 99 })
  })

  it('remembers where it got to, per household, and starts over for a new one', async () => {
    const store = await SqliteEventStore.open(new NodeSqlDriver())
    const a = await store.append(feed, 'dad')
    await store.markSynced((await store.pending(200)).sent)
    expect(await store.syncState()).toEqual({ household: undefined, seq: 0 })
    await store.setSyncState('h1', 7)
    expect(await store.syncState()).toEqual({ household: 'h1', seq: 7 })

    await store.resetSync('h2')
    expect(await store.syncState()).toEqual({ household: 'h2', seq: 0 })
    expect((await store.pending(200)).events.map((e) => e.id)).toEqual([a.id])
  })
})

