import { z } from 'zod'
import { BabyEvent, type DraftEvent } from './events'

export interface EventStore {
  list(): BabyEvent[]
  append(draft: DraftEvent, loggedBy: string): BabyEvent
  remove(id: string): void
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

export class MemoryEventStore implements EventStore {
  protected events: BabyEvent[]
  private readonly newId: () => string

  constructor(initial: BabyEvent[] = [], newId: () => string = () => crypto.randomUUID()) {
    this.newId = newId
    this.events = [...initial].sort((a, b) => a.at - b.at)
  }

  list(): BabyEvent[] {
    return [...this.events]
  }

  append(draft: DraftEvent, loggedBy: string): BabyEvent {
    const dup = findDuplicate(this.events, draft)
    if (dup) throw new DuplicateEventError(dup)
    // Validation runs here so every writer, human or agent, goes through the same guard.
    const event = BabyEvent.parse({ ...draft, id: this.newId(), loggedBy })
    this.events = [...this.events, event].sort((a, b) => a.at - b.at)
    this.persist()
    return event
  }

  remove(id: string): void {
    this.events = this.events.filter((e) => e.id !== id)
    this.persist()
  }

  protected persist(): void {}
}

const STORAGE_KEY = 'calendaby.events.v1'

/** Offline-first store for the PWA and the Capacitor shell (both run on WebView storage). */
export class LocalEventStore extends MemoryEventStore {
  private readonly storage: Storage

  constructor(storage: Storage = globalThis.localStorage) {
    super(LocalEventStore.load(storage))
    this.storage = storage
  }

  private static load(storage: Storage): BabyEvent[] {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (!raw) return []
      return z.array(BabyEvent).parse(JSON.parse(raw))
    } catch {
      return []
    }
  }

  protected override persist(): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.events))
  }
}
