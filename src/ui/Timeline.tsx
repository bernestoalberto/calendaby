import { useMemo, useState } from 'react'
import { addDays, startOfDay } from '../domain/analytics'
import type { BabyEvent } from '../domain/events'
import { sleepSessions, summarizeDay } from '../domain/summary'
import { formatMinutes } from '../domain/summary'
import { Badge, Segmented } from './controls'
import { BottleIcon, BreastIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, DiaperIcon, MoonIcon, NoteIcon, PillIcon, SunIcon, TrashIcon } from './icons'
import { clock, eventDetail, eventHeading } from './kinds'
import { duration, type Unit } from './time'

type Filter = 'all' | 'sleep' | 'feed' | 'diaper' | 'med'

type Item =
  | { type: 'sleep'; at: number; start: number; end?: number; events: BabyEvent[] }
  | { type: 'event'; at: number; event: BabyEvent }
  | { type: 'wake'; at: number; minutes: number }

interface Props {
  events: BabyEvent[]
  now: number
  unit: Unit
  baby: string
  onDelete: (events: BabyEvent[]) => void
}

export function Timeline({ events, now, unit, baby, onDelete }: Props) {
  const today = startOfDay(now)
  const [day, setDay] = useState(today)
  const [filter, setFilter] = useState<Filter>('all')
  const next = addDays(day, 1)
  const to = Math.min(next, now)

  const summary = useMemo(() => summarizeDay(events, new Date(to)), [events, to])

  const items = useMemo(() => {
    const out: Item[] = []
    const sessions = sleepSessions(events)
    const sleepEvents = events.filter((e) => e.kind === 'sleep')
    let prevEnd: number | undefined
    for (const s of sessions) {
      const end = s.end
      const touches = s.start < next && (end ?? now) >= day
      if (touches) {
        const own = sleepEvents.filter((e) => e.at === s.start || e.at === end)
        out.push({ type: 'sleep', at: s.start, start: s.start, end, events: own })
        if (prevEnd !== undefined && s.start - prevEnd < 8 * 3_600_000 && prevEnd >= day) {
          out.push({ type: 'wake', at: prevEnd + 1, minutes: Math.round((s.start - prevEnd) / 60_000) })
        }
      }
      prevEnd = end
    }
    for (const e of events) {
      if (e.kind === 'sleep' || e.at < day || e.at >= next) continue
      out.push({ type: 'event', at: e.at, event: e })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [events, day, next, now])

  const shown = items.filter((i) => {
    if (filter === 'all') return true
    if (filter === 'sleep') return i.type === 'sleep' || i.type === 'wake'
    return i.type === 'event' && i.event.kind === filter
  })

  const map = useMemo(() => {
    const span = next - day
    const pct = (ms: number) => ((Math.min(Math.max(ms, day), next) - day) / span) * 100
    return {
      sleeps: sleepSessions(events)
        .filter((s) => s.start < next && (s.end ?? now) > day)
        .map((s) => ({ left: pct(s.start), width: pct(s.end ?? now) - pct(s.start), key: s.start })),
      feeds: events.filter((e) => e.kind === 'feed' && e.at >= day && e.at < next).map((e) => ({ left: pct(e.at), key: e.id })),
      diapers: events.filter((e) => e.kind === 'diaper' && e.at >= day && e.at < next).map((e) => ({ left: pct(e.at), key: e.id })),
      now: day === today ? pct(now) : undefined,
    }
  }, [events, day, next, now, today])

  const label =
    day === today
      ? `Today, ${new Date(day).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
      : new Date(day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const lastSession = sleepSessions(events).at(-1)
  const asleep = lastSession !== undefined && lastSession.end === undefined

  return (
    <div className="stack">
      <div className="date-nav">
        <button type="button" className="icon-button" aria-label="Previous day" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeftIcon />
        </button>
        <span className="date-pill">{label}</span>
        <button type="button" className="icon-button" aria-label="Next day" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
          <ChevronRightIcon />
        </button>
      </div>

      <div className="stat-row">
        <div>
          <MoonIcon width={18} height={18} />
          <span>
            <small>Sleep</small>
            <b>{formatMinutes(summary.sleepMinutes)}</b>
          </span>
        </div>
        <div>
          <SunIcon width={18} height={18} />
          <span>
            <small>Naps</small>
            <b>{summary.naps}</b>
          </span>
        </div>
        <div>
          <DiaperIcon width={18} height={18} />
          <span>
            <small>Diapers</small>
            <b>{summary.changes}</b>
          </span>
        </div>
        <div>
          <BottleIcon width={18} height={18} />
          <span>
            <small>Feeds</small>
            <b>{summary.feeds}</b>
          </span>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>
            <ClockIcon width={20} height={20} /> 24-Hour Map
          </h3>
          {day === today && <Badge tone="sage">Live • {asleep ? 'Asleep' : 'Awake'}</Badge>}
        </div>
        <div className="map-scale">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>12a</span>
        </div>
        <div className="day-map" aria-label="Sleep, feeds and diapers across the day">
          {map.sleeps.map((s) => (
            <span key={s.key} className="seg sleep" style={{ left: `${s.left}%`, width: `${Math.max(0.8, s.width)}%` }} />
          ))}
          {map.feeds.map((f) => (
            <span key={f.key} className="tick feed" style={{ left: `${f.left}%` }} />
          ))}
          {map.diapers.map((d) => (
            <span key={d.key} className="tick diaper" style={{ left: `${d.left}%` }} />
          ))}
          {map.now !== undefined && <span className="now" style={{ left: `${map.now}%` }} />}
        </div>
        <div className="legend">
          <span className="key sleep">Sleep</span>
          <span className="key feed">Feed</span>
          <span className="key diaper">Diaper</span>
          <span className="key awake">Awake</span>
        </div>
      </section>

      <div className="tab-scroll">
        <Segmented
          variant="pills"
          value={filter}
          onChange={setFilter}
          label="Filter"
          options={[
            { value: 'all', label: 'All Events' },
            { value: 'sleep', label: <><MoonIcon width={16} height={16} /> Sleep</> },
            { value: 'feed', label: <><BottleIcon width={16} height={16} /> Feeds</> },
            { value: 'diaper', label: <><DiaperIcon width={16} height={16} /> Diapers</> },
            { value: 'med', label: <><PillIcon width={16} height={16} /> Meds</> },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <p className="empty">Nothing logged {day === today ? 'yet today' : 'this day'}. Tap Log or tell Calendaby what happened.</p>
      ) : (
        <ol className="thread">
          {shown.map((i) => {
            if (i.type === 'wake') {
              return (
                <li key={`w${i.at}`} className="thread-chip">
                  <span className="thread-dot small" />
                  <span className="wake-chip">
                    <ClockIcon width={14} height={14} /> Wake window: {formatMinutes(i.minutes)}
                  </span>
                </li>
              )
            }
            if (i.type === 'sleep') {
              const end = i.end
              const night = new Date(i.start).getHours() >= 19 || new Date(i.start).getHours() < 5
              return (
                <li key={`s${i.start}`} className="thread-item">
                  <span className="thread-dot sleep">
                    <MoonIcon width={18} height={18} />
                  </span>
                  <div className="card event">
                    <div className="event-head">
                      <h4>
                        {night ? 'Night Sleep' : 'Nap'} {end !== undefined ? <Badge tone="lilac">{duration(end - i.start)}</Badge> : <Badge tone="sage">Sleeping</Badge>}
                      </h4>
                      <time>{clock(i.start)}</time>
                    </div>
                    <p>{end !== undefined ? `Woke at ${clock(end)}` : `${baby} has been asleep for ${duration(now - i.start)}`}</p>
                    {i.events.find((e) => e.note)?.note && <p className="event-note">{i.events.find((e) => e.note)?.note}</p>}
                    <DeleteButton label="Delete this sleep" onClick={() => onDelete(i.events)} />
                  </div>
                </li>
              )
            }
            const e = i.event
            return (
              <li key={e.id} className="thread-item">
                <span className={`thread-dot ${e.kind}`}>{kindIcon(e)}</span>
                <div className="card event">
                  <div className="event-head">
                    <h4>{eventHeading(e)}</h4>
                    <time>{clock(e.at)}</time>
                  </div>
                  {e.kind !== 'note' && <p>{eventDetail(e, unit)}</p>}
                  {e.kind === 'feed' && e.method === 'breast' && (e.leftMin || e.rightMin) ? (
                    <div className="split">
                      <span>
                        <b>L</b> Left side {e.leftMin ?? 0} mins
                      </span>
                      <span>
                        <b>R</b> Right side {e.rightMin ?? 0} mins
                      </span>
                    </div>
                  ) : null}
                  {e.note && <p className={e.kind === 'note' ? '' : 'event-note'}>{e.note}</p>}
                  <p className="by">by {e.loggedBy}</p>
                  <DeleteButton label={`Delete ${eventHeading(e)}`} onClick={() => onDelete([e])} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function kindIcon(e: BabyEvent) {
  switch (e.kind) {
    case 'feed':
      return e.method === 'breast' ? <BreastIcon width={18} height={18} /> : <BottleIcon width={18} height={18} />
    case 'diaper':
      return <DiaperIcon width={18} height={18} />
    case 'med':
      return <PillIcon width={18} height={18} />
    default:
      return <NoteIcon width={18} height={18} />
  }
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="icon-button delete" aria-label={label} onClick={onClick}>
      <TrashIcon width={16} height={16} />
    </button>
  )
}
