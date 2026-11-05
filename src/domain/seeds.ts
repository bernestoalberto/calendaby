import { DEFAULT_ACTIVITY_TYPES } from './activities'
import { DEFAULT_AGE_NORMS } from './ageNorms'
import { DEFAULT_FEATURES, FEATURES_V2 } from './features'
import { DEFAULT_SLEEP_NEEDS } from './sleepGoal'
import { DEFAULT_VACCINE_TYPES } from './vaccines'
import { DEFAULT_MILESTONES } from '../knowledge/milestones'
import { WHO_GROWTH_REFERENCE } from './growthReference'
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

function featureRows(rows: typeof DEFAULT_FEATURES, firstSort: number): string[] {
  return rows.map(
    (f, i) =>
      `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) VALUES (${[f.id, f.label, f.hint, f.group].map(sqlText).join(', ')}, ${firstSort + i}, ${f.off ? 0 : 1})`,
  )
}

export const SEEDS: Seed[] = [
  {
    id: 'features-v1',
    since: 5,
    statements: featureRows(DEFAULT_FEATURES, 0),
  },
  {
    id: 'features-v2',
    since: Infinity,
    statements: featureRows(FEATURES_V2, DEFAULT_FEATURES.length),
  },
  // A switch added after features-v1 shipped gets its own seed, so phones that ran v1 still receive it.
  {
    id: 'features-growth-v1',
    since: Infinity,
    statements: [
      `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) SELECT 'growth', 'Growth', 'Weight, length and head size', 'Log', COALESCE(MAX(sort), 0) + 1, 1 FROM features`,
    ],
  },
  {
    id: 'growthRef-v1',
    since: Infinity,
    statements: WHO_GROWTH_REFERENCE.map(
      ([sex, kind, month, l, m, sd]) =>
        `INSERT OR IGNORE INTO growth_reference (sex, kind, month, l, m, s) VALUES (${sqlText(sex)}, ${sqlText(kind)}, ${month}, ${l}, ${m}, ${sd})`,
    ),
  },
  {
    id: 'milestones-v1',
    since: Infinity,
    statements: DEFAULT_MILESTONES.map(
      (m) =>
        `INSERT OR IGNORE INTO milestone (id, age_months, area, text, sort) VALUES (${sqlText(m.id)}, ${m.ageMonths}, ${sqlText(m.area)}, ${sqlText(m.text)}, ${m.sort})`,
    ),
  },
  {
    id: 'features-milestones-v1',
    since: Infinity,
    statements: [
      `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) SELECT 'milestones', 'Milestones', 'CDC milestone checklists by age', 'Tabs', COALESCE(MAX(sort), 0) + 1, 1 FROM features`,
    ],
  },
  {
    id: 'sleepNeed-v1',
    since: Infinity,
    statements: DEFAULT_SLEEP_NEEDS.map(
      (n) => `INSERT OR IGNORE INTO sleep_need (from_weeks, to_weeks, low_hours, high_hours) VALUES (${n.fromWeeks}, ${n.toWeeks}, ${n.lowHours}, ${n.highHours})`,
    ),
  },
  // Automatic is on for a phone still on the starting goal of 14 hours, and off for one whose parent chose their own number.
  {
    id: 'sleepGoalAuto-v1',
    since: Infinity,
    statements: [
      "INSERT OR IGNORE INTO settings (key, value) SELECT 'sleepGoalAuto', CASE WHEN COALESCE((SELECT value FROM settings WHERE key = 'sleepGoalHours'), '14') = '14' THEN 'on' ELSE 'off' END",
    ],
  },
  {
    id: 'features-sleepcheck-v1',
    since: Infinity,
    statements: [
      `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) SELECT 'alertSleepCheck', 'Sleep check', 'When a nap runs long or the sleep log looks wrong', 'Notifications', COALESCE(MAX(sort), 0) + 1, 1 FROM features`,
    ],
  },
  {
    id: 'features-insights-v1',
    since: Infinity,
    statements: [
      `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) SELECT 'aiInsights', 'Insights', 'Short notes from the assistant about growth, milestones and sleep', 'Today', COALESCE(MAX(sort), 0) + 1, 1 FROM features`,
      `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) SELECT 'alertInsights', 'New insight', 'A note when the assistant has something new', 'Notifications', COALESCE(MAX(sort), 0) + 1, 1 FROM features`,
    ],
  },
  {
    id: 'vaccineTypes-v1',
    since: Infinity,
    statements: DEFAULT_VACCINE_TYPES.map(
      (t, i) => `INSERT OR IGNORE INTO vaccine_type (id, label, sort) VALUES (${sqlText(t.id)}, ${sqlText(t.label)}, ${i})`,
    ),
  },
  {
    id: 'features-vaccines-v1',
    since: Infinity,
    statements: [
      `INSERT OR IGNORE INTO features (id, label, hint, grp, sort, enabled) SELECT 'vaccines', 'Vaccines', 'Vaccination record and the CDC schedule for the age', 'Log', COALESCE(MAX(sort), 0) + 1, 1 FROM features`,
    ],
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
