import { z } from 'zod'

export const Caregiver = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})
export type Caregiver = z.infer<typeof Caregiver>

const base = {
  id: z.string().min(1),
  at: z.number().int().positive(), // epoch ms when it happened
  loggedBy: z.string().min(1),
  note: z.string().optional(),
}

export const FeedEvent = z.object({
  ...base,
  kind: z.literal('feed'),
  method: z.enum(['bottle', 'breast', 'solids']),
  amountMl: z.number().positive().max(400).optional(),
  side: z.enum(['left', 'right', 'both']).optional(),
  milk: z.enum(['breastmilk', 'formula']).optional(),
  durationMin: z.number().int().positive().max(240).optional(),
  leftMin: z.number().int().nonnegative().max(240).optional(),
  rightMin: z.number().int().nonnegative().max(240).optional(),
})

export const SleepEvent = z.object({
  ...base,
  kind: z.literal('sleep'),
  phase: z.enum(['start', 'end']),
})

export const DiaperEvent = z.object({
  ...base,
  kind: z.literal('diaper'),
  contents: z.enum(['wet', 'dirty', 'both']),
})

export const MedEvent = z.object({
  ...base,
  kind: z.literal('med'),
  name: z.string().min(1),
  doseMl: z.number().positive().max(50).optional(),
})

export const NoteEvent = z.object({
  ...base,
  kind: z.literal('note'),
  note: z.string().min(1),
})

/** Tummy time, bath, play. `type` is an id from the `activity_types` table, so new ones need no code. */
export const ActivityEvent = z.object({
  ...base,
  kind: z.literal('activity'),
  type: z.string().min(1),
  durationMin: z.number().int().positive().max(600).optional(),
})

export const PumpEvent = z.object({
  ...base,
  kind: z.literal('pump'),
  amountMl: z.number().positive().max(600).optional(),
  side: z.enum(['left', 'right', 'both']).optional(),
  durationMin: z.number().int().positive().max(240).optional(),
})

/** Head, length and weight, stored metric. The ranges cover a baby up to 3 years old. */
const MeasureBase = z.object({
  ...base,
  kind: z.literal('measure'),
  weightG: z.number().int().min(500).max(25_000).optional(),
  lengthMm: z.number().int().min(250).max(1_100).optional(),
  headMm: z.number().int().min(200).max(600).optional(),
})
const hasValue = (e: { weightG?: number; lengthMm?: number; headMm?: number }) =>
  e.weightG !== undefined || e.lengthMm !== undefined || e.headMm !== undefined
const NEEDS_VALUE = { message: 'Add a weight, length or head size' }

export const MeasureEvent = MeasureBase.refine(hasValue, NEEDS_VALUE)

/**
 * A parent's answer about one milestone (see src/knowledge/milestones.ts). The latest answer for an item counts, so changing
 * your mind is a new entry. `text` is kept so the Timeline can show it without looking the item up.
 */
export const MilestoneEvent = z.object({
  ...base,
  kind: z.literal('milestone'),
  milestoneId: z.string().regex(/^\d{1,2}-(social|language|cognitive|movement)-\d{1,2}$/),
  state: z.enum(['yes', 'not_yet', 'unsure']),
  text: z.string().min(1).max(240),
})

export const BabyEvent = z.discriminatedUnion('kind', [
  FeedEvent,
  SleepEvent,
  DiaperEvent,
  MedEvent,
  NoteEvent,
  ActivityEvent,
  PumpEvent,
  MeasureEvent,
  MilestoneEvent,
])
export type BabyEvent = z.infer<typeof BabyEvent>
export type EventKind = BabyEvent['kind']

/** Distributes Omit across the union so each variant keeps its own fields. */
export type DraftEvent = BabyEvent extends infer E
  ? E extends BabyEvent
    ? Omit<E, 'id' | 'loggedBy'>
    : never
  : never

const omitStored = { id: true, loggedBy: true } as const

/** Runtime check for events proposed outside the app (e.g. by the agent) before they reach the store. */
export const DraftEventSchema = z.discriminatedUnion('kind', [
  FeedEvent.omit(omitStored),
  SleepEvent.omit(omitStored),
  DiaperEvent.omit(omitStored),
  MedEvent.omit(omitStored),
  NoteEvent.omit(omitStored),
  ActivityEvent.omit(omitStored),
  PumpEvent.omit(omitStored),
  MeasureBase.omit(omitStored).refine(hasValue, NEEDS_VALUE),
  MilestoneEvent.omit(omitStored),
])
