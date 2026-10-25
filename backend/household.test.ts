import { beforeEach, describe, expect, it } from 'vitest'
import type { BabyEvent } from '../src/domain/events.js'
import { openShared, type SharedStore } from './household.js'

const feed = (id: string, at: number, extra: Partial<BabyEvent> = {}): BabyEvent =>
  ({ id, at, loggedBy: 'Dad', kind: 'feed', method: 'bottle', amountMl: 120, ...extra }) as BabyEvent

let clock = 1_000
let store: SharedStore
let A: string
let B: string

beforeEach(async () => {
  clock = 1_000
  store = await openShared({ url: ':memory:', now: () => clock++ })
  A = await store.ensureHousehold('user_a')
  B = await store.ensureHousehold('user_b')
})

const ids = async (household: string, since = 0) => (await store.changesSince(household, since)).changes.map((c) => c.event.id)

describe('shared events', () => {
  it('starts empty for a household that has never uploaded', async () => {
    expect(await store.changesSince(A, 0)).toEqual({ changes: [], seq: 0, more: false })
  })

  it('never shows one household the events of another', async () => {
    await store.putEvents(A, [feed('e1', 10)])
    await store.putEvents(B, [feed('e2', 20)])
    expect(await ids(A)).toEqual(['e1'])
    expect(await ids(B)).toEqual(['e2'])
  })

  it('does not let one household overwrite or delete an id that another household uses', async () => {
    await store.putEvents(A, [feed('same', 10, { amountMl: 100 })])
    await store.putEvents(B, [feed('same', 10, { amountMl: 300 })])
    await store.deleteEvent(B, 'same')
    const [mine] = (await store.changesSince(A, 0)).changes
    expect(mine.deleted).toBe(false)
    expect(mine.event).toMatchObject({ amountMl: 100 })
  })

  it('numbers changes so a phone can ask for what it has not seen', async () => {
    await store.putEvents(A, [feed('e1', 10), feed('e2', 20)])
    const first = await store.changesSince(A, 0)
    expect(first.changes).toHaveLength(2)
    await store.putEvents(A, [feed('e3', 30)])
    const next = await store.changesSince(A, first.seq)
    expect(next.changes.map((c) => c.event.id)).toEqual(['e3'])
    expect((await store.changesSince(A, next.seq)).changes).toEqual([])
  })

  it('hands out changes in pages and says when there are more', async () => {
    await store.putEvents(A, [feed('e1', 10), feed('e2', 20), feed('e3', 30)])
    const page = await store.changesSince(A, 0, 2)
    expect(page.changes.map((c) => c.event.id)).toEqual(['e1', 'e2'])
    expect(page.more).toBe(true)
    const rest = await store.changesSince(A, page.seq, 2)
    expect(rest.changes.map((c) => c.event.id)).toEqual(['e3'])
    expect(rest.more).toBe(false)
  })

  it('stores an event once when two phones upload it', async () => {
    await store.putEvents(A, [feed('e1', 10)])
    await store.putEvents(A, [feed('e1', 10)])
    expect(await ids(A)).toEqual(['e1'])
  })

  it('updates an edited event and reports it as a new change', async () => {
    await store.putEvents(A, [feed('e1', 10, { amountMl: 100 })])
    const { seq } = await store.changesSince(A, 0)
    await store.putEvents(A, [feed('e1', 10, { amountMl: 150 })])
    const next = await store.changesSince(A, seq)
    expect(next.changes).toHaveLength(1)
    expect(next.changes[0].event).toMatchObject({ amountMl: 150 })
  })

  it('keeps a deleted event as a tombstone so the other phone learns about it', async () => {
    await store.putEvents(A, [feed('e1', 10)])
    const { seq } = await store.changesSince(A, 0)
    expect(await store.deleteEvent(A, 'e1')).toBe(true)
    const next = await store.changesSince(A, seq)
    expect(next.changes.map((c) => [c.event.id, c.deleted])).toEqual([['e1', true]])
    expect(await store.deleteEvent(A, 'missing')).toBe(false)
  })

  it('does not bring a deleted event back when the other phone uploads it late', async () => {
    await store.putEvents(A, [feed('e1', 10)])
    await store.deleteEvent(A, 'e1')
    await store.putEvents(A, [feed('e1', 10, { amountMl: 200 })])
    const [only] = (await store.changesSince(A, 0)).changes
    expect(only.deleted).toBe(true)
  })

  it('rejects an event that is not valid instead of storing anything from that batch', async () => {
    await expect(store.putEvents(A, [feed('ok', 10), { id: 'x', at: 1, kind: 'feed' } as unknown as BabyEvent])).rejects.toThrow()
    expect(await ids(A)).toEqual([])
  })
})

