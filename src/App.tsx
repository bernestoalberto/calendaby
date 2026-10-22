import { useEffect, useMemo, useState } from 'react'
import { RuleCaptureAgent } from './agents/capture'
import { buildHandoff, handoffText } from './agents/handoff'
import type { BabyEvent } from './domain/events'
import { DuplicateEventError, LocalEventStore } from './domain/store'
import { useSpeech } from './useSpeech'
import './App.css'

const store = new LocalEventStore()
const capture = new RuleCaptureAgent()
const CAREGIVER_KEY = 'calendaby.caregiver'

function describe(e: BabyEvent): string {
  switch (e.kind) {
    case 'feed':
      return `Feed, ${e.method}${e.amountMl ? `, ${e.amountMl} ml` : ''}${e.side ? `, ${e.side}` : ''}`
    case 'sleep':
      return e.phase === 'start' ? 'Fell asleep' : 'Woke up'
    case 'diaper':
      return `Diaper, ${e.contents}`
    case 'med':
      return `Medicine, ${e.name}${e.doseMl ? ` ${e.doseMl} ml` : ''}`
    case 'note':
      return e.note
  }
}

function readCaregiver(): string {
  try {
    return localStorage.getItem(CAREGIVER_KEY) ?? 'Dad'
  } catch {
    return 'Dad'
  }
}

export default function App() {
  const [events, setEvents] = useState(() => store.list())
  const [text, setText] = useState('')
  const [caregiver, setCaregiver] = useState(readCaregiver)
  const [messages, setMessages] = useState<string[]>([])
  const [showHandoff, setShowHandoff] = useState(false)
  const speech = useSpeech((heard) => setText((t) => (t ? `${t}, ${heard}` : heard)))

  // Ticks each minute so "asleep for 40 min" stays current without a reload.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const brief = useMemo(() => buildHandoff(events, new Date(now)), [events, now])

  async function log() {
    if (!text.trim()) return
    const { drafts, unsure } = await capture.capture(text, new Date())
    const notes: string[] = []
    for (const d of drafts) {
      try {
        store.append(d, caregiver)
      } catch (err) {
        notes.push(err instanceof DuplicateEventError ? err.message : `Skipped a ${d.kind}: ${String(err)}`)
      }
    }
    for (const u of unsure) notes.push(`Didn't understand "${u}"`)
    setEvents(store.list())
    setNow(Date.now())
    setMessages(notes)
    // Keep only what still needs the parent's attention in the box.
    setText(unsure.join(', '))
  }

  function changeCaregiver(name: string) {
    setCaregiver(name)
    try {
      localStorage.setItem(CAREGIVER_KEY, name)
    } catch {
      // Private mode: keep it for this session only.
    }
  }

  async function shareHandoff() {
    const body = handoffText(brief)
    if (navigator.share) await navigator.share({ title: 'Baby handoff', text: body }).catch(() => {})
    else await navigator.clipboard?.writeText(body)
  }

  const today = [...events].reverse().slice(0, 30)

  return (
    <main>
      <header>
        <h1>Calendaby</h1>
        <label>
          Logging as{' '}
          <input value={caregiver} onChange={(e) => changeCaregiver(e.target.value)} size={8} />
        </label>
      </header>

      <section className="status">
        <strong>{brief.headline}</strong>
        <span>{brief.lines[0]}</span>
      </section>

      <form
        className="capture"
        onSubmit={(e) => {
          e.preventDefault()
          void log()
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="fed 120 ml at 3, she's down now"
          rows={2}
        />
        <div className="actions">
          {speech.supported && (
            <button type="button" onClick={speech.listening ? speech.stop : speech.start}>
              {speech.listening ? 'Stop' : 'Speak'}
            </button>
          )}
          <button type="submit">Log it</button>
        </div>
        {messages.map((m) => (
          <p key={m} className="hint">
            {m}
          </p>
        ))}
      </form>

      <section>
        <div className="row">
          <h2>Handoff</h2>
          <button type="button" onClick={() => setShowHandoff((s) => !s)}>
            {showHandoff ? 'Hide' : 'Show'}
          </button>
          {showHandoff && (
            <button type="button" onClick={() => void shareHandoff()}>
              Share
            </button>
          )}
        </div>
        {showHandoff && <pre className="handoff">{handoffText(brief)}</pre>}
      </section>

      <section>
        <h2>Recent</h2>
        {today.length === 0 && <p className="hint">Nothing logged yet.</p>}
        <ul className="timeline">
          {today.map((e) => (
            <li key={e.id}>
              <time>{new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
              <span>{describe(e)}</span>
              <small>{e.loggedBy}</small>
              <button
                type="button"
                aria-label="Delete"
                onClick={() => {
                  store.remove(e.id)
                  setEvents(store.list())
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
