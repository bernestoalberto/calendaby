import { DEFAULT_THEME, SECTIONS, type Look, type SectionId, type SectionStyle, type Shape, type Theme } from '../domain/theme'
import { Segmented } from './controls'

// Starting points only; the colour picker next to them takes any colour.
const SWATCHES = [
  { name: 'Lavender', hex: '#673ab7' },
  { name: 'Ocean', hex: '#1e6fd9' },
  { name: 'Teal', hex: '#00897b' },
  { name: 'Meadow', hex: '#43a047' },
  { name: 'Sunshine', hex: '#e59a00' },
  { name: 'Coral', hex: '#e5533d' },
  { name: 'Rose', hex: '#d81b60' },
  { name: 'Slate', hex: '#546e7a' },
]

const SHAPE_OPTIONS = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'soft', label: 'Soft' },
  { value: 'round', label: 'Round' },
] as const

const LOOK_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'tint', label: 'Tint' },
  { value: 'solid', label: 'Solid' },
  { value: 'outline', label: 'Outline' },
] as const

interface Props {
  theme: Theme
  onTheme: (t: Theme) => void
}

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="appearance-row">
      <span className="field-label">{props.label}</span>
      {props.children}
    </div>
  )
}

export function Appearance({ theme, onTheme }: Readonly<Props>) {
  const set = <K extends keyof Theme>(key: K, value: Theme[K]) => onTheme({ ...theme, [key]: value })

  function setSection(id: SectionId, patch: Partial<SectionStyle>) {
    const next: SectionStyle = { ...theme.sections[id], ...patch }
    // An undefined field means "back to the page-wide look", so it is dropped rather than stored.
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) as SectionStyle
    const sections = { ...theme.sections }
    if (Object.keys(clean).length) sections[id] = clean
    else delete sections[id]
    onTheme({ ...theme, sections })
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h3>Look &amp; feel</h3>
          <button type="button" className="link" onClick={() => onTheme(DEFAULT_THEME)}>
            Reset all
          </button>
        </div>
        <p className="muted">Changes show right away and stay on this phone.</p>

        <Row label="Mode">
          <Segmented
            value={theme.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Night' },
            ]}
          />
        </Row>

        <Row label="Main colour">
          <div className="swatches">
            {SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                className="swatch"
                style={{ background: s.hex }}
                aria-label={s.name}
                aria-pressed={theme.accent === s.hex}
                onClick={() => set('accent', s.hex)}
              />
            ))}
            <input
              type="color"
              className="swatch picker"
              aria-label="Pick any colour"
              value={theme.accent ?? '#673ab7'}
              onChange={(e) => set('accent', e.target.value)}
            />
            {theme.accent && (
              <button type="button" className="link" onClick={() => set('accent', undefined)}>
                Original
              </button>
            )}
          </div>
        </Row>

        <Row label="Corners">
          <Segmented value={theme.shape} onChange={(v) => set('shape', v)} options={[...SHAPE_OPTIONS]} />
        </Row>
        <Row label="Spacing">
          <Segmented
            value={theme.density}
            onChange={(v) => set('density', v)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'cozy', label: 'Cozy' },
              { value: 'roomy', label: 'Roomy' },
            ]}
          />
        </Row>
        <Row label="Size">
          <Segmented
            value={theme.size}
            onChange={(v) => set('size', v)}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
          />
        </Row>
        <Row label="Font">
          <Segmented
            value={theme.font}
            onChange={(v) => set('font', v)}
            options={[
              { value: 'default', label: 'Default' },
              { value: 'system', label: 'System' },
              { value: 'serif', label: 'Serif' },
            ]}
          />
        </Row>
        <Row label="Shadows">
          <Segmented
            value={theme.depth}
            onChange={(v) => set('depth', v)}
            options={[
              { value: 'flat', label: 'Flat' },
              { value: 'soft', label: 'Soft' },
              { value: 'lifted', label: 'Lifted' },
            ]}
          />
        </Row>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Sections</h3>
        </div>
        <p className="muted">Give a part of the app its own colour, fill and corners. Anything you leave alone follows the look above.</p>
        {SECTIONS.map((s) => {
          const own = theme.sections[s.id]
          return (
            <details key={s.id} className="section-style">
              <summary>
                <span>
                  <b>{s.label}</b>
                  <small className="muted">{s.hint}</small>
                </span>
                <span className="swatch dot" style={{ background: own?.color ?? 'transparent' }} aria-hidden="true" />
              </summary>
              <Row label="Colour">
                <div className="swatches">
                  <input
                    type="color"
                    className="swatch picker"
                    aria-label={`${s.label} colour`}
                    value={own?.color ?? theme.accent ?? '#673ab7'}
                    onChange={(e) => setSection(s.id, { color: e.target.value })}
                  />
                  {own?.color && (
                    <button type="button" className="link" onClick={() => setSection(s.id, { color: undefined })}>
                      Use main colour
                    </button>
                  )}
                </div>
              </Row>
              <Row label="Fill">
                <Segmented
                  value={own?.look ?? 'default'}
                  onChange={(v: Look) => setSection(s.id, { look: v === 'default' ? undefined : v })}
                  options={[...LOOK_OPTIONS]}
                />
              </Row>
              <Row label="Corners">
                <Segmented
                  value={own?.shape ?? 'page'}
                  onChange={(v: Shape | 'page') => setSection(s.id, { shape: v === 'page' ? undefined : v })}
                  options={[{ value: 'page', label: 'Like page' }, ...SHAPE_OPTIONS]}
                />
              </Row>
              {own && (
                <button type="button" className="link" onClick={() => setSection(s.id, { color: undefined, look: undefined, shape: undefined })}>
                  Reset this section
                </button>
              )}
            </details>
          )
        })}
      </section>
    </>
  )
}
