import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from './app'
import { authorize } from './auth'
import { openDb } from './db'

const verify = async (token: string) => (token === 'good' ? 'user_1' : null)
const req = (authorization?: string) =>
  new Request('http://x/', { method: 'POST', headers: authorization ? { authorization } : {} })

afterEach(() => {
  delete process.env.CLERK_SECRET_KEY
})

describe('authorize', () => {
  it('stays open when sign-in is not configured', async () => {
    expect(await authorize(req())).toBeNull()
  })

  it('rejects a missing or bad token and accepts a good one', async () => {
    expect((await authorize(req(), verify))?.status).toBe(401)
    expect((await authorize(req('Bearer bad'), verify))?.status).toBe(401)
    expect(await authorize(req('Bearer good'), verify)).toBeNull()
  })

  it('protects the backend routes', async () => {
    const app = createApp(openDb(':memory:'), { verify })
    const post = (headers: Record<string, string>) =>
      app.request('/listEvents', { method: 'POST', headers, body: JSON.stringify({ since: 0 }) })
    expect((await post({})).status).toBe(401)
    expect((await post({ authorization: 'Bearer good' })).status).toBe(200)
  })
})
