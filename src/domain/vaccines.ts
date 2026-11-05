import type { DraftEvent } from './events'
import { activityId } from './activities'

/** One row of the `vaccine_type` table. */
export type VaccineType = { id: string; label: string }

/** Seed for a fresh database: the vaccines named in the CDC schedule in src/knowledge/checkups.ts. Existing rows are never overwritten. */
export const DEFAULT_VACCINE_TYPES: VaccineType[] = [
  { id: 'hepb', label: 'Hepatitis B' },
  { id: 'rsv', label: 'RSV antibody' },
  { id: 'dtap', label: 'DTaP' },
  { id: 'hib', label: 'Hib' },
  { id: 'pcv', label: 'Pneumococcal (PCV)' },
  { id: 'ipv', label: 'Polio (IPV)' },
  { id: 'rotavirus', label: 'Rotavirus' },
  { id: 'flu', label: 'Flu' },
  { id: 'covid', label: 'COVID-19' },
  { id: 'mmr', label: 'MMR' },
  { id: 'varicella', label: 'Chickenpox (varicella)' },
  { id: 'hepa', label: 'Hepatitis A' },
]

/** "Yellow fever" becomes "yellow-fever", the same slug rule as activity types. */
export const vaccineId = activityId

/** The stored label, or a readable fallback for an id the table no longer has. */
export function vaccineLabel(types: VaccineType[], id: string): string {
  return types.find((t) => t.id === id)?.label ?? id.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

/**
 * A shot is recorded after it happens, so a day that has not come yet is a typo. This is checked when a parent logs or
 * edits, not when an entry arrives from the other phone, whose clock may differ.
 */
export function vaccineProblem(draft: DraftEvent, now: number): string | undefined {
  if (draft.kind !== 'vaccine') return undefined
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  return draft.at > endOfToday.getTime() ? 'A vaccination cannot be in the future. Check the date.' : undefined
}
