import { handle } from 'hono/vercel'
import { createApp, sharedDb } from '../../backend/app'

const app = createApp(sharedDb()).basePath('/api/backend')

export const POST = handle(app)
