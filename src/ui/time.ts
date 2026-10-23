export function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): number | undefined {
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? undefined : ms
}

export function ago(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ${mins % 60}m ago`
  return `${Math.floor(h / 24)}d ago`
}

export function duration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(mins / 60)
  return h ? `${h}h ${mins % 60}m` : `${mins}m`
}

export const OZ = 29.5735

export type Unit = 'oz' | 'ml'

export function formatAmount(ml: number, unit: Unit): string {
  return unit === 'oz' ? `${Math.round((ml / OZ) * 4) / 4}oz` : `${Math.round(ml)} ml`
}

export function stopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function babyAge(birth: string, now: number): string | undefined {
  const b = new Date(`${birth}T00:00`)
  if (Number.isNaN(b.getTime()) || b.getTime() > now) return undefined
  const n = new Date(now)
  let months = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth()
  if (n.getDate() < b.getDate()) months--
  const anchor = new Date(b)
  anchor.setMonth(b.getMonth() + months)
  const days = Math.floor((n.getTime() - anchor.getTime()) / 86_400_000)
  if (months <= 0) return days < 14 ? `${days}d` : `${Math.floor(days / 7)}w ${days % 7}d`
  return `${months}m ${days}d`
}
