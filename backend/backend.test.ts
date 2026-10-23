import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { openDb } from './db'
import { operations } from './operations'

const feed = { id: 'a', loggedBy: 'dad', kind: 'feed', method: 'bottle', amountMl: 120, at: 1_000 } as const

function post(app: ReturnType<typeof createApp>, operationId: string, body: unknown) {
  return app.request(`/${operationId}`, { method: 'POST', body: JSON.stringify(body) })
}

describe('backend', () => {
  it('stores events once and lists them from a time', async () => {
    const app = createApp(openDb(':memory:'))
    expect(await (await post(app, 'recordEvents', { events: [feed] })).json()).toEqual({ stored: 1 })
    expect(await (await post(app, 'recordEvents', { events: [feed] })).json()).toEqual({ stored: 0 })
    expect(await (await post(app, 'listEvents', { since: 500 })).json()).toEqual([feed])
    expect(await (await post(app, 'listEvents', { since: 2_000 })).json()).toEqual([])
  })

  it('rejects missing and unknown inputs', async () => {
    const app = createApp(openDb(':memory:'))
    expect((await post(app, 'listEvents', {})).status).toBe(400)
    expect((await post(app, 'listEvents', { since: 1, extra: true })).status).toBe(400)
  })

  it('describes every operation in one line', () => {
    for (const op of Object.values(operations)) expect(op.description).toMatch(/^[^\n]+\.$/)
  })
})
