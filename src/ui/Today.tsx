import type { FormEvent, ReactNode } from 'react'
import type { NapForecast } from '../domain/analytics'
import type { BabyEvent } from '../domain/events'
import type { DaySummary, SleepSession } from '../domain/summary'
import { formatMinutes } from '../domain/summary'
import type { HandoffBrief } from '../agents/handoff'
import { Badge } from './controls'
import {
  BottleIcon,
  BreastIcon,
  BulbIcon,
  CheckIcon,
  ChevronRightIcon,
  DiaperIcon,
  MicIcon,
  MoonIcon,
  NoteIcon,
  PillIcon,
  SendIcon,
  ShareIcon,
  SparkIcon,
  SunIcon,
} from './icons'
import { clock, eventDetail } from './kinds'
import { ago, duration, formatAmount, type Unit } from './time'

export type QuickKind = 'feed' | 'diaper' | 'med' | 'note'

const SLEEP_GOAL_MIN = 14 * 60

interface Props {
  baby: string
  now: number
  unit: Unit
  current?: SleepSession
  asleep: boolean
  lastDone?: SleepSession
  napsToday: number
  day: DaySummary
  forecast?: NapForecast
  lastFeed?: BabyEvent
  lastDiaper?: BabyEvent
  lastMed?: BabyEvent
  brief: HandoffBrief
  text: string
  onText: (t: string) => void
  onSubmitText: () => void
  speech: { supported: boolean; listening: boolean; start: () => void; stop: () => void }
  onToggleSleep: () => void
  onQuick: (k: QuickKind) => void
  onFullStats: () => void
  onShareHandoff: () => void
  onAsk: () => void
}

