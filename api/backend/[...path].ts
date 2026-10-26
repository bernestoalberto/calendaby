import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/vercel'
import { gmailImporter } from '../../agent/appointments.js'
import { createApp, sharedDb } from '../../backend/app.js'
import { userCalendar } from '../../backend/calendar.js'
import { openShared, type SharedStore } from '../../backend/household.js'
import { isAllowedOrigin } from '../../backend/origins.js'

// Same origins as api/agent.ts: the web app, plus the Capacitor shells that call us cross-origin.

let opening: Promise<SharedStore> | undefined

// A failed open (Turso not configured, network) is retried on the next request instead of cached.
function sharedStore(): Promise<SharedStore> {
  opening ??= openShared().catch((err: unknown) => {
    opening = undefined
    throw err
  })
  return opening
}

function handler() {
  const root = new Hono()
  root.use(
    '*',
    cors({
      origin: (origin, c) => (isAllowedOrigin(origin, c.req.url, process.env.AGENT_ALLOWED_ORIGIN) ? origin : null),
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  // route() mounts under the prefix; basePath() would not re-prefix routes createApp already registered (404).
  root.route('/api/backend', createApp(sharedDb(), { importer: gmailImporter, calendar: userCalendar, shared: sharedStore }))
  return handle(root)
}

export const POST = (request: Request) => handler()(request)
export const OPTIONS = (request: Request) => handler()(request)
