import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/vercel'
import { gmailImporter } from '../../agent/appointments.js'
import { createApp, sharedDb } from '../../backend/app.js'
import { userCalendar } from '../../backend/calendar.js'

// Same origins as api/agent.ts: the web app, plus the Capacitor shells that call us cross-origin.
const NATIVE_ORIGINS = new Set(['https://localhost', 'capacitor://localhost'])

function handler() {
  const root = new Hono()
  root.use(
    '*',
    cors({
      origin: (origin) => (origin === process.env.AGENT_ALLOWED_ORIGIN || NATIVE_ORIGINS.has(origin) ? origin : null),
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  // route() mounts under the prefix; basePath() would not re-prefix routes createApp already registered (404).
  root.route('/api/backend', createApp(sharedDb(), { importer: gmailImporter, calendar: userCalendar }))
  return handle(root)
}

export const POST = (request: Request) => handler()(request)
export const OPTIONS = (request: Request) => handler()(request)
