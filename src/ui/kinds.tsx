import type { BabyEvent } from '../domain/events'
import { BottleIcon, BreastIcon, DiaperIcon, MoonIcon, NoteIcon, PillIcon, SunIcon } from './icons'
import { formatAmount, type Unit } from './time'

export function eventIcon(e: BabyEvent) {
  switch (e.kind) {
    case 'feed':
      return e.method === 'breast' ? <BreastIcon /> : <BottleIcon />
    case 'sleep':
      return e.phase === 'start' ? <MoonIcon /> : <SunIcon />
    case 'diaper':
      return <DiaperIcon />
    case 'med':
      return <PillIcon />
    case 'note':
      return <NoteIcon />
  }
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

export function eventTitle(e: BabyEvent, unit: Unit = 'ml'): string {
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
  }
}

export function eventHeading(e: BabyEvent): string {
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
    default:
      return ''
  }
}

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
