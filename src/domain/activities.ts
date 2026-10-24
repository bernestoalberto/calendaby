/** One row of the `activity_types` table. */
export type ActivityType = { id: string; label: string }

/** Seed for a fresh database. Existing rows are never overwritten. */
export const DEFAULT_ACTIVITY_TYPES: ActivityType[] = [
  { id: 'tummy', label: 'Tummy time' },
  { id: 'bath', label: 'Bath' },
  { id: 'outdoor', label: 'Outdoor play' },
  { id: 'indoor', label: 'Indoor play' },
]

/** "Music time" becomes "music-time". */
export function activityId(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** The stored label, or a readable fallback for an id the table no longer has. */
export function activityLabel(types: ActivityType[], id: string): string {
  return types.find((t) => t.id === id)?.label ?? id.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}
