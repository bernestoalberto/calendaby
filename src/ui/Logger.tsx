import { useState } from 'react'
import type { DraftEvent } from '../domain/events'
import { elapsed, lastSide, nursingDraft, switchSide, toggle, EMPTY_TIMER, type NursingTimer, type Side } from '../domain/nursing'
import type { SleepSession } from '../domain/summary'
import { Badge, Segmented, TagChips } from './controls'
import {
  BottleIcon,
  BreastIcon,
  CheckIcon,
  ClockIcon,
  DiaperIcon,
  MinusIcon,
  MoonIcon,
  NoteIcon,
  PauseIcon,
  PillIcon,
  PlayIcon,
  PlusIcon,
  StopIcon,
  SwapIcon,
} from './icons'
import { clock } from './kinds'
import { duration, fromLocalInput, OZ, stopwatch, toLocalInput, type Unit } from './time'

// Kept out of render so the component stays pure.
const nowMs = () => Date.now()

export type LogTab = 'feed' | 'sleep' | 'diaper' | 'med' | 'note'

const FEED_TAGS = ['Fussy', 'Spit-up', 'Gassy', 'Burped', 'Hiccups']
const DIAPER_TAGS = ['Normal', 'Rash', 'Barrier cream', 'Blowout']
const MEDS = ['Vitamin D', 'Tylenol', 'Ibuprofen', 'Gripe water', 'Gas drops']
const PRESETS = { oz: [2, 4, 5, 6, 8], ml: [60, 90, 120, 150, 180] }
const STEP = { oz: 0.5, ml: 10 }
const MAX = { oz: 12, ml: 360 }

interface Props {
  baby: string
  now: number
  unit: Unit
  tab: LogTab
  onTab: (t: LogTab) => void
  onUnit: (u: Unit) => void
  asleep: boolean
  current?: SleepSession
  awakeSince?: number
  timer: NursingTimer
  onTimer: (t: NursingTimer) => void
  onSave: (drafts: DraftEvent[]) => void
  onToggleSleep: () => void
}

function withNote(tags: string[], note: string): { note?: string } {
  const text = [tags.join(', '), note.trim()].filter(Boolean).join('. ')
  return text ? { note: text } : {}
}

