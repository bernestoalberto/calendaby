import type { DraftEvent } from '../src/domain/events'

export interface Expected {
  kind: DraftEvent['kind']
  at: string // local HH:MM on the eval's day
  [field: string]: string | number
}

export interface EvalFile {
  now: string
  cases: { text: string; expect: Expected[] }[]
}

function atMs(now: Date, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** A case passes when the drafts match the expected events exactly, in any order, within a minute. */
export function passes(drafts: DraftEvent[], expect: Expected[], now: Date): boolean {
  if (drafts.length !== expect.length) return false
  const left = [...drafts]
  return expect.every((exp) => {
    const i = left.findIndex(
      (d) =>
        d.kind === exp.kind &&
        Math.abs(d.at - atMs(now, exp.at)) <= 60_000 &&
        Object.entries(exp).every(([k, v]) => k === 'at' || (d as Record<string, unknown>)[k] === v),
    )
    if (i === -1) return false
    left.splice(i, 1)
    return true
  })
}
