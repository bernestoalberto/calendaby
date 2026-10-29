import { describe, expect, it } from 'vitest'
import { parseLog } from '../agents/capture'
import { DraftEventSchema, type BabyEvent } from './events'
import { bodyUnits, formatMeasure, latest, measureInputText, parseMeasureInput, series } from './growth'

const now = new Date('2026-10-29T14:00:00')
const measures = (text: string) => parseLog(text, now).drafts.filter((d) => d.kind === 'measure')

describe('typed measurements', () => {
  it('reads kilograms and centimetres into grams and millimetres', () => {
    expect(measures('weighed 6.2 kg')).toMatchObject([{ kind: 'measure', weightG: 6200 }])
    expect(measures('she is 62 cm long')).toMatchObject([{ lengthMm: 620 }])
    expect(measures('head 41 cm')).toMatchObject([{ headMm: 410 }])
  })

  it('reads pounds and ounces together', () => {
    expect(measures('weighed 8 lb 11 oz')).toMatchObject([{ weightG: 3941 }])
    expect(measures('9 pounds')).toMatchObject([{ weightG: 4082 }])
  })

  it('puts measurements said in separate clauses into one entry', () => {
    const found = measures('weighed 6.2 kg, 62 cm, head 41 cm')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ weightG: 6200, lengthMm: 620, headMm: 410 })
  })

  it('does not turn a bottle amount or a bare number into a measurement', () => {
    expect(measures('fed 4 oz')).toEqual([])
    expect(measures('weighed 6')).toEqual([])
    expect(parseLog('weighed 6', now).unsure).toEqual(['weighed 6'])
    expect(measures('slept 12 in a row')).toEqual([])
  })

  it('refuses an impossible value rather than storing it', () => {
    expect(measures('weighed 60 kg')).toEqual([])
    expect(parseLog('weighed 60 kg', now).unsure).toEqual(['weighed 60 kg'])
  })
})

describe('the measure event', () => {
  it('needs at least one value', () => {
    expect(DraftEventSchema.safeParse({ kind: 'measure', at: 1 }).success).toBe(false)
    expect(DraftEventSchema.safeParse({ kind: 'measure', at: 1, headMm: 410 }).success).toBe(true)
  })
})

describe('units', () => {
  it('shows pounds and inches or kilograms and centimetres, stored the same', () => {
    expect(formatMeasure('weight', 6200, bodyUnits('ml'))).toBe('6.2 kg')
    expect(formatMeasure('weight', 3941, bodyUnits('oz'))).toBe('8 lb 11 oz')
    expect(formatMeasure('length', 620, bodyUnits('ml'))).toBe('62 cm')
    expect(formatMeasure('length', 620, bodyUnits('oz'))).toBe('24.4 in')
  })

  it('reads a box in the shown unit and refuses blanks and zero', () => {
    expect(parseMeasureInput('weight', '6,2', bodyUnits('ml'))).toBe(6200)
    expect(parseMeasureInput('length', '24.4', bodyUnits('oz'))).toBe(620)
    expect(parseMeasureInput('head', '', bodyUnits('ml'))).toBeUndefined()
    expect(parseMeasureInput('head', '0', bodyUnits('ml'))).toBeUndefined()
    expect(measureInputText('length', 620, bodyUnits('ml'))).toBe('62')
  })
})

describe('readings over time', () => {
  const at = (day: number) => Date.UTC(2026, 9, day)
  const e = (day: number, weightG?: number): BabyEvent => ({ id: String(day), kind: 'measure', at: at(day), loggedBy: 'a', weightG })

  it('lists one measurement oldest first and skips entries without it', () => {
    expect(series([e(10, 6000), e(2, 5600), e(5)], 'weight').map((p) => p.value)).toEqual([5600, 6000])
  })

  it('reports the change since the reading before', () => {
    expect(latest(series([e(2, 5600), e(10, 6000)], 'weight'))).toMatchObject({ value: 6000, change: 400, days: 8 })
    expect(latest(series([e(2, 5600)], 'weight'))).toEqual({ at: at(2), value: 5600 })
    expect(latest([])).toBeUndefined()
  })
})
