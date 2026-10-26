import { afterEach, describe, expect, it, vi } from 'vitest'
import { capturePendingJoin, forgetPendingJoin, peekPendingJoin } from './pendingJoin'

function fakeBrowser(search: string, session: Record<string, string> = {}) {
  const replaced: string[] = []
  vi.stubGlobal('location', { search, pathname: '/' })
  vi.stubGlobal('history', { replaceState: (_: unknown, __: string, url: string) => replaced.push(url) })
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => session[k] ?? null,
    setItem: (k: string, v: string) => void (session[k] = v),
    removeItem: (k: string) => void delete session[k],
  })
  return { session, replaced }
}

afterEach(() => {
  forgetPendingJoin()
  vi.unstubAllGlobals()
})

describe('pending join code', () => {
  it('keeps the code from the link, and takes it out of the address bar', () => {
    const b = fakeBrowser('?join=PK5-CPA')
    capturePendingJoin()
    expect(peekPendingJoin()).toBe('PK5-CPA')
    expect(b.replaced).toEqual(['/'])
  })

  it('still has it after signing in sent the person away and back', async () => {
    const b = fakeBrowser('?join=PK5-CPA')
    capturePendingJoin()
    // Signing in with Google leaves the page and loads it again: nothing in memory survives, the session does.
    vi.resetModules()
    fakeBrowser('', b.session)
    const reloaded = await import('./pendingJoin')
    reloaded.capturePendingJoin()
    expect(reloaded.peekPendingJoin()).toBe('PK5-CPA')
  })

  it('forgets it once used', () => {
    const b = fakeBrowser('?join=PK5-CPA')
    capturePendingJoin()
    forgetPendingJoin()
    expect(peekPendingJoin()).toBeUndefined()
    expect(b.session).toEqual({})
  })

  it('ignores a link that is not an invite', () => {
    const b = fakeBrowser('?join=nope')
    capturePendingJoin()
    expect(peekPendingJoin()).toBeUndefined()
    expect(b.replaced).toEqual([])
  })
})
