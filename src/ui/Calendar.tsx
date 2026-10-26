import type { Appointment } from '../domain/appointments'
import type { AgendaItem } from '../domain/calendar'
import type { VisitPrep } from '../domain/visitPrep'
import { Badge } from './controls'
import { CheckIcon, CloseIcon } from './icons'

interface Props {
  signedIn: boolean
  now: number
  agenda: AgendaItem[]
  pending: Appointment[]
  /** What to expect and the plan for each appointment, by appointment id. */
  prep: Record<string, VisitPrep>
  busy: boolean
  error?: string
  onSync: () => void
  onDecide: (id: string, status: 'confirmed' | 'dismissed') => void
}

function when(item: { startsAt?: number; allDay?: boolean }, now: number): string {
  if (item.startsAt === undefined) return 'No time found'
  const d = new Date(item.startsAt)
  const today = new Date(now).toDateString() === d.toDateString()
  const day = today ? 'Today' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return item.allDay ? day : `${day}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function Prep({ info }: Readonly<{ info: VisitPrep | undefined }>) {
  if (!info || (info.expect.length === 0 && info.plan.length === 0)) return null
  return (
    <details className="prep">
      <summary>What to expect</summary>
      {info.expect.map((l) => (
        <p key={l.text}>
          {l.text}{' '}
          <small className="muted">
            <a href={l.source.url} target="_blank" rel="noreferrer">
              {l.source.org}
            </a>
          </small>
        </p>
      ))}
      {info.plan.map((t) => (
        <p key={t} className="muted">
          {t}
        </p>
      ))}
    </details>
  )
}

export function Calendar(p: Readonly<Props>) {
  if (!p.signedIn) {
    return (
      <div className="stack">
        <h2 className="page-title">Calendar</h2>
        <p className="muted">Sign in with Google to see doctor appointments and your calendar here.</p>
      </div>
    )
  }
  return (
    <div className="stack">
      <div className="card-head">
        <h2 className="page-title">Calendar</h2>
        <button type="button" className="pill quiet" disabled={p.busy} onClick={p.onSync}>
          {p.busy ? 'Syncing…' : 'Sync Gmail'}
        </button>
      </div>
      {p.error && <p className="warning">{p.error}</p>}

      {p.pending.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3>Found in your email</h3>
          </div>
          {p.pending.map((a) => (
            <div key={a.id} className="card-foot">
              <div>
                <b>{a.title}</b>
                <p className="muted">
                  {when(a, p.now)}
                  {a.provider ? ` • ${a.provider}` : ''}
                </p>
                <Prep info={p.prep[a.id]} />
              </div>
              <div>
                {a.startsAt !== undefined && (
                  <button type="button" className="icon-button" aria-label={`Confirm ${a.title}`} onClick={() => p.onDecide(a.id, 'confirmed')}>
                    <CheckIcon />
                  </button>
                )}
                <button type="button" className="icon-button" aria-label={`Dismiss ${a.title}`} onClick={() => p.onDecide(a.id, 'dismissed')}>
                  <CloseIcon />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3>Coming up</h3>
        </div>
        {p.agenda.length === 0 && <p className="muted">Nothing in the next two weeks.</p>}
        {p.agenda.map((i) => (
          <div key={i.id} className="card-foot">
            <div>
              <b>{i.title}</b>
              <p className="muted">{when(i, p.now)}</p>
              {i.clash && <p className="warning">{i.clash}</p>}
              {i.source === 'appointment' && <Prep info={p.prep[i.id]} />}
            </div>
            <Badge tone={i.source === 'appointment' ? 'lilac' : 'sage'}>{i.source === 'appointment' ? 'Doctor' : 'Calendar'}</Badge>
          </div>
        ))}
      </section>
    </div>
  )
}
