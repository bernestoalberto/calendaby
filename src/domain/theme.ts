import { z } from 'zod'

/** Where a parent can restyle the app. The ids match the `data-sec` hooks in the UI. */
export const SECTIONS = [
  { id: 'topbar', label: 'Top bar', hint: 'Baby name and avatar' },
  { id: 'status', label: 'Awake / asleep pill', hint: 'The status at the top of Today' },
  { id: 'nap', label: 'Next nap card', hint: 'Prediction and ring' },
  { id: 'quick', label: 'Quick buttons', hint: 'Sleep, diaper, feed, meds, note' },
  { id: 'composer', label: 'Say-it box', hint: 'Type or speak to log' },
  { id: 'last', label: 'Last sleep / feed / diaper cards', hint: 'The summary cards' },
  { id: 'totals', label: "Today's totals", hint: 'Sleep goal, feeds and diapers' },
  { id: 'advice', label: 'Advice', hint: 'Predictions and tips' },
  { id: 'handoff', label: 'Handoff card', hint: 'Share with the next caregiver' },
  { id: 'nav', label: 'Bottom bar', hint: 'Tabs and the Log button' },
] as const

export type SectionId = (typeof SECTIONS)[number]['id']

// Strict hex only: the value ends up in a style attribute, so nothing else may pass.
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const Shape = z.enum(['sharp', 'soft', 'round'])
export const Look = z.enum(['default', 'tint', 'solid', 'outline'])
export type Shape = z.infer<typeof Shape>
export type Look = z.infer<typeof Look>

const SectionStyle = z.object({ color: Hex.optional(), look: Look.optional(), shape: Shape.optional() })
export type SectionStyle = z.infer<typeof SectionStyle>

export const Theme = z.object({
  mode: z.enum(['auto', 'light', 'dark']).catch('auto'),
  accent: Hex.optional().catch(undefined),
  shape: Shape.catch('round'),
  density: z.enum(['compact', 'cozy', 'roomy']).catch('cozy'),
  size: z.enum(['small', 'medium', 'large']).catch('medium'),
  font: z.enum(['default', 'system', 'serif']).catch('default'),
  depth: z.enum(['flat', 'soft', 'lifted']).catch('soft'),
  // Keys are read loosely, then filtered, so one stale id (a removed section) cannot discard the rest.
  sections: z
    .record(z.string(), SectionStyle.catch({}))
    .catch({})
    .transform((all) => {
      const known: Partial<Record<SectionId, SectionStyle>> = {}
      for (const id of SECTIONS.map((s) => s.id)) if (all[id]) known[id] = all[id]
      return known
    }),
})
export type Theme = z.infer<typeof Theme>

/** The look the app shipped with: no overrides at all. */
export const DEFAULT_THEME: Theme = Theme.parse({})

/** Stored theme text to a safe theme. Anything unreadable falls back to the default rather than blocking the app. */
export function parseTheme(raw: string | undefined): Theme {
  if (!raw) return DEFAULT_THEME
  try {
    return Theme.parse(JSON.parse(raw))
  } catch {
    // A corrupt or hand-edited value must never stop the app opening; the default look is the safe answer.
    return DEFAULT_THEME
  }
}

const SHAPES: Record<Shape, Record<string, string>> = {
  sharp: { '--r-card': '8px', '--r-tile': '8px', '--r-pill': '10px', '--r-round': '10px' },
  soft: { '--r-card': '16px', '--r-tile': '14px', '--r-pill': '16px', '--r-round': '16px' },
  round: { '--r-card': '24px', '--r-tile': '20px', '--r-pill': '999px', '--r-round': '50%' },
}

const FONTS = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
}

function channel(hex: string, from: number): number {
  return Number.parseInt(hex.slice(from, from + 2), 16) / 255
}

/**
 * Keeps a picked colour readable: white text must sit on the solid look and the derived tints must stay visible,
 * so very light or very dark picks are pulled toward the middle while keeping their hue.
 */
export function readableAccent(hex: string): string {
  const [r, g, b] = [channel(hex, 1), channel(hex, 3), channel(hex, 5)]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  const L = Math.min(0.52, Math.max(0.3, l))
  const S = Math.min(1, Math.max(0.25, s))
  const c = (1 - Math.abs(2 * L - 1)) * S
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = L - c / 2
  const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6]
  const out = [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0'))
  return `#${out.join('')}`
}

export interface ThemeCss {
  attrs: Record<string, string>
  style: Record<string, string>
}

/** Page-wide settings as attributes and CSS variables for the root element. The default theme yields nothing. */
export function themeVars(theme: Theme): ThemeCss {
  const attrs: Record<string, string> = {}
  const style: Record<string, string> = {}
  if (theme.mode !== 'auto') attrs['data-theme'] = theme.mode
  if (theme.accent) {
    attrs['data-accent'] = ''
    style['--accent'] = readableAccent(theme.accent)
  }
  if (theme.shape !== 'round') Object.assign(style, SHAPES[theme.shape])
  if (theme.density === 'compact') Object.assign(style, { '--gap': '10px', '--pad': '12px' })
  if (theme.density === 'roomy') Object.assign(style, { '--gap': '22px', '--pad': '22px' })
  if (theme.size === 'small') style['--zoom'] = '0.92'
  if (theme.size === 'large') style['--zoom'] = '1.12'
  if (theme.font !== 'default') style['--font'] = FONTS[theme.font]
  if (theme.depth === 'flat') Object.assign(style, { '--shadow': 'none', '--shadow-up': 'none' })
  if (theme.depth === 'lifted') {
    Object.assign(style, {
      '--shadow': '0 12px 28px -6px rgb(0 0 0 / 0.2)',
      '--shadow-up': '0 18px 40px -6px rgb(0 0 0 / 0.3)',
    })
  }
  return { attrs, style }
}

/** One section's overrides. Empty when the parent has not touched it, so the page-wide look applies. */
export function sectionVars(theme: Theme, id: SectionId): ThemeCss {
  const own = theme.sections[id] ?? {}
  const attrs: Record<string, string> = { 'data-sec': id }
  const style: Record<string, string> = {}
  if (own.color) {
    attrs['data-accent'] = ''
    style['--accent'] = readableAccent(own.color)
  }
  if (own.look && own.look !== 'default') attrs['data-look'] = own.look
  if (own.shape) Object.assign(style, SHAPES[own.shape])
  return { attrs, style }
}
