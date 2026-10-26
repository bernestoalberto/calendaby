import type { Context, Hono } from 'hono'
import { z } from 'zod'
import { BabyEvent } from '../src/domain/events.js'
import { SettingChange } from '../src/domain/sharedSettings.js'
import { HouseholdError, type SharedStore } from './household.js'

export type Env = { Variables: { userId: string | null } }

/** Opens the shared store on first use, so an app without Turso configured still runs everything else. */
export type SharedProvider = () => Promise<SharedStore>

const MAX_BATCH = 200
const Name = z.string().trim().min(1).max(40)
const Code = z.string().trim().min(4).max(12)
const None = z.strictObject({})

// The household always comes from the verified sign-in; no route accepts one from the request.
async function member(c: Context<Env>, provider: SharedProvider, name?: string) {
  const userId = c.get('userId')
  if (!userId) return { error: c.json({ error: 'Sign in required' }, 401) }
  let store: SharedStore
  try {
    store = await provider()
  } catch (err) {
    console.error('shared store unavailable', err)
    return { error: c.json({ error: 'Sharing is not set up yet' }, 503) }
  }
  try {
    return { store, userId, householdId: await store.ensureHousehold(userId, name) }
  } catch (err) {
    return { error: failure(c, err) }
  }
}

function failure(c: Context<Env>, err: unknown) {
  if (err instanceof HouseholdError) {
    const status = err.problem === 'too_many_attempts' ? 429 : err.problem === 'not_owner' ? 403 : 400
    return c.json({ error: err.message, problem: err.problem }, status)
  }
  console.error('sharing failed', err)
  return c.json({ error: 'Could not reach the shared log' }, 502)
}

/** Registers the household routes: one POST per operation, like the rest of the backend. */
export function mountSharing(app: Hono<Env>, provider: SharedProvider) {
  function route<S extends z.ZodType>(
    id: string,
    input: S,
    run: (ctx: { store: SharedStore; userId: string; householdId: string }, body: z.infer<S>) => Promise<unknown>,
    nameOf?: (body: z.infer<S>) => string | undefined,
  ) {
    app.post(`/${id}`, async (c) => {
      const body = input.safeParse(await c.req.json().catch(() => null))
      if (!body.success) return c.json({ error: body.error.message }, 400)
      const m = await member(c, provider, nameOf?.(body.data))
      if (m.error) return m.error
      try {
        return c.json(await run({ store: m.store, userId: m.userId, householdId: m.householdId }, body.data))
      } catch (err) {
        return failure(c, err)
      }
    })
  }

  route('householdInfo', z.strictObject({ name: Name.optional() }), async ({ store, userId, householdId }) => {
    const members = await store.members(householdId)
    return {
      // Enough to see on two screens that they are the same family; never enough to act on one.
      familyId: householdId.slice(0, 6),
      role: members.find((m) => m.userId === userId)?.role ?? 'member',
      members: members.map((m) => ({ userId: m.userId, name: m.name, role: m.role, you: m.userId === userId })),
    }
  }, (b) => b.name)

  route('createInvite', None, ({ store, userId, householdId }) => store.createInvite(householdId, userId))

  route('previewInvite', z.strictObject({ code: Code }), ({ store, userId }, { code }) => store.previewInvite(userId, code))

  route(
    'joinHousehold',
    z.strictObject({ code: Code, name: Name }),
    async ({ store, userId }, { code, name }) => ({ joined: Boolean(await store.redeemInvite(userId, code, name)) }),
  )

  route('leaveHousehold', None, async ({ store, userId }) => {
    await store.leave(userId)
    return { left: true }
  })

  route('removeMember', z.strictObject({ userId: z.string().min(1) }), async ({ store, userId, householdId }, body) => ({
    removed: await store.removeMember(householdId, userId, body.userId),
  }))

  route(
    'pushChanges',
    z.strictObject({ events: z.array(BabyEvent).max(MAX_BATCH), deleted: z.array(z.string().min(1)).max(MAX_BATCH) }),
    async ({ store, householdId }, { events, deleted }) => {
      const stored = await store.putEvents(householdId, events)
      let removed = 0
      for (const id of deleted) removed += Number(await store.deleteEvent(householdId, id))
      return { household: householdId, stored, removed }
    },
  )

  route(
    'pullChanges',
    z.strictObject({ since: z.number().int().nonnegative() }),
    async ({ store, householdId }, { since }) => ({ household: householdId, ...(await store.changesSince(householdId, since)) }),
  )

  route(
    'syncSettings',
    z.strictObject({ changes: z.array(SettingChange).max(10) }),
    async ({ store, householdId }, { changes }) => ({ household: householdId, settings: await store.syncSettings(householdId, changes) }),
  )
}
