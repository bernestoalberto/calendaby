import type { SourceId } from './sources.js'

export const TOPICS = ['sleep', 'safe-sleep', 'feeding', 'solids', 'diapers', 'milestones'] as const
export type GuideTopic = (typeof TOPICS)[number]

/** Age band in weeks: from is inclusive, to is exclusive. */
export type Guide = { topic: GuideTopic; from: number; to: number; text: string; source: SourceId }

export const mo = (months: number): number => Math.round((months * 30.44) / 7)

const ACT_EARLY =
  "If your baby misses milestones, loses skills they had, or you're worried, talk to the pediatrician and ask about developmental screening. Don't wait."

export const GUIDES: Guide[] = [
  { topic: 'sleep', from: 0, to: mo(4), text: 'Newborns (0 to 3 months) need about 14 to 17 hours of sleep in 24 hours.', source: 'cdcSleep' },
  { topic: 'sleep', from: mo(4), to: mo(12), text: 'Infants (4 to 12 months) need about 12 to 16 hours of sleep in 24 hours, naps included.', source: 'cdcSleep' },
  { topic: 'sleep', from: mo(12), to: mo(36), text: 'Toddlers (1 to 2 years) need about 11 to 14 hours of sleep in 24 hours, naps included.', source: 'cdcSleep' },

  { topic: 'safe-sleep', from: 0, to: mo(12), text: 'Place baby on their back for every nap and at night until 1 year old.', source: 'safeToSleep' },
  { topic: 'safe-sleep', from: 0, to: mo(12), text: 'Use a firm, flat, level surface with only a fitted sheet: no pillows, blankets, bumpers, toys or positioners. Never a couch, armchair or inclined sleeper.', source: 'safeToSleep' },
  { topic: 'safe-sleep', from: 0, to: mo(12), text: "Keep baby in their own crib or bassinet in your room for at least the first 6 months. Don't share a bed.", source: 'safeToSleep' },
  { topic: 'safe-sleep', from: 0, to: mo(6), text: 'Stop swaddling once baby starts trying to roll, usually around 3 months.', source: 'safeToSleep' },
  { topic: 'safe-sleep', from: 0, to: mo(12), text: 'Dress baby for the room temperature, no hat indoors, and watch for sweating or hot, red skin. Offer a pacifier at sleep once feeding is going well.', source: 'safeToSleep' },

  { topic: 'feeding', from: 0, to: 1, text: 'Breastfed: in the first days babies may want to eat every 1 to 3 hours, day and night.', source: 'cdcNewborn' },
  { topic: 'feeding', from: 0, to: 1, text: 'Formula: start with 1 to 2 oz (30 to 60 ml) every 2 to 3 hours in the first days, more if baby still shows hunger. Most newborns feed 8 to 12 times in 24 hours.', source: 'cdcFormula' },
  { topic: 'feeding', from: 1, to: mo(6), text: 'Breastfed: most exclusively breastfed babies feed every 2 to 4 hours, about 8 to 12 times in 24 hours.', source: 'cdcBreastfeeding' },
  { topic: 'feeding', from: 1, to: mo(6), text: 'Formula: most babies feed about every 3 to 4 hours, and you may need to wake baby to feed. Babies usually take what they need and stop when full.', source: 'cdcFormula' },
  { topic: 'feeding', from: 0, to: mo(6), text: 'WHO recommends breast milk only for the first 6 months, then breastfeeding alongside solid foods up to 2 years or beyond.', source: 'whoFeeding' },
  { topic: 'feeding', from: mo(6), to: mo(12), text: 'From 6 to 12 months most babies have formula or solids about 5 to 6 times in 24 hours; breastfed babies keep feeding on hunger cues. Milk needs drop as solids increase.', source: 'cdcFormula' },

  { topic: 'solids', from: mo(4), to: mo(12), text: 'Start solid foods at about 6 months, never before 4 months. Signs of readiness: sits up alone or with support, good head control, opens mouth for food, swallows instead of pushing it out.', source: 'cdcSolids' },
  { topic: 'solids', from: mo(4), to: mo(12), text: 'Introduce one single-ingredient food at a time, 3 to 5 days apart. Offer common allergens such as egg, peanut products and wheat along with other foods; with severe eczema or an egg allergy, ask the doctor before peanut.', source: 'cdcSolids' },
  { topic: 'solids', from: 0, to: mo(12), text: 'No honey before 12 months (botulism risk), no cow milk as a drink before 12 months, and no juice before 12 months.', source: 'cdcAvoid' },
  { topic: 'solids', from: mo(12), to: mo(36), text: 'From 1 to 3 years, limit 100% fruit juice to 4 oz a day at most.', source: 'cdcAvoid' },

  { topic: 'diapers', from: 0, to: 1, text: 'Minimum diapers in the first week: day 1, 1 wet and 1 dirty; day 2, 2 wet and 3 dirty; day 3, 5 wet and 3 dirty; day 4 to 7, 6 wet and 3 dirty. Poop turns from black or dark green to yellow during the first week.', source: 'cdcNewborn' },
  { topic: 'diapers', from: 0, to: mo(36), text: 'Fewer wet diapers than usual can be a sign of dehydration. No wet diaper for 6 hours means call the pediatrician.', source: 'medlineDiarrhea' },

  { topic: 'milestones', from: 0, to: mo(4) - 4, text: 'By 2 months most babies calm when picked up, smile when you smile, make sounds other than crying, and hold their head up on their tummy.', source: 'cdcMilestones' },
  { topic: 'milestones', from: mo(2), to: mo(4) + 4, text: 'By 4 months most babies smile on their own to get attention, coo and make sounds back, hold their head steady when held, bring hands to mouth, and push up on elbows on their tummy.', source: 'cdcMilestones' },
  { topic: 'milestones', from: mo(4), to: mo(6) + 4, text: 'By 6 months most babies know familiar people, laugh, take turns making sounds, roll from tummy to back, and lean on their hands when sitting.', source: 'cdcMilestones' },
  { topic: 'milestones', from: mo(6), to: mo(9) + 4, text: 'By 9 months most babies turn when you call their name, look for dropped objects, lift their arms to be picked up, sit without support, and pass objects hand to hand.', source: 'cdcMilestones' },
  { topic: 'milestones', from: mo(9), to: mo(12) + 4, text: 'By 12 months most babies wave bye-bye, call a parent mama or dada, pull up to stand, walk holding furniture, and pick up small bits with thumb and finger.', source: 'cdcMilestones' },
  { topic: 'milestones', from: mo(12), to: mo(15) + 4, text: 'By 15 months most toddlers try a word or two besides mama or dada, point to ask for something, take a few steps alone, and feed themselves with fingers.', source: 'cdcMilestones' },
  { topic: 'milestones', from: mo(15), to: mo(18) + 4, text: 'By 18 months most toddlers say at least three words, follow a one-step direction, walk without holding on, scribble, and try to use a spoon.', source: 'cdcMilestones' },
  { topic: 'milestones', from: mo(18), to: mo(24) + 4, text: 'By 2 years most toddlers put two words together, point to pictures in a book, kick a ball, run, and eat with a spoon.', source: 'cdcMilestones' },
  { topic: 'milestones', from: 0, to: mo(36), text: ACT_EARLY, source: 'cdcMilestones' },
]

/** Topics parents ask about that no public health agency covers; the agent says so instead of guessing. */
export const GAPS = {
  'wake-windows':
    "No public health agency publishes wake window numbers. Calendaby estimates the next nap from this baby's own log instead.",
  leaps:
    "Mental 'leaps' (Wonder Weeks) are not part of CDC, NIH or WHO guidance. The CDC milestone checklist for the baby's age is the vetted reference.",
} as const
export type GapTopic = keyof typeof GAPS