export function Logger(p: Props) {
  const [adjust, setAdjust] = useState(false)
  const [time, setTime] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [milk, setMilk] = useState<'breastmilk' | 'formula'>('breastmilk')
  const [amount, setAmount] = useState<number | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [contents, setContents] = useState<'wet' | 'dirty' | 'both' | null>(null)
  const [med, setMed] = useState(MEDS[0])
  const [dose, setDose] = useState('')

  const nursing = nursingDraft(p.timer, p.now)
  const startMs = fromLocalInput(start)
  const endMs = fromLocalInput(end)
  const rangeOk = startMs !== undefined && endMs !== undefined && endMs > startMs && endMs <= p.now + 60_000

  function reset() {
    setTags([])
    setNote('')
    setAmount(null)
    setContents(null)
    setDose('')
    setStart('')
    setEnd('')
    setAdjust(false)
  }

  function switchTab(t: LogTab) {
    reset()
    p.onTab(t)
  }

  function save() {
    const at = (adjust && fromLocalInput(time)) || nowMs()
    const extra = withNote(tags, note)
    const drafts: DraftEvent[] = []
    if (p.tab === 'feed') {
      if (nursing) drafts.push({ ...nursing, ...extra })
      if (amount !== null) {
        const amountMl = Math.round(p.unit === 'oz' ? amount * OZ : amount)
        drafts.push({ kind: 'feed', at, method: 'bottle', milk, amountMl: amountMl > 0 ? amountMl : undefined, ...(nursing ? {} : extra) })
      }
      if (nursing) p.onTimer(EMPTY_TIMER)
    }
    if (p.tab === 'sleep' && rangeOk) {
      drafts.push({ kind: 'sleep', at: startMs, phase: 'start' }, { kind: 'sleep', at: endMs, phase: 'end', ...extra })
    }
    if (p.tab === 'diaper' && contents) drafts.push({ kind: 'diaper', at, contents, ...extra })
    if (p.tab === 'med') {
      const d = Number(dose)
      drafts.push({ kind: 'med', at, name: med.toLowerCase(), doseMl: d > 0 && d <= 50 ? d : undefined, ...withNote([], note) })
    }
    if (p.tab === 'note' && note.trim()) drafts.push({ kind: 'note', at, note: note.trim() })
    if (drafts.length) p.onSave(drafts)
    reset()
  }

  const canSave =
    (p.tab === 'feed' && (nursing !== undefined || amount !== null)) ||
    (p.tab === 'sleep' && rangeOk) ||
    (p.tab === 'diaper' && contents !== null) ||
    (p.tab === 'med' && med.trim() !== '') ||
    (p.tab === 'note' && note.trim() !== '')

  const saveLabel = { feed: 'Save Feed', sleep: 'Save Sleep', diaper: 'Save Diaper', med: 'Save Medicine', note: 'Save Note' }[p.tab]
  const awake = p.awakeSince !== undefined ? `Awake ${duration(p.now - p.awakeSince)}` : undefined

  return (
    <div className="stack logger">
      <div className="logger-head">
        <span className="round-icon lilac big">
          <MoonIcon />
        </span>
        <div>
          <h2>
            Quick Logger{' '}
            {p.asleep && p.current ? (
              <Badge tone="sage">Asleep {duration(p.now - p.current.start)}</Badge>
            ) : awake ? (
              <Badge tone="sage">{awake}</Badge>
            ) : null}
          </h2>
          <p>{p.baby}</p>
        </div>
      </div>

      <div className="tab-scroll">
        <Segmented
          variant="pills"
          label="What to log"
          value={p.tab}
          onChange={switchTab}
          options={[
            { value: 'feed', label: <><BottleIcon width={18} height={18} /> Nursing &amp; Bottle</> },
            { value: 'sleep', label: <><MoonIcon width={18} height={18} /> Sleep</> },
            { value: 'diaper', label: <><DiaperIcon width={18} height={18} /> Diaper</> },
            { value: 'med', label: <><PillIcon width={18} height={18} /> Meds &amp; Health</> },
            { value: 'note', label: <><NoteIcon width={18} height={18} /> Note</> },
          ]}
        />
      </div>

      {p.tab === 'feed' && (
        <>
          <section className="card">
            <div className="card-head">
              <h3>
                <span className="round-icon lilac small">
                  <BreastIcon />
                </span>
                Nursing Stopwatch
              </h3>
              <Badge tone="lilac">Total: {stopwatch(elapsed(p.timer, 'left', p.now) + elapsed(p.timer, 'right', p.now))}</Badge>
            </div>
            <div className="sides">
              {(['left', 'right'] as Side[]).map((side) => {
                const running = p.timer.running === side
                const last = lastSide(p.timer) === side
                return (
                  <div key={side} className={running ? 'side running' : 'side'}>
                    <span className="side-label">{side === 'left' ? 'LEFT BREAST' : 'RIGHT BREAST'}</span>
                    <span className="timer-num">{stopwatch(elapsed(p.timer, side, p.now))}</span>
                    <button type="button" className={running ? 'pill primary' : 'pill quiet'} onClick={() => p.onTimer(toggle(p.timer, side, nowMs()))}>
                      {running ? <PauseIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
                      {running ? 'Pause' : 'Start'}
                    </button>
                    <span className="side-note">{running ? 'Running' : last ? 'Last used side' : 'Ready'}</span>
                  </div>
                )
              })}
            </div>
            <div className="card-foot">
              <button type="button" className="chip-button" onClick={() => p.onTimer(switchSide(p.timer, nowMs()))}>
                <SwapIcon width={16} height={16} /> Switch Side
              </button>
              <button type="button" className="link muted" onClick={() => p.onTimer(EMPTY_TIMER)}>
                Reset Timers
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h3>
                <span className="round-icon sage small">
                  <BottleIcon />
                </span>
                Bottle Feed
              </h3>
              <Segmented
                variant="mini"
                value={milk}
                onChange={setMilk}
                options={[
                  { value: 'breastmilk', label: 'Breast Milk' },
                  { value: 'formula', label: 'Formula' },
                ]}
              />
            </div>
            <div className="stepper">
              <button type="button" aria-label="Less" onClick={() => setAmount((a) => Math.max(0, (a ?? PRESETS[p.unit][2]) - STEP[p.unit]))}>
                <MinusIcon />
              </button>
              <div>
                <span className="stepper-num">
                  {amount === null ? '–' : p.unit === 'oz' ? amount.toFixed(1) : amount}
                  <small>{p.unit === 'oz' ? 'oz' : 'mL'}</small>
                </span>
                <button type="button" className="unit-switch" onClick={() => {
                  const next = p.unit === 'oz' ? 'ml' : 'oz'
                  if (amount !== null) setAmount(next === 'oz' ? Math.round((amount / OZ) * 2) / 2 : Math.round((amount * OZ) / 5) * 5)
                  p.onUnit(next)
                }}>
                  {amount === null
                    ? `switch to ${p.unit === 'oz' ? 'mL' : 'oz'}`
                    : p.unit === 'oz'
                      ? `~${Math.round(amount * OZ)} ml`
                      : `~${(amount / OZ).toFixed(1)} oz`}
                </button>
              </div>
              <button type="button" aria-label="More" onClick={() => setAmount((a) => Math.min(MAX[p.unit], (a ?? PRESETS[p.unit][2]) + STEP[p.unit]))}>
                <PlusIcon />
              </button>
            </div>
            <div className="presets">
              {PRESETS[p.unit].map((v) => (
                <button key={v} type="button" aria-pressed={amount === v} onClick={() => setAmount(v)}>
                  {v}
                  {p.unit === 'oz' ? 'oz' : ''}
                </button>
              ))}
            </div>
          </section>

          <TagsCard title="Symptoms & Tags" options={FEED_TAGS} tags={tags} onTags={setTags} note={note} onNote={setNote} placeholder={`e.g. ${p.baby} burped twice, drifted off quickly…`} />
        </>
      )}

      {p.tab === 'sleep' && (
        <>
          <section className="card sleep-card">
            <p className="side-label">{p.asleep ? 'SLEEPING' : 'AWAKE'}</p>
            <span className="timer-num big">
              {p.asleep && p.current ? stopwatch(p.now - p.current.start) : p.awakeSince !== undefined ? stopwatch(p.now - p.awakeSince) : '00:00'}
            </span>
            <p className="muted">
              {p.asleep && p.current ? `${p.baby} fell asleep at ${clock(p.current.start)}` : p.awakeSince !== undefined ? `Up since ${clock(p.awakeSince)}` : `Start the timer when ${p.baby} falls asleep`}
            </p>
            <button type="button" className={p.asleep ? 'pill sage wide' : 'pill primary wide'} onClick={p.onToggleSleep}>
              {p.asleep ? <StopIcon width={20} height={20} /> : <PlayIcon width={20} height={20} />}
              {p.asleep ? 'Woke up' : 'Fell asleep'}
            </button>
          </section>
          <section className="card">
            <div className="card-head">
              <h3>
                <span className="round-icon lilac small">
                  <ClockIcon />
                </span>
                Add a past sleep
              </h3>
            </div>
            <label className="row-field">
              <span>Fell asleep</span>
              <input type="datetime-local" value={start} max={toLocalInput(p.now)} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="row-field">
              <span>Woke up</span>
              <input type="datetime-local" value={end} max={toLocalInput(p.now)} onChange={(e) => setEnd(e.target.value)} />
            </label>
            {start && end && !rangeOk && <p className="field-error">Wake-up has to be after falling asleep, and not in the future.</p>}
            {rangeOk && <p className="muted">{duration(endMs - startMs)} of sleep</p>}
          </section>
        </>
      )}

      {p.tab === 'diaper' && (
        <>
          <section className="card">
            <div className="card-head">
              <h3>
                <span className="round-icon sage small">
                  <DiaperIcon />
                </span>
                Diaper Change
              </h3>
            </div>
            <div className="choice-grid">
              {(['wet', 'dirty', 'both'] as const).map((c) => (
                <button key={c} type="button" aria-pressed={contents === c} onClick={() => setContents(c)}>
                  {c === 'both' ? 'Wet & Dirty' : c === 'wet' ? 'Wet' : 'Dirty'}
                </button>
              ))}
            </div>
          </section>
          <TagsCard title="Details" options={DIAPER_TAGS} tags={tags} onTags={setTags} note={note} onNote={setNote} placeholder="e.g. Mild redness, applied cream" />
        </>
      )}

      {p.tab === 'med' && (
        <section className="card">
          <div className="card-head">
            <h3>
              <span className="round-icon lilac small">
                <PillIcon />
              </span>
              Medicine
            </h3>
          </div>
          <div className="chips">
            {MEDS.map((m) => (
              <button key={m} type="button" aria-pressed={med === m} className={med === m ? 'chip on' : 'chip'} onClick={() => setMed(m)}>
                {m}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Name</span>
            <input value={med} onChange={(e) => setMed(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Dose in ml (optional)</span>
            <input inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="2.5" />
          </label>
          <label className="field">
            <span className="field-label">Optional note</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Temp 100.2°F before dose" />
          </label>
        </section>
      )}

      {p.tab === 'note' && (
        <section className="card">
          <label className="field">
            <span className="field-label">Note</span>
            <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rash on left cheek, extra fussy after lunch…" autoFocus />
          </label>
        </section>
      )}

      <div className="save-bar">
        {p.tab !== 'sleep' && (
          <div className="save-time">
            <span>
              <ClockIcon width={18} height={18} />
              {adjust ? (
                <input type="datetime-local" value={time} max={toLocalInput(p.now)} onChange={(e) => setTime(e.target.value)} aria-label="When" />
              ) : (
                <>Logged at {p.tab === 'feed' && nursing ? clock(nursing.at) : `${clock(p.now)} (Now)`}</>
              )}
            </span>
            <button
              type="button"
              className="link strong underline"
              onClick={() => {
                setTime(toLocalInput(p.now))
                setAdjust((a) => !a)
              }}
            >
              {adjust ? 'Use now' : 'Adjust Time'}
            </button>
          </div>
        )}
        <button type="button" className="pill primary wide tall" disabled={!canSave} onClick={save}>
          <CheckIcon width={20} height={20} /> {saveLabel}
        </button>
      </div>
    </div>
  )
}

function TagsCard(props: {
  title: string
  options: string[]
  tags: string[]
  onTags: (t: string[]) => void
  note: string
  onNote: (n: string) => void
  placeholder: string
}) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{props.title}</h3>
        <span className="muted small">Tap to toggle</span>
      </div>
      <TagChips options={props.options} value={props.tags} onChange={props.onTags} />
      <label className="field">
        <span className="field-label">Optional note</span>
        <textarea rows={2} value={props.note} onChange={(e) => props.onNote(e.target.value)} placeholder={props.placeholder} />
      </label>
    </section>
  )
}
