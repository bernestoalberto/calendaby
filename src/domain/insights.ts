import { z } from 'zod'
import { SOURCES, type Source, type SourceId } from '../knowledge/sources.js'
import type { BabyEvent } from './events.js'

export const INSIGHT_TOPICS = ['growth', 'milestones', 'sleep', 'rhythm', 'health'] as const
export type InsightTopic = (typeof INSIGHT_TOPICS)[number]

/** Topics that make a claim about the baby's health or development and so must cite a source. */
const NEEDS_SOURCE: readonly InsightTopic[] = ['growth', 'milestones', 'health']

/** A card as the app stores and draws it. The text is plain text: it is never treated as markup or as an instruction. */
export const InsightCard = z.object({
  topic: z.enum(INSIGHT_TOPICS),
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(300),
  sources: z.array(z.object({ org: z.string().max(40), title: z.string().max(120), url: z.url({ protocol: /^https$/ }) })).max(3),
})
export type InsightCard = z.infer<typeof InsightCard>

/** What the model may ask for. It names sources by id, so it can never write a link of its own. */
export const SOURCE_IDS = Object.keys(SOURCES) as [SourceId, ...SourceId[]]
export const ModelInsights = z.object({
  cards: z
    .array(
      z.object({
        topic: z.enum(INSIGHT_TOPICS),
        title: z.string(),
        body: z.string(),
        sources: z.array(z.enum(SOURCE_IDS)).max(3).default([]),
      }),
    )
    .max(4),
})

// Words a card must not use about a baby: it describes what was logged and points to the pediatrician, it does not label.
const LABELS = /\b(underweight|overweight|obese|obesity|failure to thrive|failing to thrive|delayed|developmental delay|autis\w*|diagnos\w*|abnormal|malnourish\w*)\b/i
const MARKUP = /[<>]|https?:\/\//i

/**
 * Turns what the model sent into cards the app will show. A card that does not fit the rules is dropped, not repaired:
 * too long, markup or a link in the text, a label for the baby, a health topic with no source, or a source that is not one
 * of the vetted ones.
 */
export function sanitizeInsights(raw: unknown): InsightCard[] {
  const parsed = ModelInsights.safeParse(raw)
  if (!parsed.success) return []
  const seen = new Set<string>()
  const out: InsightCard[] = []
  for (const c of parsed.data.cards) {
    const sources: Source[] = [...new Set(c.sources)].map((id) => SOURCES[id])
    if (NEEDS_SOURCE.includes(c.topic) && sources.length === 0) continue
    if (LABELS.test(`${c.title} ${c.body}`) || MARKUP.test(`${c.title} ${c.body}`)) continue
    const card = InsightCard.safeParse({ topic: c.topic, title: c.title, body: c.body, sources })
    if (!card.success || seen.has(card.data.title.toLowerCase())) continue
    seen.add(card.data.title.toLowerCase())
    out.push(card.data)
  }
  return out
}

export const HOUR = 3_600_000
/** Fewest hours between two runs when something changed. */
export const MIN_GAP_HOURS = 6
/** A run happens at least this often while there is data to talk about. */
export const MAX_GAP_HOURS = 24

/**
 * What the insights are about: how many measurements and milestone answers there are, the newest of each, and the
 * checklist the baby is on. A change here is a reason to ask again; the same signature is not.
 */
export function insightSignature(events: BabyEvent[], ageMonths: number | undefined): string {
  let measures = 0
  let marks = 0
  let newest = 0
  for (const e of events) {
    if (e.kind === 'measure') measures++
    else if (e.kind === 'milestone') marks++
    else continue
    newest = Math.max(newest, e.at)
  }
  return `${measures}:${marks}:${newest}:${ageMonths ?? 'x'}`
}

/** Whether to ask for new insights now. `lastRun` is epoch ms, or undefined if never. */
export function insightsDue(opts: { enabled: boolean; online: boolean; hasBirth: boolean; signature: string; lastSignature?: string; lastRun?: number; now: number }): boolean {
  if (!opts.enabled || !opts.online || !opts.hasBirth) return false
  if (opts.lastRun === undefined) return true
  const hours = (opts.now - opts.lastRun) / HOUR
  if (hours < MIN_GAP_HOURS) return false
  return opts.signature !== opts.lastSignature || hours >= MAX_GAP_HOURS
}

/** The notification text for fresh cards: the first card's title, and its body cut to fit. */
export function insightAlert(baby: string, cards: InsightCard[]): { title: string; body: string } {
  const [first] = cards
  const more = cards.length > 1 ? ` (+${cards.length - 1} more)` : ''
  return { title: `${baby}: ${first.title}`.slice(0, 80), body: `${first.body}${more}`.slice(0, 200) }
}
