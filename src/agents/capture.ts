import type { DraftEvent } from '../domain/events.js'

export interface CaptureResult {
  drafts: DraftEvent[]
  /** Clauses the agent could not turn into an event; the UI asks the parent about these. */
  unsure: string[]
}

/**
 * Turns one free-form line ("fed 120 ml at 3, she's down now") into structured events.
 * The rule-based agent works offline; an LLM-backed agent can implement the same interface later.
 */
export interface CaptureAgent {
  capture(text: string, now: Date): Promise<CaptureResult>
}

const OZ_TO_ML = 29.5735
const MINUTE = 60_000

export class RuleCaptureAgent implements CaptureAgent {
  async capture(text: string, now: Date): Promise<CaptureResult> {
    return parseLog(text, now)
  }
}

export function parseLog(text: string, now: Date): CaptureResult {
  const drafts: DraftEvent[] = []
  const unsure: string[] = []
  // A time stated once ("at 3 fed 120ml and changed a wet diaper") carries to the clauses after it.
  let carriedAt: number | undefined

  for (const clause of splitClauses(text)) {
    const at = resolveTime(clause, now) ?? carriedAt ?? now.getTime()
    carriedAt = at
    const found = parseClause(clause, at)
    if (found.length === 0) unsure.push(clause)
    drafts.push(...found)
  }
  return { drafts, unsure }
}

function splitClauses(text: string): string[] {
  return text
    .split(/[,;\n]|\.(?!\d)|\bthen\b/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

function parseClause(clause: string, at: number): DraftEvent[] {
  const c = clause.toLowerCase()
  const out: DraftEvent[] = []

  if (/\b(fed|feed|feeding|bottle|nursed|nursing|breastfed|breast|ate|eat|solids|puree)\b/.test(c)) {
    const method = /\b(nursed|nursing|breastfed|breast)\b/.test(c)
      ? 'breast'
      : /\b(ate|eat|solids|puree)\b/.test(c)
        ? 'solids'
        : 'bottle'
    const side = c.match(/\b(left|right|both)\b/)?.[1] as 'left' | 'right' | 'both' | undefined
    out.push({ kind: 'feed', at, method, amountMl: parseAmountMl(c), side: method === 'breast' ? side : undefined })
  }

  if (/\b(woke|awake|wakes|up from)\b/.test(c)) {
    out.push({ kind: 'sleep', at, phase: 'end' })
  } else if (/\b(asleep|down|nap|napping|sleeping|fell asleep|bedtime|in bed)\b/.test(c)) {
    out.push({ kind: 'sleep', at, phase: 'start' })
  }

  if (/\b(diaper|nappy|pee|peed|poop|pooped|poo|wet|dirty)\b/.test(c)) {
    const wet = /\b(wet|pee|peed)\b/.test(c)
    const dirty = /\b(dirty|poop|pooped|poo)\b/.test(c)
    out.push({ kind: 'diaper', at, contents: wet && dirty ? 'both' : dirty ? 'dirty' : 'wet' })
  }

  const med = c.match(/\b(tylenol|acetaminophen|paracetamol|ibuprofen|motrin|advil|vitamin d|gripe water|simethicone)\b/)
  if (med) {
    const dose = c.match(/(\d+(?:\.\d+)?)\s*ml\b/)
    out.push({ kind: 'med', at, name: med[1], doseMl: dose ? Number(dose[1]) : undefined })
  }

  return out
}

function parseAmountMl(c: string): number | undefined {
  const m = c.match(/(\d+(?:\.\d+)?)\s*(ml|oz|ounces?)\b/)
  if (!m) return undefined
  const n = Number(m[1])
  return m[2] === 'ml' ? n : Math.round(n * OZ_TO_ML)
}

/** Returns epoch ms for "now", "20 min ago", "at 3", "at 3:30pm"; undefined when the clause has no time. */
export function resolveTime(clause: string, now: Date): number | undefined {
  const c = clause.toLowerCase()
  if (/\b(just now|right now|now)\b/.test(c)) return now.getTime()

  const ago = c.match(/(\d+)\s*(m|min|mins|minutes|h|hr|hrs|hours?)\s+ago\b/)
  if (ago) {
    const n = Number(ago[1])
    return now.getTime() - (ago[2].startsWith('h') ? n * 60 : n) * MINUTE
  }

  const clock = c.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/)
  if (!clock) return undefined
  const hour = Number(clock[1])
  const minute = Number(clock[2] ?? 0)
  if (hour > 23 || minute > 59) return undefined

  const candidates: number[] = []
  const hours = clock[3]
    ? [(hour % 12) + (clock[3] === 'pm' ? 12 : 0)]
    : hour > 12
      ? [hour]
      : [hour % 12, (hour % 12) + 12]
  for (const h of hours) {
    for (const dayOffset of [0, -1]) {
      const d = new Date(now)
      d.setDate(d.getDate() + dayOffset)
      d.setHours(h, minute, 0, 0)
      candidates.push(d.getTime())
    }
  }
  // Parents log the past: pick the most recent matching time that is not in the future.
  const past = candidates.filter((t) => t <= now.getTime() + MINUTE)
  return past.length ? Math.max(...past) : undefined
}
