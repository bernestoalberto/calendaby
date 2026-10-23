import { handle } from 'hono/vercel'
import { gmailImporter } from '../../agent/appointments.js'
import { createApp, sharedDb } from '../../backend/app.js'
import { userCalendar } from '../../backend/calendar.js'

export const POST = (request: Request) =>
  handle(createApp(sharedDb(), { importer: gmailImporter, calendar: userCalendar }).basePath('/api/backend'))(request)
