import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Page {
  dataLayer?: IArguments[]
  [flag: string]: unknown
}

let page: Page
let scripts: { src?: string; async?: boolean }[]

beforeEach(async () => {
  vi.resetModules()
  page = {}
  scripts = []
  vi.stubGlobal('window', page)
  vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild: (s: { src?: string }) => scripts.push(s) } })
  vi.stubGlobal('location', { origin: 'https://app.example', pathname: '/', search: '?join=ABC-123' })
})

afterEach(() => vi.unstubAllGlobals())

const load = () => import('./analytics')
const sent = () => (page.dataLayer ?? []).map((a) => Array.from(a))
const events = () => sent().filter((a) => a[0] === 'event')

describe('analytics', () => {
  it('does nothing until a parent turns it on', async () => {
    const { track } = await load()
    track('log_entry', { kind: 'feed' })
    expect(scripts).toEqual([])
    expect(sent()).toEqual([])
  })

  it('loads Google\'s tag once, only after it is turned on', async () => {
    const { setAnalytics } = await load()
    setAnalytics(true)
    setAnalytics(true)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-MEV4FXM7CK')
  })

  it('keeps ads and the address query out of what is sent', async () => {
    const { setAnalytics } = await load()
    setAnalytics(true)
    const config = sent().find((a) => a[0] === 'config')
    expect(config?.[1]).toBe('G-MEV4FXM7CK')
    expect(config?.[2]).toMatchObject({ send_page_view: false, allow_google_signals: false, page_location: 'https://app.example/' })
    expect(JSON.stringify(sent())).not.toContain('ABC-123')
    expect(sent().find((a) => a[0] === 'consent')?.[2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied' })
  })

  it('sends listed events with listed labels', async () => {
    const { setAnalytics, track } = await load()
    setAnalytics(true)
    track('screen_view', { screen: 'timeline' })
    track('log_entry', { kind: 'diaper' })
    track('invite_shared')
    expect(events()).toEqual([
      ['event', 'screen_view', { screen: 'timeline' }],
      ['event', 'log_entry', { kind: 'diaper' }],
      ['event', 'invite_shared', {}],
    ])
  })

  it('drops anything that is not on the list, so free text can never leave the phone', async () => {
    const { setAnalytics, track } = await load()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    setAnalytics(true)
    ;(track as (n: string, p?: Record<string, string>) => void)('anything_else', { kind: 'feed' })
    track('log_entry', { kind: 'Lily had 4oz at 3pm' as never })
    track('log_entry', { note: 'bath' } as never)
    expect(events()).toEqual([])
  })

  it('stops sending when turned off, and does not load the tag twice when turned back on', async () => {
    const { setAnalytics, track } = await load()
    setAnalytics(true)
    setAnalytics(false)
    expect(page['ga-disable-G-MEV4FXM7CK']).toBe(true)
    track('log_entry', { kind: 'feed' })
    expect(events()).toEqual([])
    setAnalytics(true)
    expect(page['ga-disable-G-MEV4FXM7CK']).toBe(false)
    expect(scripts).toHaveLength(1)
    track('log_entry', { kind: 'feed' })
    expect(events()).toHaveLength(1)
  })
})
