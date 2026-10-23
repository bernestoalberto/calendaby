import { z } from 'zod'
import { BabyEvent } from '../src/domain/events.js'
import type { Db } from './db.js'

function operation<S extends z.ZodType, R>(description: string, input: S, run: (db: Db, input: z.infer<S>) => R) {
  return { description, input, run }
}

// The key is the operationId: it names the route and the agent tool.
export const operations = {
  recordEvents: operation(
    'Store baby events, skipping ids already stored.',
    z.strictObject({ events: z.array(BabyEvent) }),
    (db, { events }) => ({ stored: db.insert(events) }),
  ),
  listEvents: operation(
    'List events at or after an epoch-ms time, oldest first.',
    z.strictObject({ since: z.number().int().nonnegative() }),
    (db, { since }) => db.since(since),
  ),
}
