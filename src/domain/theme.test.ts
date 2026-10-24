import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, parseTheme, readableAccent, sectionVars, Theme, themeVars } from './theme'

describe('parseTheme', () => {
  it('gives the shipped look when nothing is stored or the value is unreadable', () => {
    expect(parseTheme(undefined)).toEqual(DEFAULT_THEME)
    expect(parseTheme('not json')).toEqual(DEFAULT_THEME)
    expect(parseTheme('[1,2]')).toEqual(DEFAULT_THEME)
  })

  it('drops invalid fields one by one and keeps the valid ones', () => {
    const t = parseTheme(
      JSON.stringify({
        mode: 'dark',
        accent: 'red; background: url(x)',
        shape: 'blob',
        sections: { nap: { color: '#112233', look: 'solid' }, ghost: { color: '#000000' }, totals: { look: 'weird' } },
      }),
    )
    expect(t.mode).toBe('dark')
    expect(t.accent).toBeUndefined()
    expect(t.shape).toBe('round')
    expect(t.sections.nap).toEqual({ color: '#112233', look: 'solid' })
    expect(t.sections.totals).toEqual({})
    expect(Object.keys(t.sections)).not.toContain('ghost')
  })
})

describe('themeVars', () => {
  it('emits nothing for the default theme so the original palette stays untouched', () => {
    expect(themeVars(DEFAULT_THEME)).toEqual({ attrs: {}, style: {} })
  })

  it('maps each page-wide choice to attributes and variables', () => {
    const t = Theme.parse({ mode: 'light', accent: '#1e6fd9', shape: 'sharp', density: 'compact', size: 'large', depth: 'flat', font: 'serif' })
    const { attrs, style } = themeVars(t)
    expect(attrs).toEqual({ 'data-theme': 'light', 'data-accent': '' })
    expect(style['--r-card']).toBe('8px')
    expect(style['--gap']).toBe('10px')
    expect(style['--zoom']).toBe('1.12')
    expect(style['--shadow']).toBe('none')
    expect(style['--font']).toContain('Georgia')
    expect(style['--accent']).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe('sectionVars', () => {
  it('only marks the section when it has no overrides', () => {
    expect(sectionVars(DEFAULT_THEME, 'nap')).toEqual({ attrs: { 'data-sec': 'nap' }, style: {} })
  })

  it('carries a section colour, look and shape', () => {
    const t = Theme.parse({ sections: { nap: { color: '#e5533d', look: 'outline', shape: 'soft' } } })
    const { attrs, style } = sectionVars(t, 'nap')
    expect(attrs).toMatchObject({ 'data-sec': 'nap', 'data-accent': '', 'data-look': 'outline' })
    expect(style['--r-card']).toBe('16px')
    expect(style['--accent']).toMatch(/^#[0-9a-f]{6}$/)
    expect(sectionVars(t, 'totals').attrs).toEqual({ 'data-sec': 'totals' })
  })

  it('lets a round section sit inside a sharp page', () => {
    const t = Theme.parse({ shape: 'sharp', sections: { quick: { shape: 'round' } } })
    expect(sectionVars(t, 'quick').style['--r-round']).toBe('50%')
  })
})

describe('readableAccent', () => {
  const lightness = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
  }

  it('pulls near-white and near-black picks toward the middle', () => {
    expect(lightness(readableAccent('#ffffcc'))).toBeLessThanOrEqual(0.53)
    expect(lightness(readableAccent('#050505'))).toBeGreaterThanOrEqual(0.29)
  })

  it('leaves a mid-tone pick alone', () => {
    expect(readableAccent('#673ab7')).toBe('#673ab7')
  })
})
