import { CHECKUPS, nextCheckups, type Region } from './checkups.js'
import { GAPS, GUIDES, TOPICS, type GapTopic } from './guidance.js'
import { DOSING_REPLY, RED_FLAGS } from './red-flags.js'
import { SOURCES, type Source, type SourceId } from './sources.js'

export { screen, type Screen, type RedFlag } from './red-flags.js'
export { nextCheckups, type Region } from './checkups.js'

export const TOPIC_NAMES = [...TOPICS, 'checkups', 'red-flags', 'medicine', 'wake-windows', 'leaps'] as const
export type Topic = (typeof TOPIC_NAMES)[number]

export type Fact = { text: string; cite: number }
export type Answer = { topic: Topic; ageWeeks?: number; facts: Fact[]; sources: Source[]; note?: string }

/** Whole weeks since a YYYY-MM-DD birth date; undefined when missing or in the future. */
export function weeksOld(birth: string | undefined, now: number): number | undefined {
  if (!birth) return undefined
  const ms = now - new Date(`${birth}T00:00`).getTime()
  return Number.isNaN(ms) || ms < 0 ? undefined : Math.floor(ms / (7 * 86_400_000))
}

const inBand = (age: number | undefined, from: number, to: number) =>
  age === undefined || (age >= from && age < to)

/** Curated guidance for a topic, filtered to the baby's age when known, with numbered citations. */
export function guide(topic: Topic, ageWeeks?: number, region: Region = 'us'): Answer {
  const raw: { text: string; source: SourceId }[] = []
  let note: string | undefined

  if (topic === 'wake-windows' || topic === 'leaps') {
    note = GAPS[topic satisfies GapTopic]
  } else if (topic === 'medicine') {
    raw.push({ text: DOSING_REPLY, source: 'medlineFever' })
  } else if (topic === 'red-flags') {
    for (const f of RED_FLAGS) if (inBand(ageWeeks, f.from, f.to)) raw.push({ text: f.say, source: f.source })
  } else if (topic === 'checkups') {
    const schedule = CHECKUPS[region]
    const visits = ageWeeks === undefined ? schedule.visits : nextCheckups(ageWeeks, region, 3)
    for (const v of visits) {
      const shots = v.vaccines.length ? ` Vaccines usually offered: ${v.vaccines.join('; ')}.` : ''
      raw.push({ text: `${v.label} checkup.${shots}`, source: v.vaccines.length ? 'cdcVaccines' : 'medlineWellChild' })
    }
    note = schedule.note
  } else {
    for (const g of GUIDES) if (g.topic === topic && inBand(ageWeeks, g.from, g.to)) raw.push(g)
  }

  if (!raw.length && !note) note = 'No vetted guidance for this topic at this age. Suggest asking the pediatrician.'

  const ids: SourceId[] = []
  const facts = raw.map(({ text, source }) => {
    if (!ids.includes(source)) ids.push(source)
    return { text, cite: ids.indexOf(source) + 1 }
  })
  return { topic, ageWeeks, facts, sources: ids.map((id) => SOURCES[id]), note }
}

/** Rules for the chat agent; appended to its system prompt. */
export const GUIDE_RULES = `
Pediatric guidance rules:
1. For baby-care questions call pediatric_guide and answer only from what it returns. Name the source in the reply, e.g. "(CDC)", and include its link once.
2. If the guide returns no facts or a note that says there is no vetted guidance, say so plainly and suggest the pediatrician. Never fill gaps from memory.
3. Never diagnose. Never give medicine doses; dosing depends on weight and the product, so point to the pediatrician or a pharmacist.
4. If the parent describes a red flag, open the reply with what to do (call 911, or call the pediatrician now) before anything else.
5. Ranges are typical, not targets. If the baby's log is outside a range but the baby seems well, say that varies and suggest raising it at the next checkup.
`
