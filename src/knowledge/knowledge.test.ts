import { describe, expect, it } from 'vitest'
import { CHECKUPS } from './checkups.js'
import { GUIDES, mo } from './guidance.js'
import { guide, nextCheckups, screen, TOPIC_NAMES, weeksOld } from './index.js'
import { RED_FLAGS } from './red-flags.js'
import { SOURCES } from './sources.js'

const now = new Date('2026-10-24T12:00:00').getTime()

describe('weeksOld', () => {
  it('counts whole weeks from a birth date', () => {
    expect(weeksOld('2026-10-10', now)).toBe(2)
    expect(weeksOld('2026-11-01', now)).toBeUndefined()
    expect(weeksOld(undefined, now)).toBeUndefined()
  })
})

describe('guide', () => {
  it('returns only the band for the baby age, with citations', () => {
    const a = guide('sleep', 6)
    expect(a.facts).toEqual([{ text: expect.stringContaining('14 to 17 hours'), cite: 1 }])
    expect(a.sources[0].org).toBe('CDC')
    expect(guide('sleep', mo(8)).facts[0].text).toContain('12 to 16 hours')
  })

  it('returns every band when the age is unknown', () => {
    expect(guide('sleep').facts).toHaveLength(3)
  })

  it('numbers each source once', () => {
    const a = guide('feeding', 3)
    expect(new Set(a.facts.map((f) => f.cite)).size).toBe(a.sources.length)
  })

  it('says there is no vetted guidance instead of guessing', () => {
    expect(guide('wake-windows', 10).facts).toEqual([])
    expect(guide('wake-windows', 10).note).toMatch(/No public health agency/)
    expect(guide('solids', 2).facts.some((f) => f.text.includes('honey'))).toBe(true)
    expect(guide('safe-sleep', mo(20)).note).toMatch(/No vetted guidance/)
  })

  it('refuses dosing', () => {
    expect(guide('medicine', 10).facts[0].text).toMatch(/cannot give medicine doses/)
  })

  it('lists the next checkups with vaccines and the schedule caveat', () => {
    const a = guide('checkups', mo(2) - 1)
    expect(a.facts[0].text).toMatch(/^2 months checkup\. Vaccines usually offered: DTaP/)
    expect(a.note).toMatch(/Confirm/)
  })

  it('covers every topic name without throwing', () => {
    for (const t of TOPIC_NAMES) expect(() => guide(t, 4)).not.toThrow()
  })
})

describe('data', () => {
  it('has valid age bands and https sources', () => {
    for (const g of [...GUIDES, ...RED_FLAGS]) expect(g.from).toBeLessThan(g.to)
    for (const s of Object.values(SOURCES)) expect(s.url).toMatch(/^https:\/\//)
  })

  it('keeps checkups in age order', () => {
    const ages = CHECKUPS.us.visits.map((v) => v.at)
    expect(ages).toEqual([...ages].sort((a, b) => a - b))
    expect(nextCheckups(mo(6) + 1).map((v) => v.label)).toEqual(['6 months', '9 months'])
  })
})

describe('screen', () => {
  it('flags fever by age', () => {
    expect(screen('she has a fever of 100.6', 6).flags.map((f) => f.id)).toEqual(['fever-under-3-months'])
    expect(screen('temp is 38.2 C', mo(5)).flags.map((f) => f.id)).toEqual(['fever'])
  })

  it('flags emergencies', () => {
    const s = screen("he's breathing fast and his lips look blue", 20)
    expect(s.flags[0]).toMatchObject({ id: 'breathing', urgency: 'emergency' })
    expect(screen('so floppy and hard to wake', 4).flags[0].urgency).toBe('emergency')
  })

  it('flags dehydration and dosing questions', () => {
    expect(screen('no wet diaper since this morning', 10).flags.map((f) => f.id)).toEqual(['dehydration'])
    expect(screen('how much tylenol can I give?', 30).dosing).toBe(true)
  })

  it('stays quiet for routine questions', () => {
    expect(screen('how long should she nap at 4 months?', 17)).toEqual({ flags: [], dosing: false })
    expect(screen('he finished 120 ml and burped', 8)).toEqual({ flags: [], dosing: false })
  })
})
