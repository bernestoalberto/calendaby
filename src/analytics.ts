/**
 * Product analytics through Google Analytics 4 (docs/PLAN_ANALYTICS.md). Nothing is loaded until a parent turns it on
 * in Profile. Only the events and labels below can be sent: no text, names, dates, amounts, codes or addresses.
 */
const MEASUREMENT_ID = 'G-MEV4FXM7CK'

// Each event and, for each label it may carry, the only values allowed. Anything else is dropped.
const EVENTS = {
  screen_view: { screen: ['today', 'timeline', 'activity', 'log', 'analytics', 'calendar', 'agent', 'profile'] },
  log_entry: { kind: ['feed', 'sleep', 'diaper', 'med', 'note', 'activity', 'pump'] },
  invite_shared: {},
} as const

type Events = typeof EVENTS
export type EventName = keyof Events
export type EventParams<N extends EventName> = { [K in keyof Events[N]]: Events[N][K] extends readonly (infer V)[] ? V : never }

interface Page {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  [flag: string]: unknown
}

const page = (): Page => window as unknown as Page
const disableFlag = `ga-disable-${MEASUREMENT_ID}`

let enabled = false
let loaded = false

function load(): void {
  const w = page()
  w.dataLayer = w.dataLayer ?? []
  const queue = w.dataLayer
  // Google's tag reads `arguments` objects from the queue; a plain array is ignored.
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    queue.push(arguments)
  }
  const gtag = w.gtag
  // Measurement only: no ad signals, no ad personalisation, and no page address with its query (an invite link carries a code).
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
  gtag('js', new Date())
  gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${location.origin}${location.pathname}`,
    page_title: 'Calendaby',
  })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)
  loaded = true
}

/** Applies the parent's choice. Turning it off stops everything at once; the tag is loaded only the first time it is on. */
export function setAnalytics(on: boolean): void {
  enabled = on
  page()[disableFlag] = !on
  if (on && !loaded) load()
}

/** Sends one event if analytics is on and the event and its labels are on the list. */
export function track<N extends EventName>(name: N, params?: EventParams<N>): void {
  if (!enabled || !loaded) return
  const allowed: Record<string, readonly string[]> | undefined = EVENTS[name]
  const given: Record<string, unknown> = params ?? {}
  const clean = allowed !== undefined && Object.keys(given).every((k) => allowed[k]?.includes(String(given[k])))
  if (!clean) {
    console.warn('Analytics event dropped: not on the list', name)
    return
  }
  page().gtag?.('event', name, given)
}
