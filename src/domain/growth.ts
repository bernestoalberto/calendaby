import type { BabyEvent } from './events.js'

export type MeasureEvent = Extract<BabyEvent, { kind: 'measure' }>
export type Measure = 'weight' | 'length' | 'head'

const LB_G = 453.592
const IN_MM = 25.4

/** Weight is stored in grams, length and head in millimetres; the unit setting only changes what is shown. */
export type BodyUnits = { weight: 'kg' | 'lb'; size: 'cm' | 'in' }

/** The `unit` setting is ounces or millilitres for bottles; the same choice picks pounds/inches or kg/cm. */
export const bodyUnits = (bottleUnit: 'oz' | 'ml'): BodyUnits =>
  bottleUnit === 'oz' ? { weight: 'lb', size: 'in' } : { weight: 'kg', size: 'cm' }

export function measureValue(e: MeasureEvent, m: Measure): number | undefined {
  return m === 'weight' ? e.weightG : m === 'length' ? e.lengthMm : e.headMm
}

/** "6.2 kg", "8 lb 11 oz", "62 cm", "24.4 in". */
export function formatMeasure(m: Measure, value: number, units: BodyUnits): string {
  if (m === 'weight') {
    if (units.weight === 'kg') return `${(value / 1000).toFixed(2).replace(/0$/, '')} kg`
    const totalOz = Math.round((value / LB_G) * 16)
    return `${Math.floor(totalOz / 16)} lb ${totalOz % 16} oz`
  }
  return units.size === 'cm' ? `${(value / 10).toFixed(1).replace(/\.0$/, '')} cm` : `${(value / IN_MM).toFixed(1)} in`
}

/** What a parent types in a box, in the shown unit, as the stored number. NaN-safe: undefined when empty or not a number. */
export function parseMeasureInput(m: Measure, text: string, units: BodyUnits): number | undefined {
  const n = Number(text.trim().replace(',', '.'))
  if (text.trim() === '' || !Number.isFinite(n) || n <= 0) return undefined
  if (m === 'weight') return Math.round(units.weight === 'kg' ? n * 1000 : n * LB_G)
  return Math.round(units.size === 'cm' ? n * 10 : n * IN_MM)
}

/** The box text for a stored value, in the shown unit (pounds as a decimal; the label says lb). */
export function measureInputText(m: Measure, value: number | undefined, units: BodyUnits): string {
  if (value === undefined) return ''
  if (m === 'weight') return units.weight === 'kg' ? String(value / 1000) : (value / LB_G).toFixed(2)
  return units.size === 'cm' ? String(value / 10) : (value / IN_MM).toFixed(1)
}

export interface MeasurePoint {
  at: number
  value: number
}

/** Every reading of one measurement, oldest first. */
export function series(events: BabyEvent[], m: Measure): MeasurePoint[] {
  return events
    .flatMap((e) => {
      const value = e.kind === 'measure' ? measureValue(e, m) : undefined
      return value === undefined ? [] : [{ at: e.at, value }]
    })
    .sort((a, b) => a.at - b.at)
}

export interface Latest {
  at: number
  value: number
  /** Change since the reading before it, when there is one. */
  change?: number
  days?: number
}

export function latest(points: MeasurePoint[]): Latest | undefined {
  const last = points.at(-1)
  if (!last) return undefined
  const before = points.at(-2)
  return before
    ? { ...last, change: last.value - before.value, days: Math.max(1, Math.round((last.at - before.at) / 86_400_000)) }
    : last
}

export const MEASURES: { id: Measure; label: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'length', label: 'Length' },
  { id: 'head', label: 'Head' },
]

/** What a parent has typed in the three boxes, in the shown unit. */
export type MeasureText = Record<Measure, string>

export const EMPTY_MEASURE_TEXT: MeasureText = { weight: '', length: '', head: '' }

/** The stored numbers for what was typed; a box left empty or not a number stays out. */
export function measureDraft(text: MeasureText, units: BodyUnits): { weightG?: number; lengthMm?: number; headMm?: number } {
  return {
    weightG: parseMeasureInput('weight', text.weight, units),
    lengthMm: parseMeasureInput('length', text.length, units),
    headMm: parseMeasureInput('head', text.head, units),
  }
}

export const hasMeasure = (text: MeasureText, units: BodyUnits): boolean => Object.values(measureDraft(text, units)).some((v) => v !== undefined)
