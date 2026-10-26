import { describe, expect, it } from 'vitest'
import { cleanSpoken } from './spoken'

describe('cleanSpoken', () => {
  it('drops filler sounds and the commas they leave behind', () => {
    expect(cleanSpoken('um fed, uh, four ounces')).toBe('fed, four ounces')
    expect(cleanSpoken('Uhh she is, erm, down for a nap')).toBe('she is, down for a nap')
    expect(cleanSpoken('wet diaper hmm and um bath')).toBe('wet diaper and bath')
  })

  it('keeps words that only start like a filler', () => {
    expect(cleanSpoken('umbrella stroller, error on the scale, ahead of schedule')).toBe('umbrella stroller, error on the scale, ahead of schedule')
  })

  it('leaves clear speech alone and tidies the spacing', () => {
    expect(cleanSpoken('  fed   4oz ')).toBe('fed 4oz')
    expect(cleanSpoken('')).toBe('')
  })

  it('does not return only a leftover comma', () => {
    expect(cleanSpoken('um,')).toBe('')
  })
})
