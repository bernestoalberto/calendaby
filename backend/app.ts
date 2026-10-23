import { Hono } from 'hono'
import { z } from 'zod'
import type { CalEvent } from './calendar.js'
import type { Appointment } from '../src/domain/appointments.js'
import { authenticate, type Verifier } from './auth.js'
import { openDb, type Db } from './db.js'
import { operations } from './operations.js'

/** Finds proposed appointments in the user's mail. Injected so tests never touch Gmail or a model. */
export type Importer = (userId: string, now: string) => Promise<Appointment[]>

export interface AppOptions {
  verify?: Verifier
  importer?: Importer
  calendar?: (userId: string, from: number, to: number) => Promise<CalEvent[]>
}

const ImportInput = z.strictObject({ now: z.string().min(1) })
const CalendarInput = z.strictObject({ from: z.number().int().nonnegative(), to: z.number().int().positive() })

export function createApp(db: Db, { verify, importer, calendar }: AppOptions = {}) {
  const app = new Hono<{ Variables: { userId: string | null } }>()
  app.use('*', async (c, next) => {
    const auth = await authenticate(c.req.raw, verify)
    if (auth instanceof Response) return auth
    c.set('userId', auth.userId)
    return next()
  })
  for (const [operationId, op] of Object.entries(operations)) {
    app.post(`/${operationId}`, async (c) => {
      const input = op.input.safeParse(await c.req.json().catch(() => null))
      if (!input.success) return c.json({ error: input.error.message }, 400)
      return c.json(op.run(db, input.data as never))
    })
  }
  app.post('/importAppointments', async (c) => {
    const input = ImportInput.safeParse(await c.req.json().catch(() => null))
    if (!input.success) return c.json({ error: input.error.message }, 400)
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Sign in required' }, 401)
    if (!importer) return c.json({ error: 'Import is not configured' }, 503)
    try {
      const found = await importer(userId, input.data.now)
      return c.json({ found: found.length, added: db.putAppointments(found) })
    } catch (err) {
      console.error('import failed', err)
      return c.json({ error: 'Could not read Gmail' }, 502)
    }
  })
  app.post('/listCalendar', async (c) => {
    const input = CalendarInput.safeParse(await c.req.json().catch(() => null))
    if (!input.success || input.data.to <= input.data.from) return c.json({ error: 'Bad request' }, 400)
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'Sign in required' }, 401)
    if (!calendar) return c.json({ error: 'Calendar is not configured' }, 503)
    try {
      return c.json(await calendar(userId, input.data.from, input.data.to))
    } catch (err) {
      console.error('calendar failed', err)
      return c.json({ error: 'Could not read Google Calendar' }, 502)
    }
  })
  return app
}

let shared: Db | undefined

export function sharedDb(): Db {
  return (shared ??= openDb())
}
