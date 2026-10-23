import { useState } from 'react'
import { DraftEventSchema, type BabyEvent, type DraftEvent } from '../domain/events'
import { Sheet } from './controls'
import { eventHeading } from './kinds'
import { fromLocalInput, OZ, toLocalInput, type Unit } from './time'

export interface EventEdit {
  id: string
  draft: DraftEvent
}

interface Props {
  /** One entry, or the start and end of a sleep. */
  events: BabyEvent[]
  unit: Unit
  onSave: (edits: EventEdit[]) => Promise<string | undefined>
  onClose: () => void
}

const toDisplay = (ml: number | undefined, unit: Unit) =>
  ml === undefined ? '' : String(unit === 'oz' ? Math.round((ml / OZ) * 100) / 100 : Math.round(ml))
const toMl = (value: string, unit: Unit) => (value.trim() === '' ? undefined : Number(value) * (unit === 'oz' ? OZ : 1))
const toInt = (value: string) => (value.trim() === '' ? undefined : Number(value))
const toDraft = ({ id: _id, loggedBy: _by, ...rest }: BabyEvent) => rest as DraftEvent

export function EditSheet({ events, unit, onSave, onClose }: Readonly<Props>) {
  const [first] = events
  const [times, setTimes] = useState(() => events.map((e) => toLocalInput(e.at)))
  const [note, setNote] = useState(first.note ?? '')
  const [amount, setAmount] = useState(first.kind === 'feed' ? toDisplay(first.amountMl, unit) : '')
  const [method, setMethod] = useState(first.kind === 'feed' ? first.method : 'bottle')
  const [side, setSide] = useState(first.kind === 'feed' ? (first.side ?? '') : '')
  const [milk, setMilk] = useState(first.kind === 'feed' ? (first.milk ?? '') : '')
  const [leftMin, setLeftMin] = useState(first.kind === 'feed' ? String(first.leftMin ?? '') : '')
  const [rightMin, setRightMin] = useState(first.kind === 'feed' ? String(first.rightMin ?? '') : '')
  const [contents, setContents] = useState(first.kind === 'diaper' ? first.contents : 'wet')
  const [name, setName] = useState(first.kind === 'med' ? first.name : '')
  const [dose, setDose] = useState(first.kind === 'med' ? String(first.doseMl ?? '') : '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function build(): EventEdit[] | string {
    const edits: EventEdit[] = []
    for (const [i, e] of events.entries()) {
      const at = fromLocalInput(times[i])
      if (at === undefined) return 'Enter a valid time'
      let draft: Record<string, unknown> = { ...toDraft(e), at }
      if (i === 0) {
        draft = { ...draft, note: note.trim() || undefined }
        if (e.kind === 'feed') {
          draft = {
            ...draft,
            method,
            amountMl: method === 'solids' ? undefined : toMl(amount, unit),
            side: method === 'breast' && side ? side : undefined,
            milk: method === 'bottle' && milk ? milk : undefined,
            leftMin: method === 'breast' ? toInt(leftMin) : undefined,
            rightMin: method === 'breast' ? toInt(rightMin) : undefined,
          }
        }
        if (e.kind === 'diaper') draft = { ...draft, contents }
        if (e.kind === 'med') draft = { ...draft, name: name.trim(), doseMl: toMl(dose, 'ml') }
      }
      const parsed = DraftEventSchema.safeParse(draft)
      if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Check the values'
      edits.push({ id: e.id, draft: parsed.data })
    }
    return edits
  }

  async function save() {
    const edits = build()
    if (typeof edits === 'string') return setError(edits)
    setSaving(true)
    const problem = await onSave(edits)
    setSaving(false)
    if (problem) setError(problem)
  }

  const labels = first.kind === 'sleep' ? ['Fell asleep', 'Woke up'] : ['Time']
  return (
    <Sheet
      title={`Edit ${events.length > 1 || first.kind === 'sleep' ? 'sleep' : eventHeading(first).toLowerCase()}`}
      onClose={onClose}
      footer={
        <button type="button" className="pill primary wide tall" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      }
    >
      <div className="stack">
        {events.map((e, i) => (
          <label key={e.id} className="field">
            <span className="field-label">{labels[events.length > 1 && e.kind === 'sleep' ? (e.phase === 'start' ? 0 : 1) : 0]}</span>
            <input type="datetime-local" value={times[i]} onChange={(ev) => setTimes(times.map((t, j) => (j === i ? ev.target.value : t)))} />
          </label>
        ))}

        {first.kind === 'feed' && (
          <>
            <label className="field">
              <span className="field-label">Type</span>
              <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                <option value="bottle">Bottle</option>
                <option value="breast">Breast</option>
                <option value="solids">Solids</option>
              </select>
            </label>
            {method !== 'solids' && (
              <label className="field">
                <span className="field-label">Amount ({unit})</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            )}
            {method === 'bottle' && (
              <label className="field">
                <span className="field-label">Milk</span>
                <select value={milk} onChange={(e) => setMilk(e.target.value)}>
                  <option value="">Not set</option>
                  <option value="breastmilk">Breastmilk</option>
                  <option value="formula">Formula</option>
                </select>
              </label>
            )}
            {method === 'breast' && (
              <>
                <label className="field">
                  <span className="field-label">Side</span>
                  <select value={side} onChange={(e) => setSide(e.target.value)}>
                    <option value="">Not set</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Left minutes</span>
                  <input inputMode="numeric" value={leftMin} onChange={(e) => setLeftMin(e.target.value)} />
                </label>
                <label className="field">
                  <span className="field-label">Right minutes</span>
                  <input inputMode="numeric" value={rightMin} onChange={(e) => setRightMin(e.target.value)} />
                </label>
              </>
            )}
          </>
        )}

        {first.kind === 'diaper' && (
          <label className="field">
            <span className="field-label">Contents</span>
            <select value={contents} onChange={(e) => setContents(e.target.value as typeof contents)}>
              <option value="wet">Wet</option>
              <option value="dirty">Dirty</option>
              <option value="both">Both</option>
            </select>
          </label>
        )}

        {first.kind === 'med' && (
          <>
            <label className="field">
              <span className="field-label">Medicine</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Dose (ml)</span>
              <input inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} />
            </label>
          </>
        )}

        <label className="field">
          <span className="field-label">{first.kind === 'note' ? 'Note' : 'Note (optional)'}</span>
          <textarea value={note} rows={3} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="warning">{error}</p>}
      </div>
    </Sheet>
  )
}
