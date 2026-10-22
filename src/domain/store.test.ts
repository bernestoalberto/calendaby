import { describe, expect, it } from 'vitest'
import { DuplicateEventError, LocalEventStore, MemoryEventStore } from './store'

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

describe('MemoryEventStore', () => {
  it('rejects a duplicate logged by the other caregiver a minute later', () => {
    const store = new MemoryEventStore()
    store.append({ kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 120 }, 'dad')
    expect(() => store.append({ kind: 'feed', at: 1_060_000, method: 'bottle', amountMl: 120 }, 'mom')).toThrow(
      DuplicateEventError,
    )
  })

  it('allows a sleep end right after a sleep start', () => {
    const store = new MemoryEventStore()
    store.append({ kind: 'sleep', at: 1_000_000, phase: 'start' }, 'dad')
    expect(() => store.append({ kind: 'sleep', at: 1_030_000, phase: 'end' }, 'dad')).not.toThrow()
  })

  it('rejects impossible amounts', () => {
    const store = new MemoryEventStore()
    expect(() => store.append({ kind: 'feed', at: 1_000_000, method: 'bottle', amountMl: 1200 }, 'dad')).toThrow()
  })
})

describe('LocalEventStore', () => {
  it('survives a reload', () => {
    const storage = new MapStorage()
    new LocalEventStore(storage).append({ kind: 'diaper', at: 1_000_000, contents: 'wet' }, 'dad')
    expect(new LocalEventStore(storage).list()).toMatchObject([{ kind: 'diaper', loggedBy: 'dad' }])
  })

  it('starts empty when stored data is corrupt', () => {
    const storage = new MapStorage()
    storage.setItem('calendaby.events.v1', '{nope')
    expect(new LocalEventStore(storage).list()).toEqual([])
  })
})
