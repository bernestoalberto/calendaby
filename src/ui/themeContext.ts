import { createContext, useContext, type CSSProperties } from 'react'
import { DEFAULT_THEME, sectionVars, themeVars, type SectionId, type Theme } from '../domain/theme'

export const ThemeContext = createContext<Theme>(DEFAULT_THEME)

export function sectionProps(theme: Theme, id: SectionId): Record<string, unknown> {
  const { attrs, style } = sectionVars(theme, id)
  return Object.keys(style).length ? { ...attrs, style: style as CSSProperties } : attrs
}

/** Spread onto a section's root element: `<section {...useSection('nap')}>`. */
export function useSection(id: SectionId): Record<string, unknown> {
  return sectionProps(useContext(ThemeContext), id)
}

let applied: { attrs: string[]; style: string[] } = { attrs: [], style: [] }

/** Writes the page-wide theme onto <html>, first removing whatever the previous theme set. */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  for (const a of applied.attrs) root.removeAttribute(a)
  for (const s of applied.style) root.style.removeProperty(s)
  const { attrs, style } = themeVars(theme)
  for (const [k, v] of Object.entries(attrs)) root.setAttribute(k, v)
  for (const [k, v] of Object.entries(style)) root.style.setProperty(k, v)
  applied = { attrs: Object.keys(attrs), style: Object.keys(style) }
}
