import { createHash, randomInt } from 'node:crypto'
import { createClient, type Client } from '@libsql/client'
import { BabyEvent } from '../src/domain/events.js'
import { SettingChange, type SharedSetting } from '../src/domain/sharedSettings.js'

/**
 * Storage that keeps a household's data in step across its caregivers' phones (docs/PLAN_SHARING.md). Each caregiver
 * signs in with their own account; the server maps the verified user to a household and passes that id to the event
 * methods, never one taken from the request body.
 */
export interface SharedChange {
  event: BabyEvent
  seq: number
  updatedAt: number
  deleted: boolean
}

export interface Member {
  userId: string
  name: string
  role: 'owner' | 'member'
  joinedAt: number
}

export type InviteProblem = 'invalid' | 'too_many_attempts' | 'in_household' | 'owner_leaving' | 'not_owner'

/** A problem the caller can show the parent. The message never says whether a code existed, expired or was used. */
export class HouseholdError extends Error {
  readonly problem: InviteProblem

  constructor(problem: InviteProblem, message: string) {
    super(message)
    this.problem = problem
  }
}

export interface SharedStore {
  /** The caller's household, created the first time it is needed. A user belongs to one household. */
  ensureHousehold(userId: string, name?: string): Promise<string>
  householdOf(userId: string): Promise<string | undefined>
  members(householdId: string): Promise<Member[]>
  /** A one-time code for the household's owner to share. Stored hashed; valid for 48 hours. */
  createInvite(householdId: string, createdBy: string): Promise<{ code: string; expiresAt: number }>
  /** Who owns the household behind a code, so the joiner can check before accepting. Does not use the code. */
  previewInvite(userId: string, code: string): Promise<{ ownerName: string }>
  /** Joins the household behind a code. Moves the user out of any household they were alone in. */
  redeemInvite(userId: string, code: string, name?: string): Promise<string>
  /** The owner removes someone. Their logs stay; they lose access. False when they were not a member. */
  removeMember(householdId: string, ownerId: string, userId: string): Promise<boolean>
  /** A non-owner leaves. */
  leave(userId: string): Promise<void>
  /** Inserts or updates events. A deleted event is not brought back by a late upload from another phone. */
  putEvents(householdId: string, events: BabyEvent[]): Promise<number>
  /** Marks an event deleted but keeps it so other phones learn about it. False when there was nothing to delete. */
  deleteEvent(householdId: string, id: string): Promise<boolean>
  /**
   * Applies a phone's setting updates (the later write wins, except `onlyIfMissing`, which never replaces a value)
   * and returns every shared setting the household has.
   */
  syncSettings(householdId: string, changes: SettingChange[]): Promise<SharedSetting[]>
  /**
   * Changes after `since` (0 for everything), oldest first, with the number to ask from next time. At most `limit` come
   * back; `more` says to ask again from `seq`.
   */
  changesSince(householdId: string, since: number, limit?: number): Promise<{ changes: SharedChange[]; seq: number; more: boolean }>
}

const INVITE_TTL_MS = 48 * 3_600_000
const MAX_FAILED_TRIES = 5
const TRY_WINDOW_MS = 10 * 60_000
// No 0/O/1/I/L, so a code read aloud or typed from a screenshot survives.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

// Each entry runs once, in order. Never edit an entry that has shipped; add a new one.
const MIGRATIONS: string[][] = [
  [
    // seq is the household's change counter: every create, edit or delete takes the next number.
    `CREATE TABLE household (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      seq INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE member (
      user_id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL REFERENCES household(id),
      role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
      name TEXT NOT NULL,
      joined_at INTEGER NOT NULL
    )`,
    `CREATE TABLE invite (
      code_hash TEXT PRIMARY KEY,
      household_id TEXT NOT NULL REFERENCES household(id),
      created_by TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    )`,
    'CREATE TABLE failed_try (user_id TEXT NOT NULL, at INTEGER NOT NULL)',
    `CREATE TABLE event (
      household_id TEXT NOT NULL REFERENCES household(id),
      id TEXT NOT NULL,
      at INTEGER NOT NULL,
      body TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      seq INTEGER NOT NULL,
      PRIMARY KEY (household_id, id)
    )`,
    'CREATE INDEX event_by_seq ON event (household_id, seq)',
  ],
  [
    `CREATE TABLE household_setting (
      household_id TEXT NOT NULL REFERENCES household(id),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (household_id, key)
    )`,
  ],
]

async function migrate(db: Client): Promise<void> {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')
  const { rows } = await db.execute('SELECT MAX(version) AS v FROM schema_version')
  const done = Number(rows[0]?.v ?? 0)
  for (let v = done; v < MIGRATIONS.length; v++) {
    await db.batch([...MIGRATIONS[v], { sql: 'INSERT INTO schema_version (version) VALUES (?)', args: [v + 1] }], 'write')
  }
}

