import { MEASURES, type BodyUnits, type Measure, type MeasureText } from '../domain/growth'

const unitOf = (m: Measure, units: BodyUnits) => (m === 'weight' ? units.weight : units.size)
const HINT: Record<Measure, Record<string, string>> = {
  weight: { kg: '6.2', lb: '13.7' },
  length: { cm: '62', in: '24.4' },
  head: { cm: '41', in: '16.1' },
}

/** Weight, length and head boxes in the unit the parent chose. Fill in what was measured; leave the rest empty. */
export function MeasureFields({ text, units, onChange }: Readonly<{ text: MeasureText; units: BodyUnits; onChange: (t: MeasureText) => void }>) {
  return (
    <>
      {MEASURES.map((m) => (
        <label key={m.id} className="field">
          <span className="field-label">
            {m.label} ({unitOf(m.id, units)})
          </span>
          <input
            inputMode="decimal"
            value={text[m.id]}
            placeholder={HINT[m.id][unitOf(m.id, units)]}
            onChange={(e) => onChange({ ...text, [m.id]: e.target.value })}
          />
        </label>
      ))}
    </>
  )
}
