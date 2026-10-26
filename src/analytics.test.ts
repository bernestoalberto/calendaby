import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Page {
  dataLayer?: unknown[]
  [flag: string]: unknown
}

let page: Page
let scripts: { src?: string; async?: boolean }[]

beforeEach(() => {
  vi.resetModules()
  page = {}
  scripts = []
  vi.stubGlobal('window', page)
  vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild: (s: { src?: string }) => scripts.push(s) } })
  vi.stubGlobal('location', { origin: 'https://app.example', pathname: '/', search: '?join=ABC-123' })
})

afterEach(() => vi.unstubAllGlobals())

const load = () => import('./analytics')
// Tag Manager reads two kinds of entries: `gtag(...)` calls (arguments objects) and plain objects.
const layer = () => (page.dataLayer ?? []).map((e) => (typeof (e as Iterable<unknown>)[Symbol.iterator] === 'function' ? Array.from(e as Iterable<unknown>) : e))
const events = () => layer().filter((e): e is { event: string } => typeof e === 'object' && !Array.isArray(e) && 'event' in (e as object) && (e as { event: string }).event !== 'gtm.js')
const consent = () => layer().filter((e) => Array.isArray(e) && e[0] === 'consent')

describe('analytics', () => {
  it('does nothing until a parent turns it on', async () => {
    const { track } = await load()
    track('log_entry', { kind: 'feed' })
    expect(scripts).toEqual([])
    expect(layer()).toEqual([])
  })

  it('loads Tag Manager once, only after it is turned on', async () => {
    const { setAnalytics } = await load()
    setAnalytics(true)
    setAnalytics(true)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-P2BQ7L9N')
    expect(layer().some((e) => (e as { event?: string }).event === 'gtm.js')).toBe(true)
  })

  it('sets consent before the container runs: measurement only, no ads', async () => {
    const { setAnalytics } = await load()
    setAnalytics(true)
    expect(consent()[0]).toEqual(['consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }])
    const firstConsent = layer().findIndex((e) => Array.isArray(e) && e[0] === 'consent')
    const start = layer().findIndex((e) => (e as { event?: string }).event === 'gtm.js')
    expect(firstConsent).toBeLessThan(start)
  })

  it('hands the container the page address without its query, never the real one', async () => {
    const { setAnalytics } = await load()
    setAnalytics(true)
    expect(layer()).toContainEqual({ cleanLocation: 'https://app.example/' })
    expect(JSON.stringify(layer())).not.toContain('ABC-123')
  })

  it('sends listed events with listed labels', async () => {
    const { setAnalytics, track } = await load()
    setAnalytics(true)
    track('screen_opened', { screen: 'timeline' })
    track('log_entry', { kind: 'diaper' })
    track('invite_shared')
    expect(events()).toEqual([{ event: 'screen_opened', screen: 'timeline' }, { event: 'log_entry', kind: 'diaper' }, { event: 'invite_shared' }])
  })

  it('drops anything that is not on the list, so free text can never leave the phone', async () => {
    const { setAnalytics, track } = await load()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setAnalytics(true)
    ;(track as (n: string, p?: Record<string, string>) => void)('anything_else', { kind: 'feed' })
    ;(track as (n: string, p?: Record<string, string>) => void)('gtm.js')
    track('log_entry', { kind: 'Lily had 4oz at 3pm' as never })
    track('log_entry', { note: 'bath' } as never)
    expect(events()).toEqual([])
  })

  it('tells Google to stop when turned off, and does not load the container twice when turned back on', async () => {
    const { setAnalytics, track } = await load()
    setAnalytics(true)
    setAnalytics(false)
    expect(consent().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }])
    expect(page['ga-disable-G-MEV4FXM7CK']).toBe(true)
    track('log_entry', { kind: 'feed' })
    expect(events()).toEqual([])
    setAnalytics(true)
    expect(consent().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }])
    expect(page['ga-disable-G-MEV4FXM7CK']).toBe(false)
    expect(scripts).toHaveLength(1)
    track('log_entry', { kind: 'feed' })
    expect(events()).toHaveLength(1)
  })
})
