import { z } from 'zod'

/** The settings every caregiver in a household sees. Everything else (theme, units, reminders) stays on the phone. */
export const SHARED_KEYS = ['baby', 'birth', 'tummyGoal'] as const
export type SharedKey = (typeof SHARED_KEYS)[number]

export function isSharedKey(key: string): key is SharedKey {
  return (SHARED_KEYS as readonly string[]).includes(key)
}

const RULES: Record<SharedKey, z.ZodType<string>> = {
  baby: z.string().trim().min(1).max(40),
  birth: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  tummyGoal: z.string().regex(/^\d{1,3}$/),
}

const Key = z.enum(SHARED_KEYS)

function check(s: { key: SharedKey; value: string }, ctx: z.RefinementCtx) {
  if (!RULES[s.key].safeParse(s.value).success) ctx.addIssue({ code: 'custom', message: `Not a valid ${s.key}`, path: ['value'] })
}

export const SharedSetting = z.object({ key: Key, value: z.string().max(60) }).superRefine(check)
export type SharedSetting = z.infer<typeof SharedSetting>

/** A phone's update. `onlyIfMissing` is for a phone that just joined: it fills gaps but never overrides the family's values. */
export const SettingChange = z
  .object({ key: Key, value: z.string().max(60), onlyIfMissing: z.boolean() })
  .superRefine(check)
export type SettingChange = z.infer<typeof SettingChange>
