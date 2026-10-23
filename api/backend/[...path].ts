import { handle } from 'hono/vercel'
import { createApp, sharedDb } from '../../backend/app.js'

export const POST = (request: Request) => handle(createApp(sharedDb()).basePath('/api/backend'))(request)
