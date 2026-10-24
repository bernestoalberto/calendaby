/** One row of the `features` table. The rows, their labels and their order live in SQLite, not in the UI. */
export interface FeatureRow {
  id: string
  label: string
  hint: string
  group: string
  enabled: boolean
}

/** Seed for a fresh database. Features start on unless `off` is set; existing choices are never overwritten. */
export const DEFAULT_FEATURES: (Omit<FeatureRow, 'enabled'> & { off?: boolean })[] = [
  { id: 'napForecast', label: 'Next nap prediction', hint: 'The nap card on Today', group: 'Today' },
  { id: 'insights', label: 'Coming up & tonight', hint: 'Next nap, feed and bedtime with time ranges', group: 'Today' },
  { id: 'freeText', label: 'Type or speak to log', hint: 'The "say it" box on Today', group: 'Today' },
  { id: 'lastCards', label: 'Last sleep, feed, diaper, medicine', hint: 'The four summary cards on Today', group: 'Today' },
  { id: 'totals', label: 'Totals for today', hint: 'Sleep goal, feeds and diapers', group: 'Today' },
  { id: 'handoff', label: 'Handoff brief', hint: 'The card on Today and the Profile button', group: 'Today' },
  { id: 'activities', label: 'Tummy time & activities', hint: 'Tummy time, bath and play logging and totals', group: 'Log' },
  { id: 'pumping', label: 'Pumping', hint: 'Pump sessions and milk totals', group: 'Log' },
  { id: 'timeline', label: 'Timeline', hint: 'Tab with every log', group: 'Tabs' },
  { id: 'analytics', label: 'Analytics', hint: 'Full stats and trends', group: 'Tabs' },
  { id: 'calendar', label: 'Calendar', hint: 'Doctor appointments from Gmail (needs sign-in)', group: 'Tabs' },
  { id: 'agent', label: 'Assistant', hint: 'Ask-the-agent tab and buttons (needs sign-in)', group: 'Tabs' },
  { id: 'alertWindDown', label: 'Nap wind-down', hint: '15 minutes before the nap window opens', group: 'Notifications' },
  { id: 'alertBriefing', label: 'Morning briefing', hint: "One note with the day's outlook", group: 'Notifications' },
  { id: 'alertNapDue', label: 'Nap overdue', hint: 'When the nap window has closed', group: 'Notifications', off: true },
  { id: 'alertWake', label: 'Wake-up soon', hint: 'Before the usual nap length is reached', group: 'Notifications', off: true },
  { id: 'alertFeed', label: 'Feed due', hint: 'At the usual feed gap', group: 'Notifications', off: true },
  { id: 'alertDiaper', label: 'Diaper check', hint: 'After a long stretch with no change', group: 'Notifications', off: true },
]

/** Lookup for the UI. A feature the database does not know about counts as on, so a new one never starts hidden. */
export function featureFlags(rows: FeatureRow[]): (id: string) => boolean {
  const byId = new Map(rows.map((r) => [r.id, r.enabled]))
  return (id) => byId.get(id) ?? true
}
