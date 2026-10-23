/** One row of the `features` table. The rows, their labels and their order live in SQLite, not in the UI. */
export interface FeatureRow {
  id: string
  label: string
  hint: string
  group: string
  enabled: boolean
}

/** Seed for a fresh database: every feature starts on. Existing choices are never overwritten. */
export const DEFAULT_FEATURES: Omit<FeatureRow, 'enabled'>[] = [
  { id: 'napForecast', label: 'Next nap prediction', hint: 'The nap card on Today', group: 'Today' },
  { id: 'insights', label: 'Smart predictions & advice', hint: 'Rhythm-based tips on Today', group: 'Today' },
  { id: 'freeText', label: 'Type or speak to log', hint: 'The "say it" box on Today', group: 'Today' },
  { id: 'lastCards', label: 'Last sleep, feed, diaper, medicine', hint: 'The four summary cards on Today', group: 'Today' },
  { id: 'totals', label: 'Totals for today', hint: 'Sleep goal, feeds and diapers', group: 'Today' },
  { id: 'handoff', label: 'Handoff brief', hint: 'The card on Today and the Profile button', group: 'Today' },
  { id: 'timeline', label: 'Timeline', hint: 'Tab with every log', group: 'Tabs' },
  { id: 'analytics', label: 'Analytics', hint: 'Full stats and trends', group: 'Tabs' },
  { id: 'calendar', label: 'Calendar', hint: 'Doctor appointments from Gmail (needs sign-in)', group: 'Tabs' },
  { id: 'agent', label: 'Assistant', hint: 'Ask-the-agent tab and buttons (needs sign-in)', group: 'Tabs' },
]

/** Lookup for the UI. A feature the database does not know about counts as on, so a new one never starts hidden. */
export function featureFlags(rows: FeatureRow[]): (id: string) => boolean {
  const byId = new Map(rows.map((r) => [r.id, r.enabled]))
  return (id) => byId.get(id) ?? true
}
