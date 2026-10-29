import type { BabyEvent } from './events.js'
import type { GrowthRef, Sex } from './growthReference.js'

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

const DAY_MS = 86_400_000
const MONTH_DAYS = 30.4375
/** The WHO standards used here stop at 24 months. */
export const MAX_REFERENCE_MONTHS = 24

/** Age in months (with a fraction) on `at`, from a YYYY-MM-DD birth date; undefined when missing or after `at`. */
export function ageInMonths(birth: string | undefined, at: number): number | undefined {
  if (!birth) return undefined
  const days = (at - new Date(`${birth}T00:00`).getTime()) / DAY_MS
  return Number.isNaN(days) || days < 0 ? undefined : days / MONTH_DAYS
}

/** Standard normal cumulative distribution (Abramowitz and Stegun 7.1.26, error under 2e-7). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2))
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const erf = 1 - poly * Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

/**
 * Where a reading falls among babies of the same age and sex, from 0 to 100, using the WHO growth standards (LMS method).
 * Undefined when the sex or age is unknown, the baby is past 24 months, or the reference has no rows for it.
 */
export function percentile(
  rows: GrowthRef[],
  sex: Sex | undefined,
  measure: Measure,
  stored: number,
  months: number | undefined,
): number | undefined {
  if (!sex || months === undefined || months > MAX_REFERENCE_MONTHS) return undefined
  const at = (month: number) => rows.find((r) => r[0] === sex && r[1] === measure && r[2] === month)
  const lo = at(Math.floor(months))
  const hi = at(Math.min(MAX_REFERENCE_MONTHS, Math.floor(months) + 1))
  if (!lo || !hi) return undefined
  const f = months - lo[2]
  const mix = (a: number, b: number) => a + (b - a) * f
  const [l, m, s] = [mix(lo[3], hi[3]), mix(lo[4], hi[4]), mix(lo[5], hi[5])]
  const x = measure === 'weight' ? stored / 1000 : stored / 10
  const z = l === 0 ? Math.log(x / m) / s : ((x / m) ** l - 1) / (l * s)
  return normalCdf(z) * 100
}

/** "50th percentile", "under the 1st percentile", "over the 99th percentile". */
export function percentileText(p: number): string {
  const n = Math.round(p)
  const ordinal = (k: number) => `${k}${[11, 12, 13].includes(k % 100) ? 'th' : (['th', 'st', 'nd', 'rd'][k % 10] ?? 'th')}`
  if (n < 1) return 'under the 1st percentile'
  if (n > 99) return 'over the 99th percentile'
  return `${ordinal(n)} percentile`
}

export const SEX_CHOICES: { value: Sex; label: string }[] = [
  { value: 'girl', label: 'Girl' },
  { value: 'boy', label: 'Boy' },
]
