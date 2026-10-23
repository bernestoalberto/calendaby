import type { ReactNode } from 'react'
import { CloseIcon } from './icons'

export function Sheet(props: { title: string; onClose: () => void; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="sheet" role="dialog" aria-label={props.title}>
      <header className="sheet-header">
        <button type="button" className="icon-button" aria-label="Close" onClick={props.onClose}>
          <CloseIcon />
        </button>
        <h2>{props.title}</h2>
        <span className="icon-button" />
      </header>
      <div className="sheet-body">{props.children}</div>
      {props.footer && <footer className="sheet-footer">{props.footer}</footer>}
    </div>
  )
}

export function Segmented<T extends string>(props: {
  options: { label: ReactNode; value: T }[]
  value: T
  onChange: (v: T) => void
  variant?: 'pills' | 'track' | 'mini'
  label?: string
}) {
  return (
    <div className={`segmented ${props.variant ?? 'track'}`} role="tablist" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === props.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TagChips(props: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {props.options.map((o) => {
        const on = props.value.includes(o)
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            className={on ? 'chip on' : 'chip'}
            onClick={() => props.onChange(on ? props.value.filter((v) => v !== o) : [...props.value, o])}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

export function Badge(props: { tone?: 'lilac' | 'sage' | 'oat'; children: ReactNode }) {
  return <span className={`badge ${props.tone ?? 'oat'}`}>{props.children}</span>
}
