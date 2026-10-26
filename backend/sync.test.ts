import { beforeEach, describe, expect, it } from 'vitest'
import { NodeSqlDriver } from '../src/db/node-driver.test-util'
import { type Call, syncOnce } from '../src/domain/sync'
import { SqliteEventStore } from '../src/domain/store'
import { createApp } from './app.js'
import { openDb } from './db.js'
import { openShared } from './household.js'

const users: Record<string, string> = { tok_mom: 'user_mom', tok_dad: 'user_dad', tok_gran: 'user_gran' }
const verify = async (token: string) => users[token] ?? null

let app: ReturnType<typeof createApp>
let online = true

beforeEach(async () => {
  online = true
  const shared = await openShared({ url: ':memory:' })
  app = createApp(openDb(':memory:'), { verify, shared: async () => shared })
})

/** A phone's way to call the server as one signed-in user, through the real routes. */
function callAs(token: string): Call {
  return async (op, body) => {
    if (!online) throw new Error('offline')
    const res = await app.request(`/${op}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    const json = (await res.json()) as { error?: string }
    if (!res.ok) throw new Error(json.error ?? `Server returned ${res.status}`)
    return json
  }
}

const phone = () => SqliteEventStore.open(new NodeSqlDriver())
const feed = (at: number, amountMl = 120) => ({ kind: 'feed', at, method: 'bottle', amountMl }) as const
const ids = (s: SqliteEventStore) => s.list().map((e) => e.id).sort()

async function join(ownerCall: Call, joinerCall: Call, name: string) {
  await ownerCall('householdInfo', { name: 'Mom' })
  const { code } = (await ownerCall('createInvite', {})) as { code: string }
  await joinerCall('joinHousehold', { code, name })
}

describe('two phones, two accounts, one household', () => {
  it('shows a log on the other phone and carries it back', async () => {
    const mom = await phone()
    const dad = await phone()
    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')

    await mom.append(feed(1_000_000), 'Mom')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))
    expect(dad.list()).toHaveLength(1)
    expect(dad.list()[0]).toMatchObject({ loggedBy: 'Mom', amountMl: 120 })

    await dad.append({ kind: 'diaper', at: 2_000_000, contents: 'wet' }, 'Dad')
    await syncOnce(dad, callAs('tok_dad'))
    await syncOnce(mom, callAs('tok_mom'))
    expect(ids(mom)).toEqual(ids(dad))
    expect(mom.list()).toHaveLength(2)
  })

  it('holds changes made offline and sends them when the phone is back', async () => {
    const mom = await phone()
    const dad = await phone()
    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')

    online = false
    await dad.append(feed(3_000_000), 'Dad')
    await expect(syncOnce(dad, callAs('tok_dad'))).rejects.toThrow('offline')
    expect((await dad.pending(200)).sent).toHaveLength(1)

    online = true
    await syncOnce(dad, callAs('tok_dad'))
    await syncOnce(mom, callAs('tok_mom'))
    expect(mom.list()).toHaveLength(1)
    expect((await dad.pending(200)).sent).toEqual([])
  })

  it('carries an edit and a delete, and ends with identical phones', async () => {
    const mom = await phone()
    const dad = await phone()
    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')
    const keep = await mom.append(feed(1_000_000), 'Mom')
    const drop = await mom.append({ kind: 'note', at: 5_000_000, note: 'oops' }, 'Mom')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))

    await dad.update(keep.id, feed(1_000_000, 200))
    await dad.remove(drop.id)
    await syncOnce(dad, callAs('tok_dad'))
    await syncOnce(mom, callAs('tok_mom'))

    expect(mom.list()).toEqual(dad.list())
    expect(mom.list()).toHaveLength(1)
    expect(mom.list()[0]).toMatchObject({ id: keep.id, amountMl: 200 })
  })

  it('merges what each parent logged alone before joining', async () => {
    const mom = await phone()
    const dad = await phone()
    await mom.append(feed(1_000_000), 'Mom')
    await dad.append(feed(9_000_000), 'Dad')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))
    expect(mom.list()).toHaveLength(1)

    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')
    await syncOnce(dad, callAs('tok_dad'))
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))
    expect(mom.list()).toHaveLength(2)
    expect(ids(mom)).toEqual(ids(dad))
  })

  it('shows the owner under the name they set later, not the placeholder the household started with', async () => {
    const mom = callAs('tok_mom')
    await mom('householdInfo', { name: 'Parent' })
    const after = (await mom('householdInfo', { name: 'Ernesto' })) as { members: { name: string }[] }
    expect(after.members.map((m) => m.name)).toEqual(['Ernesto'])
    const unnamed = (await mom('householdInfo', {})) as { members: { name: string }[] }
    expect(unnamed.members[0].name).toBe('Ernesto')
  })

  it('shows a short family id that matches for members and differs between families', async () => {
    const mom = callAs('tok_mom')
    await join(mom, callAs('tok_dad'), 'Dad')
    const idOf = async (call: Call) => ((await call('householdInfo', {})) as { familyId: string }).familyId
    expect(await idOf(mom)).toMatch(/^[0-9a-f]{6}$/)
    expect(await idOf(callAs('tok_dad'))).toBe(await idOf(mom))
    expect(await idOf(callAs('tok_gran'))).not.toBe(await idOf(mom))
  })

  it('makes whoever joins with a code a member under the owner, who alone can invite', async () => {
    const mom = callAs('tok_mom')
    const dad = callAs('tok_dad')
    await join(mom, dad, 'Dad')
    type Info = { role: string; members: { name: string; role: string; you: boolean }[] }
    const seenByDad = (await dad('householdInfo', {})) as Info
    expect(seenByDad.role).toBe('member')
    expect(seenByDad.members.map((m) => [m.name, m.role])).toEqual([['Mom', 'owner'], ['Dad', 'member']])
    await expect(dad('createInvite', {})).rejects.toThrow('Only the owner can invite')
    await expect(dad('removeMember', { userId: 'user_mom' })).rejects.toThrow('Only the owner can remove')
    expect(((await mom('householdInfo', {})) as Info).role).toBe('owner')
  })

  it('shows the new family\'s whole log to someone who moves from a family that has other people', async () => {
    const mom = await phone()
    const dad = await phone()
    const gran = await phone()
    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')
    await mom.append(feed(1_000_000), 'Mom')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))
    await gran.append(feed(5_000_000), 'Gran')
    await gran.append({ kind: 'note', at: 6_000_000, note: 'bath' }, 'Gran')
    await syncOnce(gran, callAs('tok_gran'))

    const { code } = (await callAs('tok_gran')('createInvite', {})) as { code: string }
    await callAs('tok_dad')('joinHousehold', { code, name: 'Dad' })
    await syncOnce(dad, callAs('tok_dad'))

    expect(dad.list().map((e) => e.at)).toEqual(expect.arrayContaining([5_000_000, 6_000_000]))
    await syncOnce(gran, callAs('tok_gran'))
    await gran.append(feed(7_000_000), 'Gran')
    await syncOnce(gran, callAs('tok_gran'))
    await syncOnce(dad, callAs('tok_dad'))
    expect(dad.list().map((e) => e.at)).toContain(7_000_000)
    // Mom logged this in the family Dad left; it must not follow him into Gran's.
    expect(gran.list().map((e) => e.at)).not.toContain(1_000_000)
  })

  it('accepts a code however a phone or messaging app rewrote it', async () => {
    const mom = callAs('tok_mom')
    await mom('householdInfo', { name: 'Mom' })
    const { code } = (await mom('createInvite', {})) as { code: string }
    const [a, b] = code.split('-')
    for (const typed of [`${a}–${b}`, `${a}—${b}`, `${a} ${b}`, `${a}${b}`.toLowerCase(), ` ${a}‑${b}\n`]) {
      expect(await callAs('tok_dad')('previewInvite', { code: typed })).toEqual({ ownerName: 'Mom' })
    }
  })

  it('keeps an uninvited account out', async () => {
    const mom = await phone()
    const gran = await phone()
    await mom.append(feed(1_000_000), 'Mom')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(gran, callAs('tok_gran'))
    expect(gran.list()).toEqual([])
  })

  it('stops receiving after being removed, while the logs stay for the owner', async () => {
    const mom = await phone()
    const dad = await phone()
    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')
    await mom.append(feed(1_000_000), 'Mom')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))

    await callAs('tok_mom')('removeMember', { userId: 'user_dad' })
    await mom.append(feed(2_000_000), 'Mom')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))
    // Mom's entries belong to the family Dad was removed from, so they leave his phone; what he logged himself stays.
    expect(dad.list()).toEqual([])
    expect(mom.list()).toHaveLength(2)
  })

  it('pulls a long history in pages', async () => {
    const mom = await phone()
    const dad = await phone()
    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')
    for (let i = 0; i < 30; i++) await mom.append({ kind: 'note', at: 1_000_000 + i * 600_000, note: `n${i}` }, 'Mom')
    await syncOnce(mom, callAs('tok_mom'))
    await syncOnce(dad, callAs('tok_dad'))
    expect(dad.list()).toHaveLength(30)
  })

  it('shares the baby name, birth date and tummy goal, and takes the family values on joining', async () => {
    const mom = await phone()
    const dad = await phone()
    await mom.setSetting('baby', 'Lily')
    await mom.setSetting('birth', '2026-06-20')
    await dad.setSetting('baby', 'Baby')
    await dad.setSetting('unit', 'ml')
    await syncOnce(mom, callAs('tok_mom'))

    await join(callAs('tok_mom'), callAs('tok_dad'), 'Dad')
    const first = await syncOnce(dad, callAs('tok_dad'))
    expect(first.settingsChanged).toBe(true)
    expect(await dad.getSetting('baby')).toBe('Lily')
    expect(await dad.getSetting('birth')).toBe('2026-06-20')
    expect(await dad.getSetting('unit')).toBe('ml')

    await dad.setSetting('tummyGoal', '45')
    await syncOnce(dad, callAs('tok_dad'))
    const second = await syncOnce(mom, callAs('tok_mom'))
    expect(second.settingsChanged).toBe(true)
    expect(await mom.getSetting('tummyGoal')).toBe('45')
    expect(await mom.getSetting('unit')).toBe('oz')
    expect((await syncOnce(mom, callAs('tok_mom'))).settingsChanged).toBe(false)
  })

  it('gives a new household the values from the phone that creates it', async () => {
    const mom = await phone()
    await mom.setSetting('baby', 'Lily')
    await syncOnce(mom, callAs('tok_mom'))
    const dad = await phone()
    await dad.setSetting('baby', 'Max')
    await syncOnce(dad, callAs('tok_dad'))
    expect(await dad.getSetting('baby')).toBe('Max')
    expect(await mom.getSetting('baby')).toBe('Lily')
  })
})

