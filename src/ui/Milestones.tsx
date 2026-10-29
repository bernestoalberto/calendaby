import { areaLabel, bandLabel, milestoneView, type Band, type MilestoneState } from '../domain/milestones'
import { ACT_EARLY, MILESTONE_AREAS, MILESTONE_SOURCE, type Milestone } from '../knowledge/milestones'
import type { BabyEvent } from '../domain/events'
import { Badge } from './controls'

interface Props {
  baby: string
  milestones: Milestone[]
  events: BabyEvent[]
  /** Whole months old, or undefined without a birth date. */
  months: number | undefined
  onMark: (milestone: Milestone, state: MilestoneState) => void
}

const CHOICES: { state: MilestoneState; label: string }[] = [
  { state: 'yes', label: 'Yes' },
  { state: 'not_yet', label: 'Not yet' },
  { state: 'unsure', label: 'Not sure' },
]

function Checklist({ band, onMark }: Readonly<{ band: Band; onMark: Props['onMark'] }>) {
  return (
    <>
      {MILESTONE_AREAS.map((area) => {
        const items = band.items.filter((i) => i.milestone.area === area.id)
        return (
          <div key={area.id} className="stack">
            <h4>{area.label}</h4>
            <ul className="plain">
              {items.map(({ milestone, state }) => (
                <li key={milestone.id} className="stack">
                  <span>{milestone.text}</span>
                  <div className="chips" role="group" aria-label={`Answer for: ${milestone.text}`}>
                    {CHOICES.map((c) => (
                      <button
                        key={c.state}
                        type="button"
                        aria-pressed={state === c.state}
                        className={state === c.state ? 'chip on' : 'chip'}
                        onClick={() => state !== c.state && onMark(milestone, c.state)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </>
  )
}

export function Milestones({ baby, milestones, events, months, onMark }: Readonly<Props>) {
  const view = milestoneView(milestones, events, months)

  return (
    <section className="card" aria-labelledby="milestones-title">
      <div className="card-head">
        <h3 id="milestones-title">Milestones</h3>
        {view.current && (
          <Badge tone="sage">
            {view.current.yes} of {view.current.items.length} by {bandLabel(view.current.ageMonths)}
          </Badge>
        )}
      </div>

      {months === undefined ? (
        <p className="empty">Add {baby}&apos;s birth date in Profile to see the milestones for their age.</p>
      ) : (
        <>
          <p className="muted small">
            Things most children do by each age. Every child grows at their own pace, so this is a guide for talking with your doctor, not a test.
          </p>

          {view.current ? (
            <>
              <h4>By {bandLabel(view.current.ageMonths)}</h4>
              <Checklist band={view.current} onMark={onMark} />
            </>
          ) : (
            <p className="muted">The first checklist is for 2 months. Here is what is coming up.</p>
          )}

          {view.raise.length > 0 && (
            <div className="stack" role="note">
              <h4>Worth raising at the next checkup</h4>
              <ul className="plain">
                {view.raise.map(({ milestone }) => (
                  <li key={milestone.id}>
                    {milestone.text} <span className="muted small">({areaLabel(milestone.area)}, by {bandLabel(milestone.ageMonths)})</span>
                  </li>
                ))}
              </ul>
              <p className="muted small">{ACT_EARLY}</p>
            </div>
          )}

          {view.next && (
            <details>
              <summary>Coming up: by {bandLabel(view.next.ageMonths)}</summary>
              <ul className="plain">
                {view.next.items.map(({ milestone }) => (
                  <li key={milestone.id}>{milestone.text}</li>
                ))}
              </ul>
            </details>
          )}

          {view.earlier.map((band) => (
            <details key={band.ageMonths}>
              <summary>
                Earlier: by {bandLabel(band.ageMonths)} ({band.yes} of {band.items.length})
              </summary>
              <Checklist band={band} onMark={onMark} />
            </details>
          ))}
        </>
      )}

      <p className="muted small">
        Source:{' '}
        <a href={MILESTONE_SOURCE.url} target="_blank" rel="noreferrer">
          {MILESTONE_SOURCE.org}, {MILESTONE_SOURCE.title}
        </a>
        .
      </p>
    </section>
  )
}
