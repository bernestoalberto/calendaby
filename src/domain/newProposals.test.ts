import { describe, expect, it } from 'vitest'
import type { Appointment } from './appointments'
import { newProposals, proposalAlert } from './newProposals'

const appt = (id: string, status: Appointment['status'], startsAt?: number): Appointment => ({ id, title: `Visit ${id}`, status, startsAt })

describe('newProposals', () => {
  it('returns proposals the phone has not seen before', () => {
    const seen = new Set(['gmail:1'])
    const list = [appt('gmail:1', 'proposed'), appt('gmail:2', 'proposed'), appt('gmail:3', 'review')]
    expect(newProposals(seen, list).map((a) => a.id)).toEqual(['gmail:2', 'gmail:3'])
  })

  it('ignores confirmed and dismissed ones, even if new', () => {
    const list = [appt('gmail:4', 'confirmed'), appt('gmail:5', 'dismissed')]
    expect(newProposals(new Set(), list)).toEqual([])
  })

  it('says nothing on the first look, when there is no baseline yet', () => {
    expect(newProposals(undefined, [appt('gmail:1', 'proposed')])).toEqual([])
  })
})

describe('proposalAlert', () => {
  it('names a single appointment with its time', () => {
    const at = new Date(2026, 10, 3, 9, 30).getTime()
    const alert = proposalAlert('EJ', [appt('gmail:1', 'proposed', at)])
    expect(alert.title).toBe('Found an appointment in your email')
    expect(alert.body).toContain('Visit gmail:1')
    expect(alert.body).toContain('Confirm')
  })

  it('counts several and asks to review the ones without a time', () => {
    const alert = proposalAlert('EJ', [appt('a', 'proposed', 1_800_000_000_000), appt('b', 'review')])
    expect(alert.title).toBe('Found 2 appointments in your email')
  })
})