const hashCode = (code: string) => createHash('sha256').update(code.trim().toUpperCase().replaceAll('-', '')).digest('hex')

function newCode(): string {
  const chars = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)])
  return `${chars.slice(0, 3).join('')}-${chars.slice(3).join('')}`
}

interface Options {
  url?: string
  authToken?: string
  now?: () => number
}

export async function openShared(options: Options = {}): Promise<SharedStore> {
  const url = options.url ?? process.env.TURSO_DATABASE_URL ?? 'file:calendaby-shared.db'
  const authToken = options.authToken ?? process.env.TURSO_AUTH_TOKEN
  const now = options.now ?? Date.now
  const db = createClient({ url, authToken })
  await migrate(db)

  const householdOf = async (userId: string) => {
    const { rows } = await db.execute({ sql: 'SELECT household_id FROM member WHERE user_id = ?', args: [userId] })
    return rows[0] ? String(rows[0].household_id) : undefined
  }

  const members = async (householdId: string): Promise<Member[]> => {
    const { rows } = await db.execute({
      sql: 'SELECT user_id, name, role, joined_at FROM member WHERE household_id = ? ORDER BY joined_at',
      args: [householdId],
    })
    return rows.map((r) => ({
      userId: String(r.user_id),
      name: String(r.name),
      role: r.role === 'owner' ? 'owner' : 'member',
      joinedAt: Number(r.joined_at),
    }))
  }

  const ensureHousehold = async (userId: string, name?: string) => {
    const existing = await householdOf(userId)
    if (existing) {
      // The household can start before the phone knows the caregiver's name, so a later real name replaces the placeholder.
      if (name) await db.execute({ sql: 'UPDATE member SET name = ? WHERE user_id = ? AND name <> ?', args: [name, userId, name] })
      return existing
    }
    const id = crypto.randomUUID()
    const at = now()
    await db.batch(
      [
        { sql: 'INSERT INTO household (id, created_at) VALUES (?, ?)', args: [id, at] },
        { sql: "INSERT INTO member (user_id, household_id, role, name, joined_at) VALUES (?, ?, 'owner', ?, ?)", args: [userId, id, name ?? 'Parent', at] },
      ],
      'write',
    )
    return id
  }

  /** Counts a wrong code against the user; too many in a short time locks guessing out. */
  async function guard(userId: string): Promise<void> {
    const { rows } = await db.execute({
      sql: 'SELECT COUNT(*) AS n FROM failed_try WHERE user_id = ? AND at > ?',
      args: [userId, now() - TRY_WINDOW_MS],
    })
    if (Number(rows[0].n) >= MAX_FAILED_TRIES) {
      throw new HouseholdError('too_many_attempts', 'Too many wrong codes. Try again in a few minutes.')
    }
  }

  async function findInvite(userId: string, code: string) {
    await guard(userId)
    const { rows } = await db.execute({
      sql: 'SELECT household_id FROM invite WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?',
      args: [hashCode(code), now()],
    })
    if (!rows[0]) {
      await db.execute({ sql: 'INSERT INTO failed_try (user_id, at) VALUES (?, ?)', args: [userId, now()] })
      throw new HouseholdError('invalid', 'That code did not work. Ask for a new one.')
    }
    return String(rows[0].household_id)
  }

  return {
    householdOf,
    members,
    ensureHousehold,

    async createInvite(householdId, createdBy) {
      const owner = (await members(householdId)).find((m) => m.userId === createdBy && m.role === 'owner')
      if (!owner) throw new HouseholdError('not_owner', 'Only the owner can invite')
      const code = newCode()
      const expiresAt = now() + INVITE_TTL_MS
      await db.execute({
        sql: 'INSERT INTO invite (code_hash, household_id, created_by, expires_at) VALUES (?, ?, ?, ?)',
        args: [hashCode(code), householdId, createdBy, expiresAt],
      })
      return { code, expiresAt }
    },

    async previewInvite(userId, code) {
      const householdId = await findInvite(userId, code)
      const owner = (await members(householdId)).find((m) => m.role === 'owner')
      return { ownerName: owner?.name ?? 'A parent' }
    },

    async redeemInvite(userId, code, name = 'Parent') {
      const householdId = await findInvite(userId, code)
      const current = await householdOf(userId)
      if (current === householdId) return householdId
      if (current && (await members(current)).length > 1) {
        throw new HouseholdError('in_household', 'Leave your current household first.')
      }
      const at = now()
      // Marking the code used in the same batch is what makes it single-use.
      const results = await db.batch(
        [
          { sql: 'UPDATE invite SET used_at = ? WHERE code_hash = ? AND used_at IS NULL', args: [at, hashCode(code)] },
          {
            // Replacing by user id moves them; changes() is the code update, so nothing moves if someone else used it first.
            sql: "INSERT OR REPLACE INTO member (user_id, household_id, role, name, joined_at) SELECT ?, ?, 'member', ?, ? WHERE changes() > 0",
            args: [userId, householdId, name, at],
          },
        ],
        'write',
      )
      if (results[1].rowsAffected === 0) throw new HouseholdError('invalid', 'That code did not work. Ask for a new one.')
      return householdId
    },

    async removeMember(householdId, ownerId, userId) {
      const list = await members(householdId)
      if (!list.some((m) => m.userId === ownerId && m.role === 'owner')) throw new HouseholdError('not_owner', 'Only the owner can remove someone')
      if (userId === ownerId) throw new HouseholdError('owner_leaving', 'The owner cannot be removed.')
      const res = await db.execute({ sql: 'DELETE FROM member WHERE user_id = ? AND household_id = ?', args: [userId, householdId] })
      return res.rowsAffected > 0
    },

    async leave(userId) {
      const current = await householdOf(userId)
      if (!current) return
      const me = (await members(current)).find((m) => m.userId === userId)
      if (me?.role === 'owner') throw new HouseholdError('owner_leaving', 'The owner cannot leave. Remove the others first.')
      await db.execute({ sql: 'DELETE FROM member WHERE user_id = ?', args: [userId] })
    },

    async putEvents(householdId, events) {
      // Validate everything before writing anything, so a bad item cannot leave a half-saved batch.
      const valid = events.map((e) => BabyEvent.parse(e))
      if (valid.length === 0) return 0
      const at = now()
      const statements = valid.flatMap((e) => [
        { sql: 'UPDATE household SET seq = seq + 1 WHERE id = ?', args: [householdId] },
        {
          sql: `INSERT INTO event (household_id, id, at, body, updated_at, seq)
            SELECT id, ?, ?, ?, ?, seq FROM household WHERE id = ?
            ON CONFLICT (household_id, id) DO UPDATE SET
              at = excluded.at, body = excluded.body, updated_at = excluded.updated_at, seq = excluded.seq
            WHERE event.deleted_at IS NULL`,
          args: [e.id, e.at, JSON.stringify(e), at, householdId],
        },
      ])
      const results = await db.batch(statements, 'write')
      return results.filter((_, i) => i % 2 === 1).reduce((n, r) => n + r.rowsAffected, 0)
    },

    async deleteEvent(householdId, id) {
      const at = now()
      const [changed] = await db.batch(
        [
          {
            sql: `UPDATE event SET deleted_at = ?, updated_at = ?, seq = (SELECT seq + 1 FROM household WHERE id = ?)
              WHERE household_id = ? AND id = ? AND deleted_at IS NULL`,
            args: [at, at, householdId, householdId, id],
          },
          { sql: 'UPDATE household SET seq = seq + 1 WHERE id = ? AND changes() > 0', args: [householdId] },
        ],
        'write',
      )
      return changed.rowsAffected > 0
    },

    async syncSettings(householdId, changes) {
      const valid = changes.map((c) => SettingChange.parse(c))
      const at = now()
      if (valid.length > 0) {
        await db.batch(
          valid.map((c) => ({
            sql: c.onlyIfMissing
              ? 'INSERT OR IGNORE INTO household_setting (household_id, key, value, updated_at) VALUES (?, ?, ?, ?)'
              : `INSERT INTO household_setting (household_id, key, value, updated_at) VALUES (?, ?, ?, ?)
                ON CONFLICT (household_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            args: [householdId, c.key, c.value, at],
          })),
          'write',
        )
      }
      const { rows } = await db.execute({ sql: 'SELECT key, value FROM household_setting WHERE household_id = ? ORDER BY key', args: [householdId] })
      return rows.map((r) => ({ key: String(r.key) as SharedSetting['key'], value: String(r.value) }))
    },

    async changesSince(householdId, since, limit = 500) {
      const { rows } = await db.execute({
        sql: 'SELECT body, seq, updated_at, deleted_at FROM event WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT ?',
        args: [householdId, since, limit + 1],
      })
      const changes = rows.slice(0, limit).map((r) => ({
        event: BabyEvent.parse(JSON.parse(String(r.body))),
        seq: Number(r.seq),
        updatedAt: Number(r.updated_at),
        deleted: r.deleted_at !== null,
      }))
      return { changes, seq: changes.at(-1)?.seq ?? since, more: rows.length > limit }
    },
  }
}
