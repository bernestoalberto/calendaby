import { describe, expect, it } from 'vitest'
import { listCalendarEvents } from './calendar.js'
import { GoogleError, gmailMailbox } from './gmail.js'

const status = (code: number) => (async () => new Response('{}', { status: code })) as typeof fetch

describe('Google failures the parent can fix', () => {
  it('reports a refused Gmail call as a GoogleError', async () => {
    await expect(gmailMailbox('t', status(403)).search('x', 1)).rejects.toThrow(GoogleError)
  })

  it('says to sign in again when the token expired', async () => {
    await expect(listCalendarEvents('t', 0, 1, status(401))).rejects.toThrow(/sign in again/i)
  })

  it('keeps other statuses generic', async () => {
    const err = await listCalendarEvents('t', 0, 1, status(500)).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(GoogleError)
  })
})
