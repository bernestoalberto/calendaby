import { beforeEach, describe, expect, it } from 'vitest'
import type { BabyEvent } from '../src/domain/events.js'
import { createApp } from './app.js'
import { openDb } from './db.js'
import { openShared } from './household.js'

const users: Record<string, string> = { tok_mom: 'user_mom', tok_dad: 'user_dad', tok_gran: 'user_gran' }
const verify = async (token: string) => users[token] ?? null

const feed = (id: string, at: number, extra: Partial<BabyEvent> = {}): BabyEvent =>
  ({ id, at, loggedBy: 'Mom', kind: 'feed', method: 'bottle', amountMl: 120, ...extra }) as BabyEvent

let app: ReturnType<typeof createApp>

beforeEach(async () => {
  const store = await openShared({ url: ':memory:' })
  app = createApp(openDb(':memory:'), { verify, shared: async () => store })
})

async function call<T = Record<string, unknown>>(who: string | undefined, op: string, body: unknown = {}) {
  const res = await app.request(`/${op}`, {
    method: 'POST',
    headers: who ? { authorization: `Bearer ${who}` } : {},
    body: JSON.stringify(body),
  })
  return { status: res.status, body: (await res.json()) as T }
}

const pull = (who: string, since = 0) =>
  call<{ changes: { event: BabyEvent; deleted: boolean }[]; seq: number; more: boolean }>(who, 'pullChanges', { since })

async function join(owner: string, joiner: string, name: string) {
  const { body } = await call<{ code: string }>(owner, 'createInvite')
  return call(joiner, 'joinHousehold', { code: body.code, name })
}

describe('household routes', () => {
  it('needs a sign-in for every route', async () => {
    for (const op of ['householdInfo', 'createInvite', 'pullChanges']) {
      expect((await call(undefined, op, op === 'pullChanges' ? { since: 0 } : {})).status).toBe(401)
    }
  })

  it('answers 503 when the shared database is not configured', async () => {
    const closed = createApp(openDb(':memory:'), {
      verify,
      shared: async () => {
        throw new Error('no database')
      },
    })
    const res = await closed.request('/householdInfo', { method: 'POST', headers: { authorization: 'Bearer tok_mom' }, body: '{}' })
    expect(res.status).toBe(503)
  })

  it('rejects input it does not know', async () => {
    expect((await call('tok_mom', 'pushChanges', { events: [], deleted: [], householdId: 'other' })).status).toBe(400)
    expect((await call('tok_mom', 'pullChanges', { since: -1 })).status).toBe(400)
    expect((await call('tok_mom', 'pushChanges', { events: [{ id: 'x' }], deleted: [] })).status).toBe(400)
  })

  it('shows a new user a household of one', async () => {
    const { body } = await call<{ role: string; members: { name: string; you: boolean }[] }>('tok_mom', 'householdInfo', { name: 'Mom' })
    expect(body.role).toBe('owner')
    expect(body.members).toMatchObject([{ name: 'Mom', you: true }])
  })
})

describe('two accounts in one household', () => {
  it('lets Dad join with Mom\'s code and then see the same log both ways', async () => {
    await call('tok_mom', 'householdInfo', { name: 'Mom' })
    expect((await join('tok_mom', 'tok_dad', 'Dad')).status).toBe(200)
    const info = await call<{ members: { name: string }[] }>('tok_dad', 'householdInfo')
    expect(info.body.members.map((m) => m.name)).toEqual(['Mom', 'Dad'])

    await call('tok_mom', 'pushChanges', { events: [feed('f1', 10)], deleted: [] })
    expect((await pull('tok_dad')).body.changes.map((c) => c.event.id)).toEqual(['f1'])

    await call('tok_dad', 'pushChanges', { events: [feed('f2', 20, { loggedBy: 'Dad' })], deleted: [] })
    const mom = await pull('tok_mom')
    expect(mom.body.changes.map((c) => [c.event.id, c.event.loggedBy])).toEqual([['f1', 'Mom'], ['f2', 'Dad']])
  })

  it('carries an edit and a delete to the other phone', async () => {
    await join('tok_mom', 'tok_dad', 'Dad')
    await call('tok_mom', 'pushChanges', { events: [feed('f1', 10), feed('f2', 20)], deleted: [] })
    const first = await pull('tok_dad')
    await call('tok_dad', 'pushChanges', { events: [feed('f1', 10, { amountMl: 200 })], deleted: ['f2'] })
    const next = await pull('tok_mom', first.body.seq)
    expect(next.body.changes.map((c) => [c.event.id, c.deleted])).toEqual([['f1', false], ['f2', true]])
    expect(next.body.changes.find((c) => c.event.id === 'f1')?.event).toMatchObject({ amountMl: 200 })
  })

  it('keeps an uninvited account out', async () => {
    await join('tok_mom', 'tok_dad', 'Dad')
    await call('tok_mom', 'pushChanges', { events: [feed('f1', 10)], deleted: [] })
    expect((await pull('tok_gran')).body.changes).toEqual([])
  })

  it('refuses a wrong code and only lets the owner invite or remove', async () => {
    await join('tok_mom', 'tok_dad', 'Dad')
    const wrong = await call('tok_gran', 'joinHousehold', { code: 'AAA-AAA', name: 'Gran' })
    expect(wrong.status).toBe(400)
    expect((await call('tok_dad', 'createInvite')).status).toBe(403)
    expect((await call('tok_dad', 'removeMember', { userId: 'user_mom' })).status).toBe(403)
  })

  it('cuts Dad off when Mom removes him but keeps the logs', async () => {
    await join('tok_mom', 'tok_dad', 'Dad')
    await call('tok_mom', 'pushChanges', { events: [feed('f1', 10)], deleted: [] })
    expect((await call('tok_mom', 'removeMember', { userId: 'user_dad' })).body).toEqual({ removed: true })
    // Dad's next call starts a household of his own, empty.
    expect((await pull('tok_dad')).body.changes).toEqual([])
    expect((await pull('tok_mom')).body.changes.map((c) => c.event.id)).toEqual(['f1'])
  })

  it('lets a member leave', async () => {
    await join('tok_mom', 'tok_dad', 'Dad')
    expect((await call('tok_dad', 'leaveHousehold')).body).toEqual({ left: true })
    const info = await call<{ members: unknown[] }>('tok_mom', 'householdInfo')
    expect(info.body.members).toHaveLength(1)
  })

  it('shows whose household a code belongs to', async () => {
    await call('tok_mom', 'householdInfo', { name: 'Mom' })
    const { body } = await call<{ code: string }>('tok_mom', 'createInvite')
    expect((await call('tok_dad', 'previewInvite', { code: body.code })).body).toEqual({ ownerName: 'Mom' })
  })
})
