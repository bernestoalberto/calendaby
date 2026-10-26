import { activityLabel, DEFAULT_ACTIVITY_TYPES, type ActivityType } from '../domain/activities'
import type { BabyEvent } from '../domain/events'
import { formatAmount, type Unit } from './time'

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export function eventTitle(e: BabyEvent, unit: Unit = 'ml', types: ActivityType[] = DEFAULT_ACTIVITY_TYPES): string {
  switch (e.kind) {
    case 'feed':
      if (e.method === 'breast') return `Nursing${e.durationMin ? ` · ${e.durationMin}m` : e.side ? `, ${e.side}` : ''}`
      if (e.method === 'solids') return 'Solids'
      return `Bottle${e.amountMl ? ` · ${formatAmount(e.amountMl, unit)}` : ''}`
    case 'sleep':
      return e.phase === 'start' ? 'Fell asleep' : 'Woke up'
    case 'diaper':
      return e.contents === 'both' ? 'Diaper · wet + dirty' : `Diaper · ${e.contents}`
    case 'med':
      return `${titleCase(e.name)}${e.doseMl ? ` · ${e.doseMl} ml` : ''}`
    case 'note':
      return e.note
    case 'activity':
      return `${activityLabel(types, e.type)}${e.durationMin ? ` · ${e.durationMin}m` : ''}`
    case 'pump':
      return `Pumped${e.amountMl ? ` · ${formatAmount(e.amountMl, unit)}` : ''}`
  }
}

export function eventHeading(e: BabyEvent, types: ActivityType[] = DEFAULT_ACTIVITY_TYPES): string {
  switch (e.kind) {
    case 'feed':
      return e.method === 'breast' ? 'Nursing Feed' : e.method === 'solids' ? 'Solids' : 'Bottle Feed'
    case 'sleep':
      return e.phase === 'start' ? 'Fell Asleep' : 'Woke Up'
    case 'diaper':
      return 'Diaper Change'
    case 'med':
      return titleCase(e.name)
    case 'note':
      return 'Note'
    case 'activity':
      return activityLabel(types, e.type)
    case 'pump':
      return 'Pumping'
  }
}

export function eventDetail(e: BabyEvent, unit: Unit): string {
  switch (e.kind) {
    case 'feed': {
      if (e.method === 'breast') return e.durationMin ? `Total duration: ${e.durationMin} mins` : e.side ? `${titleCase(e.side)} side` : 'Nursing'
      if (e.method === 'solids') return 'Solids'
      const milk = e.milk === 'formula' ? 'Formula' : e.milk === 'breastmilk' ? 'Breast milk' : 'Bottle'
      return e.amountMl ? `${milk} · ${formatAmount(e.amountMl, unit)}` : milk
    }
    case 'diaper':
      return e.contents === 'both' ? 'Wet & Dirty' : titleCase(e.contents)
    case 'med':
      return e.doseMl ? `${e.doseMl} ml` : 'Given'
    case 'activity':
      return e.durationMin ? `${e.durationMin} mins` : 'Logged'
    case 'pump': {
      const parts = [e.amountMl ? formatAmount(e.amountMl, unit) : '', e.side ? `${titleCase(e.side)} side` : '', e.durationMin ? `${e.durationMin} mins` : '']
      return parts.filter(Boolean).join(' · ') || 'Logged'
    }
    default:
      return ''
  }
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
