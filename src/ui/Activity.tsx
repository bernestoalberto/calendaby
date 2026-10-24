import { useMemo } from 'react'
import { activityLabel, type ActivityType } from '../domain/activities'
import { activityDays } from '../domain/activity'
import type { BabyEvent, DraftEvent } from '../domain/events'
import { formatMinutes } from '../domain/summary'
import { Badge } from './controls'
import { FaceIcon, PencilIcon } from './icons'
import { clock } from './kinds'

const QUICK_MINUTES = [3, 5, 10]
const RECENT = 8

interface Props {
  baby: string
  events: BabyEvent[]
  now: number
  types: ActivityType[]
  /** Daily tummy time goal in minutes; chosen by the parent, not medical advice. */
  goalMin: number
  onGoal: (minutes: number) => void
  onLog: (draft: DraftEvent) => void
  onEdit: (events: BabyEvent[]) => void
}

export function Activity({ baby, events, now, types, goalMin, onGoal, onLog, onEdit }: Readonly<Props>) {
  const days = useMemo(() => activityDays(events, 7, now), [events, now])
  const today = days[days.length - 1]
  const tummy = today.byType.tummy ?? 0
  const week = days.reduce((sum, d) => sum + d.totalMin, 0)
  const maxDay = Math.max(1, ...days.map((d) => d.totalMin))
  const recent = useMemo(() => events.filter((e) => e.kind === 'activity').slice(-RECENT).reverse(), [events])
  const typesToday = types.filter((t) => t.id in today.byType)

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h3>
            <span className="round-icon sage small">
              <FaceIcon />
            </span>
            Tummy time today
          </h3>
          {tummy >= goalMin && goalMin > 0 && <Badge tone="sage">Goal met</Badge>}
        </div>
        <div className="goal-row">
          <span>
            <b>{formatMinutes(tummy)}</b> / {goalMin} min goal
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={goalMin} aria-valuenow={Math.min(tummy, goalMin)}>
          <span style={{ width: `${Math.min(100, (tummy / Math.max(1, goalMin)) * 100)}%` }} />
        </div>
        <label className="row-field">
          <span>Daily goal (minutes)</span>
          <input
            inputMode="numeric"
            value={goalMin}
            aria-label="Daily tummy time goal in minutes"
            onChange={(e) => {
              const n = Math.round(Number(e.target.value))
              if (Number.isFinite(n) && n >= 0 && n <= 600) onGoal(n)
            }}
          />
        </label>
        <p className="muted small">Your own target. Ask your pediatrician what is right for {baby}'s age.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Log now</h3>
          <span className="muted small">One tap</span>
        </div>
        {types.map((t) => (
          <div key={t.id} className="row-field">
            <span>{t.label}</span>
            <span className="chips">
              {QUICK_MINUTES.map((m) => (
                <button key={m} type="button" className="chip" aria-label={`${t.label} ${m} minutes`} onClick={() => onLog({ kind: 'activity', at: Date.now(), type: t.id, durationMin: m })}>
                  {m}m
                </button>
              ))}
            </span>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>This week</h3>
          <Badge tone="lilac">{formatMinutes(week)} total</Badge>
        </div>
        <div className="bars" role="img" aria-label="Active minutes per day for the last 7 days">
          {days.map((d) => (
            <div key={d.day} className="bar-col">
              <div className="bar" style={{ height: `${(d.totalMin / maxDay) * 100}%` }}>
                <span className="bar-night" style={{ flexGrow: 1 }} />
              </div>
              <span className="bar-label">{new Date(d.day).toLocaleDateString([], { weekday: 'narrow' })}</span>
            </div>
          ))}
        </div>
        {typesToday.length > 0 && (
          <div className="kpis">
            {typesToday.map((t) => (
              <div key={t.id}>
                <small>{t.label}</small>
                <b>{formatMinutes(today.byType[t.id])}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Recent</h3>
        </div>
        {recent.length === 0 ? (
          <p className="muted">Nothing logged yet. Tap a time above, or say "tummy time 5 min".</p>
        ) : (
          recent.map((e) =>
            e.kind === 'activity' ? (
              <div key={e.id} className="row-field">
                <span>
                  {activityLabel(types, e.type)}
                  {e.durationMin ? ` · ${e.durationMin}m` : ''}
                </span>
                <span className="muted small">
                  {new Date(e.at).toLocaleDateString([], { weekday: 'short' })} {clock(e.at)}
                </span>
                <button type="button" className="icon-button edit" aria-label={`Edit ${activityLabel(types, e.type)}`} onClick={() => onEdit([e])}>
                  <PencilIcon width={16} height={16} />
                </button>
              </div>
            ) : null,
          )
        )}
      </section>
    </div>
  )
}
