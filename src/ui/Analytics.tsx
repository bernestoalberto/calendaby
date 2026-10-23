import { useMemo, useState } from 'react'
import { dailyStats, napForecast } from '../domain/analytics'
import type { BabyEvent } from '../domain/events'
import { deduceInsights, feedForecast, sleepForecast } from '../domain/predictions'
import { formatMinutes } from '../domain/summary'
import { Badge, Segmented } from './controls'
import { BottleIcon, CheckIcon, MoonIcon, ShareIcon, SparkIcon } from './icons'
import { formatAmount, type Unit } from './time'

interface Props {
  events: BabyEvent[]
  now: number
  unit: Unit
  baby: string
  onShare: (text: string) => void
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function Analytics({ events, now, unit, baby, onShare }: Props) {
  const [range, setRange] = useState<'7' | '30'>('7')
  const days = useMemo(() => dailyStats(events, Number(range), now), [events, range, now])
  const forecast = useMemo(() => napForecast(events, now), [events, now])
  const sleep = useMemo(() => sleepForecast(events, now), [events, now])
  const feed = useMemo(() => feedForecast(events, now), [events, now])
  const insights = useMemo(() => deduceInsights(events, baby, now), [events, baby, now])
  const logged = days.filter((d) => d.nightMin + d.dayMin + d.feeds + d.wet + d.dirty > 0)
  const nightAvg = avg(logged.map((d) => d.nightMin))
  const dayAvg = avg(logged.map((d) => d.dayMin))
  const napsAvg = avg(logged.map((d) => d.naps))
  const bottleAvg = avg(logged.map((d) => d.bottleMl))
  const wetAvg = avg(logged.map((d) => d.wet))
  const nursing = days.reduce((a, d) => a + d.nursing, 0)
  const bottles = days.reduce((a, d) => a + d.bottles, 0)
  const maxSleep = Math.max(60, ...days.map((d) => d.nightMin + d.dayMin))
  const maxWet = Math.max(1, ...days.map((d) => d.wet))
  const chartDays = range === '7' ? days : days.filter((_, i) => i % 3 === (days.length - 1) % 3)
  const x = (i: number) => 10 + (chartDays.length > 1 ? (i * 280) / (chartDays.length - 1) : 140)
  const y = (wet: number) => 60 - (wet / maxWet) * 50

  function summaryText(): string {
    return [
      `${baby}: ${range}-day summary from Calendaby`,
      `Sleep: ${formatMinutes(Math.round(nightAvg))} at night, ${formatMinutes(Math.round(dayAvg))} in the day, ${napsAvg.toFixed(1)} naps a day`,
      forecast ? `Average wake window: ${formatMinutes(forecast.wakeWindowMin)}` : '',
      `Feeds: ${nursing} nursing, ${bottles} bottles${bottleAvg ? `, ${formatAmount(bottleAvg, unit)} bottle a day` : ''}`,
      `Wet diapers: ${wetAvg.toFixed(1)} a day`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (logged.length === 0) {
    return (
      <div className="stack">
        <h2 className="page-title">Trends</h2>
        <p className="empty">Trends appear after a day or two of logging.</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h2 className="page-title">Trends</h2>
          <p className="muted">{baby} • {logged.length} days logged</p>
        </div>
      </div>

      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: 'Past 7 Days' },
          { value: '30', label: 'Past 30 Days' },
        ]}
      />

      {(forecast || feed || sleep.usualNapMin) && (
        <section className="card insight">
          <div className="card-head">
            <h3>
              <SparkIcon width={20} height={20} /> Deduced Rhythm &amp; Advice
            </h3>
            <Badge tone="lilac">Past records</Badge>
          </div>
          {forecast && (
            <p>
              {baby} stays awake about <b>{formatMinutes(forecast.wakeWindowMin)}</b> between sleeps
              {sleep.usualNapMin ? <> and naps for about <b>{formatMinutes(sleep.usualNapMin)}</b></> : null}.
            </p>
          )}
          {feed && (
            <p>
              Daytime feeds happen every <b>{formatMinutes(feed.intervalMin)}</b>
              {feed.usualBottleMl ? <> (typical bottle: <b>{formatAmount(feed.usualBottleMl, unit)}</b>)</> : null}.
            </p>
          )}
          {insights[0] && <p className="muted">{insights[0].advice}</p>}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3>
            <span className="round-icon lilac small">
              <MoonIcon />
            </span>
            Sleep Rhythm
          </h3>
        </div>
        <div className="kpis">
          <div>
            <small>Night Avg</small>
            <b>{formatMinutes(Math.round(nightAvg))}</b>
          </div>
          <div>
            <small>Day Avg</small>
            <b>{formatMinutes(Math.round(dayAvg))}</b>
            <small>{napsAvg.toFixed(1)} naps/day</small>
          </div>
          <div>
            <small>Wake Window</small>
            <b>{forecast ? formatMinutes(forecast.wakeWindowMin) : '—'}</b>
          </div>
        </div>
        <div className="legend">
          <span className="key sleep">Night</span>
          <span className="key day">Day</span>
        </div>
        <div className="bars" role="img" aria-label="Daily sleep, night and day">
          {chartDays.map((d) => (
            <div key={d.day} className="bar-col">
              <div className="bar" style={{ height: `${((d.nightMin + d.dayMin) / maxSleep) * 100}%` }}>
                <span className="bar-day" style={{ flexGrow: d.dayMin }} />
                <span className="bar-night" style={{ flexGrow: d.nightMin }} />
              </div>
              <span className="bar-label">
                {range === '7' ? new Date(d.day).toLocaleDateString([], { weekday: 'narrow' }) : new Date(d.day).getDate()}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>
            <span className="round-icon sage small">
              <BottleIcon />
            </span>
            Intake &amp; Diapers
          </h3>
          {bottleAvg > 0 && <Badge tone="sage">{formatAmount(bottleAvg, unit)} / day</Badge>}
        </div>
        <div className="composition">
          <div className="comp-head">
            <span>Feed composition</span>
            <b>
              {nursing} nursing + {bottles} bottles
            </b>
          </div>
          <div className="comp-bar">
            <span className="nursing" style={{ flexGrow: nursing || 0.0001 }} />
            <span className="bottle" style={{ flexGrow: bottles || 0.0001 }} />
          </div>
        </div>
        <div className="comp-head">
          <span>Wet diapers per day</span>
          <b className="sage-text">{wetAvg.toFixed(1)} / day</b>
        </div>
        <svg className="line" viewBox="0 0 300 70" role="img" aria-label="Wet diapers per day">
          <polyline points={chartDays.map((d, i) => `${x(i)},${y(d.wet)}`).join(' ')} fill="none" />
          {chartDays.map((d, i) => (
            <circle key={d.day} cx={x(i)} cy={y(d.wet)} r="4" />
          ))}
        </svg>
        <div className="line-labels">
          {chartDays.map((d) => (
            <span key={d.day}>{d.wet}</span>
          ))}
        </div>
      </section>

      <section className="card share">
        <span className="round-icon lilac big">
          <CheckIcon />
        </span>
        <h3>Pediatrician-ready summary</h3>
        <p className="muted">Sleep, feeds and diapers for the last {range} days, as text you can send to your pediatrician or partner.</p>
        <button type="button" className="pill primary wide tall" onClick={() => onShare(summaryText())}>
          <ShareIcon width={20} height={20} /> Share Summary
        </button>
      </section>

      <p className="cheer">You're doing a great job tracking {baby}'s rhythm.</p>
    </div>
  )
}
