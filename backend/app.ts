import { Hono } from 'hono'
import { openDb, type Db } from './db.js'
import { operations } from './operations.js'

export function createApp(db: Db) {
  const app = new Hono()
  for (const [operationId, op] of Object.entries(operations)) {
    app.post(`/${operationId}`, async (c) => {
      const input = op.input.safeParse(await c.req.json().catch(() => null))
      if (!input.success) return c.json({ error: input.error.message }, 400)
      return c.json(op.run(db, input.data as never))
    })
  }
  return app
}

let shared: Db | undefined

export function sharedDb(): Db {
  return (shared ??= openDb())
}
