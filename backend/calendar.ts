import { googleAccessToken } from './gmail.js'

export interface CalEvent {
  id: string
  title: string
  startsAt: number // epoch ms
  endsAt: number
  allDay: boolean
}

interface GoogleEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

export async function listCalendarEvents(
  accessToken: string,
  from: number,
  to: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CalEvent[]> {
  const query = new URLSearchParams({
    timeMin: new Date(from).toISOString(),
    timeMax: new Date(to).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })
  const res = await fetchImpl(`${API}?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new Error(`Calendar returned ${res.status}`)
  const { items = [] } = (await res.json()) as { items?: GoogleEvent[] }
  const out: CalEvent[] = []
  for (const e of items) {
    const startsAt = Date.parse(e.start?.dateTime ?? e.start?.date ?? '')
    const endsAt = Date.parse(e.end?.dateTime ?? e.end?.date ?? '')
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) continue
    out.push({ id: e.id, title: e.summary || '(no title)', startsAt, endsAt, allDay: !e.start?.dateTime })
  }
  return out
}

export async function userCalendar(userId: string, from: number, to: number): Promise<CalEvent[]> {
  return listCalendarEvents(await googleAccessToken(userId), from, to)
}
