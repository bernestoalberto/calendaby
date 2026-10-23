import { afterAll, beforeAll, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer
let base: string

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  server = await createServer({ logLevel: 'silent', server: { port: 0 } })
  delete process.env.CLERK_SECRET_KEY // the dev server loads .env.local
  await server.listen()
  const address = server.httpServer?.address()
  base = `http://localhost:${typeof address === 'object' && address ? address.port : ''}`
})

afterAll(() => server.close())

it('serves the app and the backend', async () => {
  expect((await fetch(base)).status).toBe(200)
  const res = await fetch(`${base}/api/backend/listEvents`, { method: 'POST', body: JSON.stringify({ since: 0 }) })
  expect(await res.json()).toEqual([])
})