describe('households and invites', () => {
  it('gives each user one household and returns the same one every time', async () => {
    expect(await store.ensureHousehold('user_a')).toBe(A)
    expect(await store.householdOf('user_a')).toBe(A)
    expect(await store.householdOf('nobody')).toBeUndefined()
    expect(A).not.toBe(B)
  })

  it('lets a second parent join with a code and then share the same events', async () => {
    await store.putEvents(A, [feed('e1', 10)])
    const { code } = await store.createInvite(A, 'user_a')
    expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/)
    expect(await store.redeemInvite('user_b', code, 'Mom')).toBe(A)
    expect(await store.householdOf('user_b')).toBe(A)
    expect((await store.members(A)).map((m) => [m.name, m.role])).toEqual([
      ['Parent', 'owner'],
      ['Mom', 'member'],
    ])
    expect(await ids(await store.ensureHousehold('user_b'))).toEqual(['e1'])
  })

  it('shows whose household a code belongs to without using it', async () => {
    const { code } = await store.createInvite(A, 'user_a')
    expect(await store.previewInvite('user_b', code)).toEqual({ ownerName: 'Parent' })
    expect(await store.householdOf('user_b')).toBe(B)
    await expect(store.redeemInvite('user_b', code)).resolves.toBe(A)
  })

  it('accepts the code in lower case and without the dash', async () => {
    const { code } = await store.createInvite(A, 'user_a')
    await expect(store.redeemInvite('user_b', code.replace('-', '').toLowerCase())).resolves.toBe(A)
  })

  it('works only once', async () => {
    const { code } = await store.createInvite(A, 'user_a')
    await store.redeemInvite('user_b', code)
    const c = await store.ensureHousehold('user_c')
    await expect(store.redeemInvite('user_c', code)).rejects.toMatchObject({ problem: 'invalid' })
    expect(await store.householdOf('user_c')).toBe(c)
  })

  it('stops working after 48 hours', async () => {
    const { code } = await store.createInvite(A, 'user_a')
    clock += 48 * 3_600_000 + 1
    await expect(store.redeemInvite('user_b', code)).rejects.toMatchObject({ problem: 'invalid' })
  })

  it('locks out guessing after five wrong codes', async () => {
    for (let i = 0; i < 5; i++) await expect(store.redeemInvite('user_b', 'AAA-AAA')).rejects.toMatchObject({ problem: 'invalid' })
    const { code } = await store.createInvite(A, 'user_a')
    await expect(store.redeemInvite('user_b', code)).rejects.toMatchObject({ problem: 'too_many_attempts' })
    clock += 11 * 60_000
    await expect(store.redeemInvite('user_b', code)).resolves.toBe(A)
  })

  it('only lets the owner invite or remove', async () => {
    const { code } = await store.createInvite(A, 'user_a')
    await store.redeemInvite('user_b', code)
    await expect(store.createInvite(A, 'user_b')).rejects.toThrow()
    await expect(store.removeMember(A, 'user_b', 'user_a')).rejects.toThrow()
    await expect(store.removeMember(A, 'user_a', 'user_a')).rejects.toMatchObject({ problem: 'owner_leaving' })
  })

  it('removes a member from access but keeps the logs', async () => {
    await store.putEvents(A, [feed('e1', 10)])
    const { code } = await store.createInvite(A, 'user_a')
    await store.redeemInvite('user_b', code)
    expect(await store.removeMember(A, 'user_a', 'user_b')).toBe(true)
    expect(await store.householdOf('user_b')).toBeUndefined()
    expect(await store.removeMember(A, 'user_a', 'user_b')).toBe(false)
    expect(await ids(A)).toEqual(['e1'])
  })

  it('lets a member leave but not the owner while others remain', async () => {
    const { code } = await store.createInvite(A, 'user_a')
    await store.redeemInvite('user_b', code)
    await expect(store.leave('user_a')).rejects.toMatchObject({ problem: 'owner_leaving' })
    await store.leave('user_b')
    expect(await store.householdOf('user_b')).toBeUndefined()
  })

  it('does not move someone who already shares a household with others', async () => {
    const first = await store.createInvite(A, 'user_a')
    await store.redeemInvite('user_b', first.code)
    const other = await store.createInvite(await store.ensureHousehold('user_c'), 'user_c')
    await expect(store.redeemInvite('user_b', other.code)).rejects.toMatchObject({ problem: 'in_household' })
    expect(await store.householdOf('user_b')).toBe(A)
  })
})

describe('shared settings', () => {
  const set = (key: 'baby' | 'birth' | 'tummyGoal', value: string, onlyIfMissing = false) => ({ key, value, onlyIfMissing })

  it('starts empty and keeps each household separate', async () => {
    expect(await store.syncSettings(A, [])).toEqual([])
    await store.syncSettings(A, [set('baby', 'Lily')])
    await store.syncSettings(B, [set('baby', 'Max')])
    expect(await store.syncSettings(A, [])).toEqual([{ key: 'baby', value: 'Lily' }])
    expect(await store.syncSettings(B, [])).toEqual([{ key: 'baby', value: 'Max' }])
  })

  it('lets the later write win', async () => {
    await store.syncSettings(A, [set('tummyGoal', '30')])
    expect(await store.syncSettings(A, [set('tummyGoal', '45')])).toEqual([{ key: 'tummyGoal', value: '45' }])
  })

  it('lets a phone that just joined fill gaps without overriding the family', async () => {
    await store.syncSettings(A, [set('baby', 'Lily')])
    const result = await store.syncSettings(A, [set('baby', 'Other', true), set('birth', '2026-06-20', true)])
    expect(result).toEqual([
      { key: 'baby', value: 'Lily' },
      { key: 'birth', value: '2026-06-20' },
    ])
  })

  it('refuses values that are not valid for the setting', async () => {
    await expect(store.syncSettings(A, [set('birth', 'yesterday')])).rejects.toThrow()
    await expect(store.syncSettings(A, [set('tummyGoal', '-5')])).rejects.toThrow()
    await expect(store.syncSettings(A, [set('baby', '   ')])).rejects.toThrow()
    expect(await store.syncSettings(A, [])).toEqual([])
  })
})

