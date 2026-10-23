import type { Appointment } from '../domain/appointments'
import type { AgendaItem } from '../domain/calendar'
import { Badge } from './controls'
import { CheckIcon, CloseIcon } from './icons'

interface Props {
  signedIn: boolean
  now: number
  agenda: AgendaItem[]
  pending: Appointment[]
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
            </div>
            <Badge tone={i.source === 'appointment' ? 'lilac' : 'sage'}>{i.source === 'appointment' ? 'Doctor' : 'Calendar'}</Badge>
          </div>
        ))}
      </section>
    </div>
  )
}
