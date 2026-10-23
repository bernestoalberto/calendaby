import { describe, expect, it } from 'vitest'
import { featureFlags } from './features'

describe('featureFlags', () => {
  it('reads stored choices and treats unknown features as on', () => {
    const on = featureFlags([
      { id: 'timeline', label: 'T', hint: '', group: 'Tabs', enabled: false },
      { id: 'agent', label: 'A', hint: '', group: 'Tabs', enabled: true },
    ])
    expect(on('timeline')).toBe(false)
    expect(on('agent')).toBe(true)
    expect(on('brandNew')).toBe(true)
  })
})
