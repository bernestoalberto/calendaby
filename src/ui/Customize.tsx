import { useState } from 'react'
import { OPTION_LISTS, parseSwatch, type ListId } from '../domain/options'

interface Props {
  lists: Record<ListId, string[]>
  sleepGoalHours: number
  onSleepGoal: (hours: number) => void
  /** Resolves to a message when the value is refused, otherwise nothing. */
  onAdd: (list: ListId, value: string) => Promise<string | undefined>
  onRemove: (list: ListId, value: string) => void
  onRestore: (list: ListId) => void
}

function ListEditor({ id, label, hint, lists, onAdd, onRemove, onRestore }: Readonly<Omit<Props, 'sleepGoalHours' | 'onSleepGoal'> & { id: ListId; label: string; hint: string }>) {
  const [draft, setDraft] = useState('')
  const [problem, setProblem] = useState<string>()

  async function add() {
    const refused = await onAdd(id, draft)
    setProblem(refused)
    if (!refused) setDraft('')
  }

  return (
    <details className="section-style">
      <summary>
        <span>
          <b>{label}</b>
          <small className="muted">{hint}</small>
        </span>
        <small className="muted">{lists[id].length}</small>
      </summary>
      <div className="chips">
        {lists[id].map((value) => (
          <button key={value} type="button" className="chip" aria-label={`Remove ${value}`} onClick={() => onRemove(id, value)}>
            {id === 'swatches' ? parseSwatch(value).name : value} ×
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field-label">Add</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          placeholder={id === 'swatches' ? 'Name|#rrggbb' : undefined}
        />
      </label>
      {problem && <p className="warning">{problem}</p>}
      <div className="card-foot">
        <button type="button" className="link" disabled={!draft.trim()} onClick={() => void add()}>
          Add
        </button>
        <button type="button" className="link" onClick={() => onRestore(id)}>
          Restore the originals
        </button>
      </div>
    </details>
  )
}

/** Everything a parent can reshape without a new app version: the quick-pick lists and the sleep goal. */
export function Customize(p: Readonly<Props>) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>Quick picks &amp; goals</h3>
      </div>
      <p className="muted">Change the choices you see when logging. They stay on this phone.</p>
      <label className="field">
        <span className="field-label">Daily sleep goal (hours)</span>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          max={24}
          defaultValue={p.sleepGoalHours}
          onBlur={(e) => {
            const hours = Number(e.target.value)
            if (hours >= 1 && hours <= 24) p.onSleepGoal(hours)
          }}
        />
      </label>
      {OPTION_LISTS.map((l) => (
        <ListEditor key={l.id} id={l.id} label={l.label} hint={l.hint} lists={p.lists} onAdd={p.onAdd} onRemove={p.onRemove} onRestore={p.onRestore} />
      ))}
    </section>
  )
}
