import { describe, expect, it, vi } from 'vitest'
import { updateWhenAway } from './updateWhenAway'

function fakeDocument(state: 'visible' | 'hidden') {
  const listeners = new Set<() => void>()
  const doc = {
    visibilityState: state,
    addEventListener: (_: 'visibilitychange', fn: () => void) => listeners.add(fn),
    removeEventListener: (_: 'visibilitychange', fn: () => void) => listeners.delete(fn),
    go(next: 'visible' | 'hidden') {
      doc.visibilityState = next
      for (const fn of [...listeners]) fn()
    },
    listeners,
  }
  return doc
}

describe('updateWhenAway', () => {
  it('updates right away when the app is already in the background', () => {
    const update = vi.fn()
    updateWhenAway(update, fakeDocument('hidden'))
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('waits while the parent is using the app, so nothing reloads mid-entry', () => {
    const update = vi.fn()
    const doc = fakeDocument('visible')
    updateWhenAway(update, doc)
    expect(update).not.toHaveBeenCalled()
    doc.go('visible')
    expect(update).not.toHaveBeenCalled()
  })

  it('updates once the app goes to the background and then stops listening', () => {
    const update = vi.fn()
    const doc = fakeDocument('visible')
    updateWhenAway(update, doc)
    doc.go('hidden')
    expect(update).toHaveBeenCalledTimes(1)
    expect(doc.listeners.size).toBe(0)
    doc.go('visible')
    doc.go('hidden')
    expect(update).toHaveBeenCalledTimes(1)
  })
})
