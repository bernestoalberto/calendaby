import { DEFAULT_ACTIVITY_TYPES } from './activities'
import { DEFAULT_AGE_NORMS } from './ageNorms'
import { DEFAULT_FEATURES } from './features'
import { DEFAULT_LISTS, DEFAULT_SETTINGS, OPTION_LISTS } from './options'

/**
 * The starting data of a fresh database, as a list of seeds. A seed is planted once per phone and recorded in
 * `seed_applied`; every statement is INSERT OR IGNORE, so a stored choice is never overwritten and a removed item
 * does not come back.
 *
 * To give every phone a new default, add a NEW seed with a new id holding only the new rows. Never edit a seed that
 * has shipped: phones that already ran it would not see the change.
 */
export interface Seed {
  id: string
  /**
   * Phones whose schema was already at this version before seeds were recorded got this data from the old migrations,
   * so it is marked done instead of being planted again. Use Infinity for a new seed.
   */
  since: number
  statements: string[]
}

export const sqlText = (v: string) => `'${v.replaceAll("'", "''")}'`

export const SEEDS: Seed[] = [
  {
    id: 'features-v1',
    since: 5,
    statements: DEFAULT_FEATURES.map(
      (f, i) =>
        `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) VALUES (${[f.id, f.label, f.hint, f.group].map(sqlText).join(', ')}, ${i}, ${f.off ? 0 : 1})`,
    ),
  },
  {
    id: 'activityTypes-v1',
    since: 4,
    statements: DEFAULT_ACTIVITY_TYPES.map(
      (t, i) => `INSERT OR IGNORE INTO activity_types (id, label, sort) VALUES (${sqlText(t.id)}, ${sqlText(t.label)}, ${i})`,
    ),
  },
  {
    id: 'ageNorms-v1',
    since: 5,
    statements: DEFAULT_AGE_NORMS.map(
      (n) => `INSERT OR IGNORE INTO age_norms VALUES (${[n.fromWeeks, n.toWeeks, n.wakeMinLow, n.wakeMinHigh, n.napsLow, n.napsHigh].join(', ')})`,
    ),
  },
  {
    id: 'lists-v1',
    since: 8,
    statements: OPTION_LISTS.flatMap((l) =>
      DEFAULT_LISTS[l.id].map((v, i) => `INSERT OR IGNORE INTO option_list (list, value, sort) VALUES (${sqlText(l.id)}, ${sqlText(v)}, ${i})`),
    ),
  },
  {
    id: 'settings-v1',
    since: 8,
    statements: Object.entries(DEFAULT_SETTINGS).map(([k, v]) => `INSERT OR IGNORE INTO settings (key, value) VALUES (${sqlText(k)}, ${sqlText(v)})`),
  },
]
