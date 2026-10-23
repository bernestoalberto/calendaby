import type { DraftEvent } from './events'

export type Side = 'left' | 'right'

/** Plain data so it can be saved and survive an app restart. */
export interface NursingTimer {
  leftMs: number
  rightMs: number
  running?: Side
  since?: number // when the running side was started
  startedAt?: number // when the feed began
}

export const EMPTY_TIMER: NursingTimer = { leftMs: 0, rightMs: 0 }

export function elapsed(t: NursingTimer, side: Side, now: number): number {
  const base = side === 'left' ? t.leftMs : t.rightMs
  return t.running === side && t.since !== undefined ? base + (now - t.since) : base
}

function pause(t: NursingTimer, now: number): NursingTimer {
  if (!t.running) return t
  return { ...t, leftMs: elapsed(t, 'left', now), rightMs: elapsed(t, 'right', now), running: undefined, since: undefined }
}

export function toggle(t: NursingTimer, side: Side, now: number): NursingTimer {
  const paused = pause(t, now)
  if (t.running === side) return paused
  return { ...paused, running: side, since: now, startedAt: paused.startedAt ?? now }
}

export function switchSide(t: NursingTimer, now: number): NursingTimer {
  return toggle(t, t.running === 'left' ? 'right' : t.running === 'right' ? 'left' : 'left', now)
}

export function lastSide(t: NursingTimer): Side | undefined {
  if (t.running) return t.running
  if (!t.leftMs && !t.rightMs) return undefined
  return t.leftMs >= t.rightMs ? 'left' : 'right'
}

export function nursingDraft(t: NursingTimer, now: number): DraftEvent | undefined {
  const left = Math.round(elapsed(t, 'left', now) / 60_000)
  const right = Math.round(elapsed(t, 'right', now) / 60_000)
  if (t.startedAt === undefined || left + right === 0) return undefined
  const side = left && right ? 'both' : left ? 'left' : 'right'
  return {
    kind: 'feed',
    at: t.startedAt,
    method: 'breast',
    side,
    durationMin: Math.min(240, left + right),
    leftMin: Math.min(240, left),
    rightMin: Math.min(240, right),
  }
}
