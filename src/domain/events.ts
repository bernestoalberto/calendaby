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

export const BabyEvent = z.discriminatedUnion('kind', [
  FeedEvent,
  SleepEvent,
  DiaperEvent,
  MedEvent,
  NoteEvent,
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
])
