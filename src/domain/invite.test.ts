import { describe, expect, it } from 'vitest'
import { inviteMessage } from './invite'

describe('inviteMessage', () => {
  it('carries the code, the owner name and where to enter it', () => {
    const text = inviteMessage('ABC-123', Date.UTC(2026, 9, 26, 21, 0), 'Dad')
    expect(text).toContain('ABC-123')
    expect(text).toContain('Dad')
    expect(text).toContain('Profile > Family')
    expect(text).toContain('only works once')
    // A link opens the join box with the code filled in, so nothing has to be typed.
    expect(text).toContain('https://calendaby.vercel.app/?join=ABC-123')
  })
})
