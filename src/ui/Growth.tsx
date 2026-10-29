import { useMemo } from 'react'
import type { BabyEvent } from '../domain/events'
import { bodyUnits, formatMeasure, latest, MEASURES, series, type Measure, type MeasurePoint } from '../domain/growth'
import { Badge } from './controls'
import { PencilIcon, RulerIcon } from './icons'
import type { Unit } from './time'

interface Props {
  baby: string
  events: BabyEvent[]
  unit: Unit
  onAdd: () => void
  onEdit: (events: BabyEvent[]) => void
}

const day = (ms: number) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' })

/** A line through every reading, scaled to its own range; two points are the least that make a line. */
function Line({ points, label }: Readonly<{ points: MeasurePoint[]; label: string }>) {
  if (points.length < 2) return null
  const [t0, t1] = [points[0].at, points[points.length - 1].at]
  const values = points.map((p) => p.value)
  const [lo, hi] = [Math.min(...values), Math.max(...values)]
  const x = (at: number) => 10 + ((at - t0) / (t1 - t0 || 1)) * 280
  const y = (v: number) => 60 - ((v - lo) / (hi - lo || 1)) * 50
  return (
    <svg className="line" viewBox="0 0 300 70" role="img" aria-label={label}>
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points.map((p) => `${x(p.at)},${y(p.value)}`).join(' ')} />
      {points.map((p) => (
        <circle key={p.at} cx={x(p.at)} cy={y(p.value)} r="3" fill="var(--accent)" />
      ))}
    </svg>
  )
}

export function Growth({ baby, events, unit, onAdd, onEdit }: Readonly<Props>) {
  const units = bodyUnits(unit)
  const measures = useMemo(() => events.filter((e) => e.kind === 'measure').sort((a, b) => b.at - a.at), [events])
  const byMeasure = useMemo(() => MEASURES.map((m) => ({ ...m, points: series(events, m.id) })), [events])

  return (
    <section className="card" aria-labelledby="growth-title">
      <div className="card-head">
        <h3 id="growth-title">
          <span className="round-icon sage small">
            <RulerIcon />
          </span>
          Growth
        </h3>
        <button type="button" className="chip-button" onClick={onAdd}>
          Add measurement
        </button>
      </div>

      {measures.length === 0 ? (
        <p className="empty">
          No measurements yet. Add {baby}&apos;s weight, length or head size, or say &ldquo;weighed 6.2 kg&rdquo; in the Say it box.
        </p>
      ) : (
        <>
          {byMeasure.map(({ id, label, points }) => {
            const last = latest(points)
            if (!last) return null
            return (
              <div key={id} className="stack">
                <div className="card-head">
                  <b>{label}</b>
                  <span>
                    {formatMeasure(id, last.value, units)} <span className="muted small">{day(last.at)}</span>
                  </span>
                </div>
                {last.change !== undefined && last.days !== undefined && (
                  <Badge tone="sage">{changeText(id, last.change, last.days, units)}</Badge>
                )}
                <Line points={points} label={`${label} over time`} />
              </div>
            )
          })}
          <ul className="plain">
            {measures.slice(0, 5).map((e) => (
              <li key={e.id} className="card-head">
                <span>
                  {day(e.at)} · {summary(e, units)}
                </span>
                <button type="button" className="icon-button edit" aria-label={`Edit measurement from ${day(e.at)}`} onClick={() => onEdit([e])}>
                  <PencilIcon width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="muted small">Measurements are kept as you enter them. Ask your pediatrician what they mean for {baby}.</p>
    </section>
  )
}

function changeText(m: Measure, change: number, days: number, units: ReturnType<typeof bodyUnits>): string {
  if (change === 0) return `No change in ${days} day${days === 1 ? '' : 's'}`
  const sign = change > 0 ? '+' : '−'
  return `${sign}${formatMeasure(m, Math.abs(change), units)} in ${days} day${days === 1 ? '' : 's'}`
}

function summary(e: BabyEvent, units: ReturnType<typeof bodyUnits>): string {
  if (e.kind !== 'measure') return ''
  return [
    e.weightG !== undefined && `Weight ${formatMeasure('weight', e.weightG, units)}`,
    e.lengthMm !== undefined && `Length ${formatMeasure('length', e.lengthMm, units)}`,
    e.headMm !== undefined && `Head ${formatMeasure('head', e.headMm, units)}`,
  ]
    .filter(Boolean)
    .join(', ')
}
