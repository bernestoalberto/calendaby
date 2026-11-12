import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { daysText, ROUTINE_STATES, routineProblem, startOn, routinesToday, weekdayName, type Routine, type RoutineDraft, type RoutineState } from '../domain/routines'
import { Badge } from './controls'
import { PencilIcon, PlusIcon } from './icons'
import { clock } from './kinds'
import { localDay } from './time'

interface Props {
  baby: string
  now: number
  routines: Routine[]
  /** Steps ticked off today, by routine id. */
  done: Record<string, number[]>
  onToggleStep: (id: string, step: number, done: boolean) => void
  /** Resolves to an error message, or undefined once saved. */
  onSave: (draft: RoutineDraft, id?: string) => Promise<string | undefined>
  onRemove: (id: string) => void
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]
const STATE_LABEL: Record<RoutineState, string> = { active: 'Active', paused: 'Paused', done: 'Done' }

const startDay = (date: string) => new Date(`${date}T00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

const clockOf = (time: string) => clock(startOn({ time }, 0))

export function Routines({ baby, now, routines, done, onToggleStep, onSave, onRemove }: Readonly<Props>) {
  const [editing, setEditing] = useState<{ id?: string; draft: RoutineDraft }>()
  const today = routinesToday(routines, now)
  const editId = editing?.id
  const empty = (): RoutineDraft => ({ name: '', date: localDay(now), time: '19:00', days: WEEK, steps: [], remind: false, state: 'active' })

  return (
    <div className="stack">
      <section className="card" aria-label="Today's routines">
        <div className="card-head">
          <h3>Today</h3>
        </div>
        {today.length === 0 ? (
          <p className="muted small">No routines set for today.</p>
        ) : (
          today.map(({ routine: r, at }) => {
            const ticked = done[r.id] ?? []
            return (
              <div key={r.id} className="routine-today">
                <h4>
                  {r.name} <span className="muted small">{clock(at)}</span>
                </h4>
                {r.steps.length > 0 && (
                  <>
                    <p className="muted small">
                      {ticked.length} of {r.steps.length} steps done
                    </p>
                    <ul className="routine-steps">
                      {r.steps.map((s, i) => (
                        <li key={`${i}-${s}`}>
                          <label>
                            <input type="checkbox" checked={ticked.includes(i)} onChange={(e) => onToggleStep(r.id, i, e.target.checked)} />
                            <span>{s}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )
          })
        )}
      </section>

      {editing ? (
        <RoutineForm
          key={editing.id ?? 'new'}
          initial={editing.draft}
          now={now}
          isNew={editing.id === undefined}
          onCancel={() => setEditing(undefined)}
          onSave={async (draft) => {
            const error = await onSave(draft, editing.id)
            if (!error) setEditing(undefined)
            return error
          }}
          onRemove={editId === undefined ? undefined : () => {
            onRemove(editId)
            setEditing(undefined)
          }}
        />
      ) : (
        <section className="card" aria-label="All routines">
          <div className="card-head">
            <h3>{baby}&rsquo;s routines</h3>
            <button type="button" className="link" onClick={() => setEditing({ draft: empty() })}>
              <PlusIcon width={16} height={16} /> Add a routine
            </button>
          </div>
          {routines.length === 0 ? (
            <p className="muted small">No routines yet. Add one for bedtime, the morning or anything you do every day.</p>
          ) : (
            <ul className="routine-list">
              {routines.map((r) => (
                <li key={r.id}>
                  <div>
                    <b>{r.name}</b> <span className="muted small">{clockOf(r.time)}</span>{' '}
                    <Badge tone={r.state === 'active' ? 'sage' : r.state === 'paused' ? 'oat' : 'lilac'}>{STATE_LABEL[r.state]}</Badge>
                    <div className="muted small">
                      {r.date > localDay(now) ? `Starts ${startDay(r.date)} · ` : ''}
                      {daysText(r.days)}
                      {r.steps.length > 0 ? ` · ${r.steps.length} ${r.steps.length === 1 ? 'step' : 'steps'}` : ''}
                      {r.remind ? ' · Reminder on' : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-button edit"
                    aria-label={`Edit ${r.name}`}
                    onClick={() => setEditing({ id: r.id, draft: { name: r.name, date: r.date, time: r.time, days: r.days, steps: r.steps, remind: r.remind, state: r.state } })}
                  >
                    <PencilIcon width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

function RoutineForm(p: {
  initial: RoutineDraft
  now: number
  isNew: boolean
  onCancel: () => void
  onSave: (draft: RoutineDraft) => Promise<string | undefined>
  onRemove?: () => void
}) {
  const id = useId()
  const [name, setName] = useState(p.initial.name)
  // One date-and-time field; a routine without a start date (the starter one) shows today.
  const [start, setStart] = useState(`${p.initial.date || localDay(p.now)}T${p.initial.time}`)
  const [state, setState] = useState<RoutineState>(p.initial.state)
  const [days, setDays] = useState(p.initial.days)
  const [steps, setSteps] = useState(p.initial.steps.join('\n'))
  const [remind, setRemind] = useState(p.initial.remind)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => nameRef.current?.focus(), [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const draft: RoutineDraft = {
      name: name.trim(),
      date: start.slice(0, 10),
      time: start.slice(11, 16),
      state,
      days: WEEK.filter((d) => days.includes(d)),
      steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
      remind,
    }
    const problem = routineProblem(draft)
    if (problem) return setError(problem)
    setSaving(true)
    setError(await p.onSave(draft))
    setSaving(false)
  }

  return (
    <form className="card routine-form" aria-label={p.isNew ? 'New routine' : 'Edit routine'} onSubmit={(e) => void submit(e)}>
      <div className="card-head">
        <h3>{p.isNew ? 'New routine' : 'Edit routine'}</h3>
      </div>
      <label className="field">
        <span className="field-label">Name</span>
        <input ref={nameRef} name="name" value={name} maxLength={40} required enterKeyHint="next" onChange={(e) => setName(e.target.value)} placeholder="Bedtime" />
      </label>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-start-input`}>
          Starts
        </label>
        <input
          id={`${id}-start-input`}
          name="start"
          type="datetime-local"
          value={start}
          required
          aria-describedby={`${id}-start`}
          onChange={(e) => setStart(e.target.value)}
        />
        <span id={`${id}-start`} className="muted small">
          The first day and the time it starts each day.
        </span>
      </div>
      <fieldset className="field">
        <legend className="field-label">State</legend>
        <div className="chips">
          {ROUTINE_STATES.map((s) => (
            <label key={s} className={s === state ? 'chip on' : 'chip'}>
              <input type="radio" className="visually-hidden" name="state" value={s} checked={s === state} onChange={() => setState(s)} />
              {STATE_LABEL[s]}
            </label>
          ))}
        </div>
        <span className="muted small">Only active routines show on Today and send reminders.</span>
      </fieldset>
      <fieldset className="field">
        <legend className="field-label">Days</legend>
        <div className="chips">
          {WEEK.map((d) => {
            const on = days.includes(d)
            return (
              <label key={d} className={on ? 'chip on' : 'chip'}>
                <input
                  type="checkbox"
                  className="visually-hidden"
                  name="days"
                  value={d}
                  checked={on}
                  onChange={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                />
                {weekdayName(d)}
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-steps-input`}>
          Steps
        </label>
        <textarea
          id={`${id}-steps-input`}
          name="steps"
          rows={5}
          value={steps}
          aria-describedby={`${id}-steps`}
          onChange={(e) => setSteps(e.target.value)}
          placeholder={'Bath\nPajamas\nBook\nLights out'}
        />
        <span id={`${id}-steps`} className="muted small">
          One step per line, in order. Up to 12.
        </span>
      </div>
      <label className="feature-row">
        <span>
          <b>Remind me</b>
          <span className="muted small">A notification when the routine starts</span>
        </span>
        <input type="checkbox" role="switch" name="remind" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
      </label>
      <p className="field-error" role="alert">
        {error}
      </p>
      <div className="routine-actions">
        <button type="submit" className="pill primary" disabled={saving}>
          {p.isNew ? 'Add routine' : 'Save changes'}
        </button>
        <button type="button" className="pill quiet" onClick={p.onCancel}>
          Cancel
        </button>
        {p.onRemove && (
          <button type="button" className="pill danger" onClick={p.onRemove}>
            Delete
          </button>
        )}
      </div>
    </form>
  )
}