export function Today(p: Props) {
  const awakeFor = p.lastDone?.end !== undefined ? p.now - p.lastDone.end : undefined

  return (
    <div className="stack">
      <div className={p.asleep ? 'status-pill asleep' : 'status-pill'}>
        <span className="dot" />
        <span>
          {p.baby} is currently <b>{p.asleep ? 'Asleep' : 'Awake'}</b>
          {p.asleep && p.current ? ` • ${duration(p.now - p.current.start)}` : awakeFor !== undefined ? ` • ${duration(awakeFor)}` : ''}
        </span>
        {p.asleep ? <MoonIcon width={18} height={18} /> : <SunIcon width={18} height={18} />}
      </div>

      <NapCard {...p} />

      <section>
        <div className="section-head">
          <h3>Quick Action</h3>
          <span>One-tap entry</span>
        </div>
        <div className="quick-row">
          <button type="button" className={p.asleep ? 'quick sleep on' : 'quick sleep'} onClick={p.onToggleSleep}>
            <span>{p.asleep ? <SunIcon /> : <MoonIcon />}</span>
            {p.asleep ? 'Wake' : 'Sleep'}
          </button>
          <button type="button" className="quick diaper" onClick={() => p.onQuick('diaper')}>
            <span>
              <DiaperIcon />
            </span>
            Diaper
          </button>
          <button type="button" className="quick feed" onClick={() => p.onQuick('feed')}>
            <span>
              <BottleIcon />
            </span>
            Feed
          </button>
          <button type="button" className="quick med" onClick={() => p.onQuick('med')}>
            <span>
              <PillIcon />
            </span>
            Meds
          </button>
          <button type="button" className="quick note" onClick={() => p.onQuick('note')}>
            <span>
              <NoteIcon />
            </span>
            Note
          </button>
        </div>
      </section>

      <form
        className="composer"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          p.onSubmitText()
        }}
      >
        <SparkIcon width={20} height={20} className="composer-spark" />
        <input value={p.text} onChange={(e) => p.onText(e.target.value)} placeholder="Say it: fed 4oz, she's down" aria-label="Log in your own words" />
        {p.speech.supported && (
          <button
            type="button"
            className={p.speech.listening ? 'icon-button listening' : 'icon-button'}
            aria-label={p.speech.listening ? 'Stop listening' : 'Speak'}
            onClick={p.speech.listening ? p.speech.stop : p.speech.start}
          >
            <MicIcon />
          </button>
        )}
        <button type="submit" className="icon-button send" aria-label="Log it" disabled={!p.text.trim()}>
          <SendIcon width={20} height={20} />
        </button>
      </form>

      <div className="last-grid">
        <LastCard
          icon={<MoonIcon />}
          tone="lilac"
          badge={p.asleep ? <Badge tone="sage">Sleeping</Badge> : p.napsToday ? <Badge tone="lilac">Nap {p.napsToday}</Badge> : null}
          label="Last Sleep"
          value={
            p.asleep && p.current
              ? duration(p.now - p.current.start)
              : p.lastDone?.end !== undefined
                ? duration(p.lastDone.end - p.lastDone.start)
                : '—'
          }
          detail={
            p.asleep && p.current
              ? `Since ${clock(p.current.start)}`
              : p.lastDone?.end !== undefined
                ? `${clock(p.lastDone.start)} – ${clock(p.lastDone.end)}`
                : 'No sleep logged'
          }
        />
        <LastCard
          icon={p.lastFeed?.kind === 'feed' && p.lastFeed.method === 'breast' ? <BreastIcon /> : <BottleIcon />}
          tone="oat"
          badge={p.lastFeed ? <Badge>{ago(p.now - p.lastFeed.at)}</Badge> : null}
          label="Last Feed"
          value={
            p.lastFeed?.kind === 'feed'
              ? p.lastFeed.amountMl
                ? formatAmount(p.lastFeed.amountMl, p.unit)
                : p.lastFeed.durationMin
                  ? `${p.lastFeed.durationMin}m`
                  : p.lastFeed.method === 'breast'
                    ? 'Nursing'
                    : 'Solids'
              : '—'
          }
          detail={p.lastFeed ? `${clock(p.lastFeed.at)} • ${eventDetail(p.lastFeed, p.unit).split(' · ')[0]}` : 'No feed logged'}
        />
        <LastCard
          icon={<DiaperIcon />}
          tone="sage"
          badge={p.lastDiaper ? <Badge tone="sage">{ago(p.now - p.lastDiaper.at)}</Badge> : null}
          label="Last Diaper"
          value={p.lastDiaper ? eventDetail(p.lastDiaper, p.unit) : '—'}
          detail={p.lastDiaper ? `${clock(p.lastDiaper.at)}${p.lastDiaper.note ? ` • ${p.lastDiaper.note}` : ''}` : 'No change logged'}
        />
        <LastCard
          icon={<PillIcon />}
          tone="lilac"
          badge={p.lastMed ? <Badge>{ago(p.now - p.lastMed.at)}</Badge> : null}
          label="Last Medicine"
          value={p.lastMed?.kind === 'med' ? p.lastMed.name.replace(/\b\w/g, (c) => c.toUpperCase()) : '—'}
          detail={p.lastMed ? `${clock(p.lastMed.at)} • ${eventDetail(p.lastMed, p.unit)}` : 'None given'}
        />
      </div>

      <section className="card totals">
        <div className="card-head">
          <h3>
            <span className="ring-glyph" aria-hidden="true" />
            Today's Totals
          </h3>
          <button type="button" className="link" onClick={p.onFullStats}>
            Full stats <ChevronRightIcon width={16} height={16} />
          </button>
        </div>
        <div className="goal-row">
          <span>
            <MoonIcon width={18} height={18} /> Sleep
          </span>
          <span>
            <b>{formatMinutes(p.day.sleepMinutes)}</b> / {SLEEP_GOAL_MIN / 60}h goal
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={SLEEP_GOAL_MIN} aria-valuenow={p.day.sleepMinutes}>
          <span style={{ width: `${Math.min(100, (p.day.sleepMinutes / SLEEP_GOAL_MIN) * 100)}%` }} />
        </div>
        <div className="mini-tiles">
          <div>
            <span className="mini-icon">
              <BottleIcon />
            </span>
            <span>
              <small>Feeds</small>
              <b>{p.day.feedMl ? formatAmount(p.day.feedMl, p.unit) : p.day.feeds}</b>
              {p.day.feedMl ? <small> ({p.day.feeds}x)</small> : null}
            </span>
          </div>
          <div>
            <span className="mini-icon">
              <DiaperIcon />
            </span>
            <span>
              <small>Diapers</small>
              <b>{p.day.changes === 1 ? '1 change' : `${p.day.changes} changes`}</b>
            </span>
          </div>
        </div>
      </section>

      <section className="card tip">
        <span className="tip-icon">
          <BulbIcon />
        </span>
        <div>
          <p className="eyebrow">Handoff</p>
          <h3>{p.brief.headline}</h3>
          <ul>
            {p.brief.lines.slice(0, 3).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div className="tip-actions">
            <button type="button" className="link strong" onClick={p.onShareHandoff}>
              <ShareIcon width={16} height={16} /> Share handoff
            </button>
            <button type="button" className="link muted" onClick={p.onAsk}>
              Ask the agent
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function LastCard(props: {
  icon: ReactNode
  tone: 'lilac' | 'sage' | 'oat'
  badge: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="card last">
      <div className="last-top">
        <span className={`round-icon ${props.tone}`}>{props.icon}</span>
        {props.badge}
      </div>
      <span className="last-label">{props.label}</span>
      <strong>{props.value}</strong>
      <span className="last-detail">{props.detail}</span>
    </div>
  )
}

function NapCard(p: Props) {
  const f = p.forecast
  if (p.asleep && p.current) {
    return (
      <section className="card nap">
        <div className="nap-head">
          <h3>
            <MoonIcon width={20} height={20} /> Sleeping
          </h3>
          <Badge tone="sage">Resting</Badge>
        </div>
        <p className="nap-label">Asleep since {clock(p.current.start)}</p>
        <p className="nap-time">{duration(p.now - p.current.start)}</p>
        {f && <p className="nap-meta">Usual wake window: {formatMinutes(f.wakeWindowMin)}</p>}
      </section>
    )
  }
  if (!f || f.nextNapAt === undefined || f.awakeSince === undefined) {
    return (
      <section className="card nap">
        <div className="nap-head">
          <h3>
            <SparkIcon width={20} height={20} /> Next Nap
          </h3>
          <Badge tone="lilac">Learning</Badge>
        </div>
        <p className="nap-meta">
          Log a few naps and Calendaby will learn {p.baby}'s wake window and predict the next one. It uses only your own logs.
        </p>
      </section>
    )
  }
  const left = Math.round((f.nextNapAt - p.now) / 60_000)
  if (left < -60) {
    // Long past the estimate usually means a sleep was not logged, not a baby awake for hours.
    return (
      <section className="card nap">
        <div className="nap-head">
          <h3>
            <SparkIcon width={20} height={20} /> Next Nap
          </h3>
          <Badge>Check logs</Badge>
        </div>
        <p className="nap-label">Last sleep ended</p>
        <p className="nap-time">{clock(f.awakeSince)}</p>
        <p className="nap-meta">
          That's {duration(p.now - f.awakeSince)} ago, well past {p.baby}'s usual {formatMinutes(f.wakeWindowMin)} wake window. Log any sleep since then
          and the estimate will update.
        </p>
      </section>
    )
  }
  const progress = Math.min(1, Math.max(0, (p.now - f.awakeSince) / (f.wakeWindowMin * 60_000)))
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <section className="card nap">
      <div className="nap-head">
        <h3>
          <SparkIcon width={20} height={20} /> Next Nap
        </h3>
        <Badge tone={left < 0 ? 'oat' : 'lilac'}>{left < 0 ? 'Due now' : left <= 15 ? 'Soon' : 'On track'}</Badge>
      </div>
      <div className="nap-body">
        <div>
          <p className="nap-label">Predicted nap</p>
          <p className="nap-time">{clock(f.nextNapAt)}</p>
          <p className="nap-meta">Wake window: {formatMinutes(f.wakeWindowMin)}</p>
          <p className="nap-meta">Awake since: {clock(f.awakeSince)}</p>
        </div>
        <svg className="nap-ring" viewBox="0 0 108 108" role="img" aria-label={`${Math.abs(left)} minutes ${left < 0 ? 'over' : 'left'}`}>
          <circle cx="54" cy="54" r={r} className="ring-track" />
          <circle cx="54" cy="54" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} />
          <text x="54" y="54" className="ring-num">
            {Math.abs(left)}
          </text>
          <text x="54" y="72" className="ring-label">
            {left < 0 ? 'MINS OVER' : 'MINS LEFT'}
          </text>
        </svg>
      </div>
      <p className="nap-foot">
        <CheckIcon width={16} height={16} /> Based on {p.baby}'s own naps over the last 3 days
      </p>
    </section>
  )
}
