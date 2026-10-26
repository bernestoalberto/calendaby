import { useEffect, useState } from 'react'
import { readAloud, readAloudSupported, stopReading } from '../readAloud'

/** Reads text out loud, for a parent whose hands or eyes are busy; hidden on devices without speech. */
export function Listen({ text }: Readonly<{ text: string }>) {
  const [reading, setReading] = useState(false)

  // Leaving the screen must not leave a voice talking.
  useEffect(() => () => stopReading(), [])

  if (!readAloudSupported() || text.trim() === '') return null

  function toggle() {
    if (reading) {
      stopReading()
      setReading(false)
      return
    }
    setReading(true)
    readAloud(text, () => setReading(false))
  }

  return (
    <button type="button" className="listen" aria-pressed={reading} onClick={toggle}>
      {reading ? 'Stop' : 'Listen'}
    </button>
  )
}
