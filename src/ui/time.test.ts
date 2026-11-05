import { describe, expect, it } from 'vitest'
import { localDay } from './time'

describe('localDay', () => {
  it('is the calendar day on the parent\'s clock, not the UTC day', () => {
    expect(localDay(new Date(2026, 10, 5, 23, 30).getTime())).toBe('2026-11-05')
    expect(localDay(new Date(2026, 10, 5, 0, 30).getTime())).toBe('2026-11-05')
    expect(localDay(new Date(2026, 0, 1, 12, 0).getTime())).toBe('2026-01-01')
  })
})
