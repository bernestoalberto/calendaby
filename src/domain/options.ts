/**
 * The lists a parent can change (tags, medicines, preset amounts, quick durations, colour swatches) and the starting
 * values of the numbers they can tune. The rows live in SQLite; these are only the seed for a fresh database and the
 * rules for what a row may hold. Seeds never overwrite what is stored.
 */
export type OptionKind = 'text' | 'number' | 'swatch'

export const OPTION_LISTS = [
  { id: 'feedTags', label: 'Feed tags', hint: 'Quick notes on a feed', kind: 'text' },
  { id: 'diaperTags', label: 'Diaper tags', hint: 'Quick notes on a diaper change', kind: 'text' },
  { id: 'meds', label: 'Medicines', hint: 'The choices when you log a medicine', kind: 'text' },
  { id: 'amountsOz', label: 'Bottle amounts (oz)', hint: 'Quick amounts when units are ounces', kind: 'number' },
  { id: 'amountsMl', label: 'Bottle amounts (mL)', hint: 'Quick amounts when units are millilitres', kind: 'number' },
  { id: 'durations', label: 'Durations (minutes)', hint: 'Quick lengths for nursing and pumping', kind: 'number' },
  { id: 'activityMinutes', label: 'Activity minutes', hint: 'One-tap lengths on the Activity tab', kind: 'number' },
  { id: 'swatches', label: 'Colour swatches', hint: 'Name|#colour, shown in Look & feel', kind: 'swatch' },
] as const

export type ListId = (typeof OPTION_LISTS)[number]['id']

export const DEFAULT_LISTS: Record<ListId, string[]> = {
  feedTags: ['Fussy', 'Spit-up', 'Gassy', 'Burped', 'Hiccups'],
  diaperTags: ['Normal', 'Rash', 'Barrier cream', 'Blowout'],
  meds: ['Vitamin D', 'Tylenol', 'Ibuprofen', 'Gripe water', 'Gas drops'],
  amountsOz: ['2', '4', '5', '6', '8'],
  amountsMl: ['60', '90', '120', '150', '180'],
  durations: ['3', '5', '10', '15', '30'],
  activityMinutes: ['3', '5', '10'],
  swatches: [
    'Lavender|#673ab7',
    'Ocean|#1e6fd9',
    'Teal|#00897b',
    'Meadow|#43a047',
    'Sunshine|#e59a00',
    'Coral|#e5533d',
    'Rose|#d81b60',
    'Slate|#546e7a',
  ],
}

/** Numbers and text a parent can tune, with their starting values. Stored in the `settings` table like the rest. */
export const DEFAULT_SETTINGS = {
  baby: 'Baby',
  tummyGoal: '30',
  unit: 'oz',
  sleepGoalHours: '14',
  briefingTime: '07:30',
} as const

export function isListId(id: string): id is ListId {
  return OPTION_LISTS.some((l) => l.id === id)
}

/** The problem with a value for a list, or undefined when it is fine. */
export function optionProblem(list: ListId, raw: string): string | undefined {
  const value = raw.trim()
  const kind = OPTION_LISTS.find((l) => l.id === list)?.kind
  if (kind === 'number') return /^\d{1,3}(\.\d)?$/.test(value) && Number(value) > 0 ? undefined : 'Enter a number above zero'
  if (kind === 'swatch') return /^[^|]{1,20}\|#[0-9a-fA-F]{6}$/.test(value) ? undefined : 'Use Name|#rrggbb'
  return value.length >= 1 && value.length <= 30 ? undefined : 'Use 1 to 30 characters'
}

/** What a swatch row shows: its name and colour. */
export function parseSwatch(row: string): { name: string; hex: string } {
  const [name, hex] = row.split('|')
  return { name, hex }
}
