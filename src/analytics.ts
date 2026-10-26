import { Capacitor } from '@capacitor/core'

/**
 * Product analytics through Google Tag Manager, on the web version only (docs/PLAN_ANALYTICS.md). Nothing is loaded
 * until a parent turns it on in Profile. Only the events and labels below are handed to the container: no text, names,
 * dates, amounts, codes or addresses.
 */
const CONTAINER_ID = 'GTM-P2BQ7L9N'
// The Google Analytics property the container reports to; its disable flag is the second way of stopping it.
const MEASUREMENT_ID = 'G-MEV4FXM7CK'

// Each event and, for each label it may carry, the only values allowed. Anything else is dropped.
const EVENTS = {
  screen_opened: { screen: ['today', 'timeline', 'activity', 'log', 'analytics', 'calendar', 'agent', 'profile'] },
  log_entry: { kind: ['feed', 'sleep', 'diaper', 'med', 'note', 'activity', 'pump'] },
  invite_shared: {},
} as const

type Events = typeof EVENTS
export type EventName = keyof Events
export type EventParams<N extends EventName> = { [K in keyof Events[N]]: Events[N][K] extends readonly (infer V)[] ? V : never }

/** The phone apps do not measure anything; the switch in Profile is only shown on the web. */
export const analyticsAvailable = !Capacitor.isNativePlatform()

interface Page {
  dataLayer?: unknown[]
  [flag: string]: unknown
}

const page = (): Page => window as unknown as Page
const disableFlag = `ga-disable-${MEASUREMENT_ID}`

let enabled = false
let loaded = false

/** Tag Manager's `gtag(...)` calls are queued as `arguments` objects; a plain array is ignored. */
function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  page().dataLayer?.push(arguments)
}

function load(): void {
  const w = page()
  w.dataLayer = w.dataLayer ?? []
  // Measurement only. Set before the container runs, so its tags see it from the first moment.
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  // The container is told the address without its query (an invite link carries a code) and should use this, not the real one.
  w.dataLayer.push({ cleanLocation: `${location.origin}${location.pathname}` })
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${CONTAINER_ID}`
  document.head.appendChild(script)
  loaded = true
}

/** Applies the parent's choice. Turning it off stops everything at once; the container is loaded only the first time it is on. */
export function setAnalytics(on: boolean): void {
  if (!analyticsAvailable) return
  const was = enabled
  enabled = on
  page()[disableFlag] = !on
  if (on && !loaded) load()
  else if (loaded && was !== on) gtag('consent', 'update', { analytics_storage: on ? 'granted' : 'denied' })
}

/** Hands one event to the container if analytics is on and the event and its labels are on the list. */
export function track<N extends EventName>(name: N, params?: EventParams<N>): void {
  if (!enabled || !loaded) return
  const allowed: Record<string, readonly string[]> | undefined = Object.hasOwn(EVENTS, name) ? EVENTS[name] : undefined
  const given: Record<string, unknown> = params ?? {}
  const clean = allowed !== undefined && Object.keys(given).every((k) => allowed[k]?.includes(String(given[k])))
  if (!clean) {
    console.warn('Analytics event dropped: not on the list', name)
    return
  }
  page().dataLayer?.push({ event: name, ...given })
}
