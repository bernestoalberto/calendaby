import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollBehavior } from './motion'

afterEach(() => vi.unstubAllGlobals())

describe('scrollBehavior', () => {
  it('scrolls smoothly by default', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    expect(scrollBehavior()).toBe('smooth')
  })

  it('jumps instead when the person asked the device to reduce motion', () => {
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)' }) })
    expect(scrollBehavior()).toBe('auto')
  })

  it('scrolls smoothly where the browser cannot say', () => {
    vi.stubGlobal('window', {})
    expect(scrollBehavior()).toBe('smooth')
  })
})
