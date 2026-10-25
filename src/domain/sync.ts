import { z } from 'zod'
import { BabyEvent } from './events'
import { SharedSetting } from './sharedSettings'
import type { SqliteEventStore } from './store'

// Everything from the server is checked before it touches the phone's database.
const PushResponse = z.object({ household: z.string().min(1), stored: z.number().int(), removed: z.number().int() })
const PullResponse = z.object({
  household: z.string().min(1),
  changes: z.array(z.object({ event: BabyEvent, seq: z.number().int(), updatedAt: z.number().int(), deleted: z.boolean() })),
  seq: z.number().int().nonnegative(),
  more: z.boolean(),
})

const SettingsResponse = z.object({ household: z.string().min(1), settings: z.array(SharedSetting) })

/** One backend call by operation id; throws when the server says no. */
export type Call = (operationId: string, body: unknown) => Promise<unknown>

export interface SyncResult {
  pushed: number
  pulled: number
  /** The family changed the baby's name, birth date or goal: the screen needs to read them again. */
  settingsChanged: boolean
}

const BATCH = 200
// A guard against a server that never says "no more", not a limit anyone should reach.
const MAX_ROUNDS = 100

class HouseholdChanged extends Error {}

interface State {
  household: string | undefined
  seq: number
}

/** The first answer names the phone's household; a different one later means it was moved. */
async function adopt(store: SqliteEventStore, state: State, answered: string): Promise<void> {
  if (answered === state.household) return
  if (state.household === undefined) {
    state.household = answered
    await store.setSyncState(answered, state.seq)
    await store.offerSettings()
    return
  }
  await store.resetSync(answered)
  throw new HouseholdChanged()
}

async function run(store: SqliteEventStore, call: Call): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, settingsChanged: false }
  const state = await store.syncState()

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const batch = await store.pending(BATCH)
    if (batch.sent.length === 0) break
    const res = PushResponse.parse(await call('pushChanges', { events: batch.events, deleted: batch.deleted }))
    await adopt(store, state, res.household)
    await store.markSynced(batch.sent)
    result.pushed += batch.sent.length
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = PullResponse.parse(await call('pullChanges', { since: state.seq }))
    await adopt(store, state, res.household)
    result.pulled += await store.applyRemote(res.changes)
    state.seq = res.seq
    await store.setSyncState(res.household, state.seq)
    if (!res.more) break
  }

  const outgoing = await store.pendingSettings()
  const settings = SettingsResponse.parse(await call('syncSettings', { changes: outgoing.changes }))
  await adopt(store, state, settings.household)
  await store.markSettingsSynced(outgoing.sent)
  result.settingsChanged = await store.applyRemoteSettings(settings.settings)
  return result
}

/**
 * Sends this phone's unsent changes, then fetches what other phones changed. Safe to run any time and as often as
 * wanted: both directions are idempotent, and an interrupted run resumes where it stopped. If the phone turns out to
 * be in a different household than last time (joined, left, removed), everything on it is queued for the new one and
 * the run starts again once.
 */
export async function syncOnce(store: SqliteEventStore, call: Call): Promise<SyncResult> {
  try {
    return await run(store, call)
  } catch (err) {
    if (!(err instanceof HouseholdChanged)) throw err
  }
  return run(store, call)
}
