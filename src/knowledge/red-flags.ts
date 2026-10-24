import { mo } from './guidance.js'
import type { SourceId } from './sources.js'

export type Urgency = 'emergency' | 'call-now' | 'call-soon'

export type RedFlag = {
  id: string
  urgency: Urgency
  from: number
  to: number
  match: RegExp
  say: string
  source: SourceId
}

const FEVER = /fever|temp(erature)?\b|\b(10[0-5](\.\d)?|3[89](\.\d)?|40(\.\d)?) ?(°|deg)? ?[fc]\b|feels? hot/i

export const RED_FLAGS: RedFlag[] = [
  {
    id: 'breathing',
    urgency: 'emergency',
    from: 0,
    to: mo(36),
    match: /breath|gasp|wheez|grunt|ribs? (pull|suck)|blue (lips|tongue|nails|face)|turn(ed|ing)? blue/i,
    say: 'Trouble breathing, or blue lips, tongue or nails: call 911 now.',
    source: 'medlineFever',
  },
  {
    id: 'unresponsive',
    urgency: 'emergency',
    from: 0,
    to: mo(36),
    match: /(hard|can'?t|won'?t|cannot) (to )?wake|unresponsive|limp|floppy|seizure|convuls|stiff neck/i,
    say: "Hard to wake, limp, a seizure or a stiff neck: call 911 now.",
    source: 'medlineFever',
  },
  {
    id: 'fever-under-3-months',
    urgency: 'call-now',
    from: 0,
    to: mo(3),
    match: FEVER,
    say: 'Under 3 months, a rectal temperature of 100.4 F (38 C) or higher needs a call to the pediatrician now, or urgent care if you cannot reach them. Call before giving any medicine.',
    source: 'medlineFever',
  },
  {
    id: 'fever',
    urgency: 'call-now',
    from: mo(3),
    to: mo(36),
    match: FEVER,
    say: 'Call the pediatrician for a fever of 102.2 F (39 C) or higher under 12 months, a fever lasting more than 48 hours under age 2, or any fever over 105 F (40.5 C). With crying that cannot be calmed, a new rash or bruises, or trouble breathing, call 911.',
    source: 'medlineFever',
  },
  {
    id: 'dehydration',
    urgency: 'call-now',
    from: 0,
    to: mo(36),
    match: /dehydrat|no (wet|pee)|dry (diaper|mouth)|no tears|sunken|soft spot/i,
    say: 'No wet diaper for 6 hours, no tears, a dry sticky mouth or a sunken soft spot: call the pediatrician now.',
    source: 'medlineDiarrhea',
  },
  {
    id: 'diarrhea-under-3-months',
    urgency: 'call-now',
    from: 0,
    to: mo(3),
    match: /diarrh|watery (poop|stool)/i,
    say: 'Diarrhea in a baby under 3 months: call the pediatrician.',
    source: 'medlineDiarrhea',
  },
  {
    id: 'blood-or-vomiting',
    urgency: 'call-now',
    from: 0,
    to: mo(36),
    match: /blood|vomit|throw(ing)? up/i,
    say: 'Blood, mucus or pus in the stool, or vomiting for more than 24 hours: call the pediatrician.',
    source: 'medlineDiarrhea',
  },
  {
    id: 'jaundice',
    urgency: 'call-now',
    from: 0,
    to: mo(2),
    match: /yellow|jaundice/i,
    say: 'Bright yellow skin, yellow soles, or jaundice that keeps increasing or lasts over 2 weeks: call the pediatrician. With fever, listlessness or poor feeding it is an emergency.',
    source: 'medlineJaundice',
  },
  {
    id: 'inconsolable',
    urgency: 'call-now',
    from: 0,
    to: mo(36),
    match: /inconsolable|can'?t (be )?(calm|sooth|settle)|won'?t stop crying|crying for hours/i,
    say: 'Crying that cannot be calmed: call the pediatrician. If there is also a fever, call 911.',
    source: 'medlineFever',
  },
  {
    id: 'lost-skills',
    urgency: 'call-soon',
    from: 0,
    to: mo(36),
    match: /lost (a |the |some )?skills?|stopped (smiling|babbling|talking|walking|crawling)|regress/i,
    say: 'Losing skills a baby already had is a reason to talk to the pediatrician soon and ask about developmental screening.',
    source: 'cdcMilestones',
  },
]

const DOSING = /\bdos(e|age|ing)\b|how (much|many) .*(tylenol|motrin|advil|acetaminophen|ibuprofen|paracetamol|medicine|syrup)|\b(tylenol|motrin|advil|acetaminophen|ibuprofen|paracetamol)\b/i

export const DOSING_REPLY =
  'I cannot give medicine doses. The right dose depends on weight and the exact product, so ask the pediatrician or a pharmacist. Under 3 months, call the pediatrician before giving any medicine. Never give aspirin unless the doctor says so.'

export type Screen = { flags: RedFlag[]; dosing: boolean }

/** Keyword safety net over a parent's message; the agent also gets the full list via its tool. */
export function screen(text: string, ageWeeks?: number): Screen {
  const flags = RED_FLAGS.filter(
    (f) => f.match.test(text) && (ageWeeks === undefined || (ageWeeks >= f.from && ageWeeks < f.to)),
  )
  return { flags, dosing: DOSING.test(text) }
}
