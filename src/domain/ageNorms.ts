/** One row of the `age_norms` table: what is typical for an age band, used until the baby's own logs exist. */
export type AgeNorm = {
  fromWeeks: number
  toWeeks: number
  wakeMinLow: number
  wakeMinHigh: number
  napsLow: number
  napsHigh: number
}

export const AGE_NORMS_SOURCE = 'Typical ranges from common pediatric sleep guidance. Every baby differs; confirm with your pediatrician.'

/** Seed for a fresh database. Rows already stored are never overwritten. */
export const DEFAULT_AGE_NORMS: AgeNorm[] = [
  { fromWeeks: 0, toWeeks: 4, wakeMinLow: 35, wakeMinHigh: 60, napsLow: 4, napsHigh: 8 },
  { fromWeeks: 4, toWeeks: 12, wakeMinLow: 60, wakeMinHigh: 90, napsLow: 4, napsHigh: 5 },
  { fromWeeks: 12, toWeeks: 17, wakeMinLow: 75, wakeMinHigh: 120, napsLow: 3, napsHigh: 4 },
  { fromWeeks: 17, toWeeks: 26, wakeMinLow: 105, wakeMinHigh: 150, napsLow: 3, napsHigh: 3 },
  { fromWeeks: 26, toWeeks: 35, wakeMinLow: 120, wakeMinHigh: 180, napsLow: 2, napsHigh: 3 },
  { fromWeeks: 35, toWeeks: 44, wakeMinLow: 150, wakeMinHigh: 210, napsLow: 2, napsHigh: 2 },
  { fromWeeks: 44, toWeeks: 61, wakeMinLow: 180, wakeMinHigh: 240, napsLow: 1, napsHigh: 2 },
  { fromWeeks: 61, toWeeks: 105, wakeMinLow: 300, wakeMinHigh: 360, napsLow: 1, napsHigh: 1 },
]

<<<<<<< HEAD
=======
export function ageInWeeks(birth: string, now: number): number | undefined {
  const b = new Date(`${birth}T00:00`).getTime()
  if (Number.isNaN(b) || b > now) return undefined
  return Math.floor((now - b) / (7 * 86_400_000))
}

>>>>>>> fc9c5a4 (Add pediatric knowledge layer to the agent: advice cites CDC, NIH and WHO instead of the model's memory 2)
export function normFor(norms: AgeNorm[], weeks: number | undefined): AgeNorm | undefined {
  if (weeks === undefined) return undefined
  return norms.find((n) => weeks >= n.fromWeeks && weeks < n.toWeeks)
}

/** "4 months" or "6 weeks", for "typical for ..." labels. */
export function ageLabel(weeks: number): string {
  if (weeks < 9) return `${weeks} week${weeks === 1 ? '' : 's'}`
  const months = Math.floor(weeks / 4.345)
  return `${months} month${months === 1 ? '' : 's'}`
}
