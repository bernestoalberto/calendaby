import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { gmailImporter } from '../../agent/appointments.js'
import { createApp, sharedDb } from '../../backend/app.js'
import { userCalendar } from '../../backend/calendar.js'

// route() mounts under the prefix; basePath() would not re-prefix routes createApp already registered (404).
export const POST = (request: Request) =>
  handle(new Hono().route('/api/backend', createApp(sharedDb(), { importer: gmailImporter, calendar: userCalendar })))(request)
