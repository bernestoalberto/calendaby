import type { BabyEvent } from '../domain/events'
import { vaccineView, type ListedMatch } from '../domain/vaccineRecord'
import type { VaccineType } from '../domain/vaccines'
import { PencilIcon } from './icons'

interface Props {
  baby: string
  events: BabyEvent[]
  types: VaccineType[]
  /** The baby's age in whole weeks, or undefined without a birth date. */
  ageWeeks: number | undefined
  onAdd: () => void
  onEdit: (events: BabyEvent[]) => void
}

const day = (ms: number) => new Date(ms).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })

function matchText(m: ListedMatch): string {
  if (m.doses === 0) return `${m.label}: not recorded yet`
  return `${m.label}: ${m.doses} ${m.doses === 1 ? 'dose' : 'doses'} recorded`
}

export function Vaccines({ baby, events, types, ageWeeks, onAdd, onEdit }: Readonly<Props>) {
  const view = vaccineView(events, types, ageWeeks)
  const byId = new Map(events.map((e) => [e.id, e]))

  return (
    <div className="stack">
      <section className="card" aria-label="Vaccination record">
        <div className="card-head">
          <h3>{baby}&rsquo;s vaccination record</h3>
          <button type="button" className="link" onClick={onAdd}>
            Add a vaccine
          </button>
        </div>
        {view.recorded.length === 0 ? (
          <p className="muted small">Nothing recorded yet. Add each vaccine as it is given, with the date.</p>
        ) : (
          <ul className="plain">
            {view.recorded.map((r) => {
              const detail = [r.dose ? `Dose ${r.dose}` : '', r.place ?? '', r.lot ? `Lot ${r.lot}` : '', r.note ?? ''].filter(Boolean).join(' · ')
              const entry = byId.get(r.id)
              return (
                <li key={r.id} className="row">
                  <div>
                    <b>{r.label}</b> <span className="muted small">{day(r.at)}</span>
                    {detail && <div className="muted small">{detail}</div>}
                  </div>
                  {entry && (
                    <button type="button" className="icon-button edit" aria-label={`Edit ${r.label} from ${day(r.at)}`} onClick={() => onEdit([entry])}>
                      <PencilIcon width={16} height={16} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card" aria-label="CDC schedule for this age">
        <div className="card-head">
          <h3>Listed for {baby}&rsquo;s age</h3>
        </div>
        {view.rows.length === 0 ? (
          <p className="muted small">Add the birth date in Profile to see what the CDC schedule lists for {baby}&rsquo;s age.</p>
        ) : (
          view.rows.map((row) => (
            <div key={row.label} className="stack">
              <h4>{row.label}</h4>
              {row.items.length === 0 ? (
                <p className="muted small">No vaccines are listed for this visit.</p>
              ) : (
                <ul className="plain">
                  {row.items.map((item) => (
                    <li key={item.text}>
                      {item.text}
                      {item.matches.length > 0 && <div className="muted small">{item.matches.map(matchText).join(' · ')}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
        <p className="muted small">
          {view.note} This list is a reference, not a record of what is due.
        </p>
        <p className="muted small">
          Sources:{' '}
          {view.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ', '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.org}: {s.title}
              </a>
            </span>
          ))}
        </p>
      </section>
    </div>
  )
}
