import { expect, it } from 'vitest'
import { DEFAULT_AGE_NORMS, normFor } from '../src/domain/ageNorms'
import type { BabyEvent, DraftEvent } from '../src/domain/events'
import { outlook, quantile } from '../src/domain/outlook'

// Raise the bar when forecasts improve; never loosen it to get a green run.
const MAX_MEDIAN_MISS_MIN = { nap: 8, feed: 10 }

const MIN = 60_000
const WEEKS = 18

/** Deterministic jitter so the eval gives the same numbers every run. */
function jitter(seed: number): () => number {
  let x = seed
  return () => {
    x = (x * 1_103_515_245 + 12_345) % 2 ** 31
    return x / 2 ** 31 - 0.5
  }
}

/** Two weeks of a 4-month-old: three naps with growing wake windows, feeds every ~3h, a night feed. */
function syntheticLog(): BabyEvent[] {
  const rand = jitter(7)
  const events: BabyEvent[] = []
  let n = 0
  const add = (e: DraftEvent) => events.push({ ...e, id: `e${n++}`, loggedBy: 'dad' })
  for (let d = 1; d <= 14; d++) {
    let t = new Date(2026, 9, d, 6, 45 + Math.round(rand() * 30)).getTime()
    add({ kind: 'sleep', at: t, phase: 'end' })
    for (const [awake, nap] of [
      [95, 75],
      [120, 60],
      [140, 40],
    ]) {
      t += (awake + rand() * 30) * MIN
      add({ kind: 'sleep', at: t, phase: 'start' })
      t += (nap + rand() * 30) * MIN
      add({ kind: 'sleep', at: t, phase: 'end' })
    }
    t += (150 + rand() * 30) * MIN
    add({ kind: 'sleep', at: t, phase: 'start' })
    for (let f = new Date(2026, 9, d, 7).getTime(); f < t; f += (180 + rand() * 40) * MIN) {
      add({ kind: 'feed', at: f, method: 'bottle', amountMl: 150 })
    }
    add({ kind: 'feed', at: new Date(2026, 9, d + 1, 2, Math.round(rand() * 60)).getTime(), method: 'bottle', amountMl: 120 })
  }
  return events.sort((a, b) => a.at - b.at)
}

/** Minutes outside the predicted range; 0 when the real time fell inside it. */
function miss(actual: number, from: number, to: number): number {
  return Math.max(0, from - actual, actual - to) / MIN
}

it('outlook ranges stay close to what happened', () => {
  const log = syntheticLog()
  const norm = normFor(DEFAULT_AGE_NORMS, WEEKS)
  const misses = { nap: [] as number[], feed: [] as number[] }
  const replayFrom = new Date(2026, 9, 5).getTime()
  for (const e of log) {
    if (e.at < replayFrom) continue
    // Ask 10 minutes after the previous event, as a parent glancing at the phone would.
    const prev = log.filter((x) => x.at < e.at && x.kind === (e.kind === 'feed' ? 'feed' : 'sleep')).at(-1)
    if (!prev) continue
    const asked = prev.at + 10 * MIN
    const view = outlook(
      log.filter((x) => x.at <= asked),
      norm,
      WEEKS,
      asked,
    )
    const id = e.kind === 'feed' ? 'feed' : e.kind === 'sleep' && e.phase === 'start' ? 'nap' : undefined
    const item = view.items.find((i) => i.id === id)
    if (id && item && new Date(e.at).getHours() < 18) misses[id].push(miss(e.at, item.from, item.to))
  }
  const report = {
    nap: { cases: misses.nap.length, medianMissMin: Math.round(quantile(misses.nap, 0.5)) },
    feed: { cases: misses.feed.length, medianMissMin: Math.round(quantile(misses.feed, 0.5)) },
  }
  console.log('forecast eval', report)
  expect(report.nap.cases).toBeGreaterThan(20)
  expect(report.feed.cases).toBeGreaterThan(30)
  expect(report.nap.medianMissMin).toBeLessThanOrEqual(MAX_MEDIAN_MISS_MIN.nap)
  expect(report.feed.medianMissMin).toBeLessThanOrEqual(MAX_MEDIAN_MISS_MIN.feed)
})
