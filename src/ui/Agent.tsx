import { useEffect, useRef, useState } from 'react'
import { useSpeech } from '../useSpeech'
import { Badge } from './controls'
import { CheckIcon, MicIcon, SendIcon, SparkIcon } from './icons'
import { Reply } from './Reply'

export type Chat = { role: 'you' | 'agent'; text: string; logged?: string[] }

interface Props {
  baby: string
  chat: Chat[]
  busy: boolean
  online?: boolean
  onSend: (text: string) => void
}

export function Agent({ baby, chat, busy, online, onSend }: Readonly<Props>) {
  const [text, setText] = useState('')
  const speech = useSpeech((heard) => setText((t) => (t ? `${t}, ${heard}` : heard)))
  const end = useRef<HTMLDivElement>(null)
  const suggestions = [
    `Predict the rest of ${baby}'s day and advise me`,
    `Analyze ${baby}'s sleep & feeding patterns`,
    `How much has ${baby} eaten and slept today?`,
    'When should bedtime be tonight based on recent logs?',
  ]

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length, busy])

  function send(value: string) {
    if (!value.trim() || busy) return
    onSend(value.trim())
    setText('')
  }

  return (
    <div className="stack agent">
      <div className="logger-head">
        <span className="round-icon lilac big">
          <SparkIcon />
        </span>
        <div>
          <h2>
            Calendaby Agent{' '}
            {online !== undefined && <Badge tone={online ? 'sage' : 'oat'}>{online ? 'Online' : 'Offline'}</Badge>}
          </h2>
          <p>Baby questions, answered from your logs</p>
        </div>
      </div>

      {chat.length === 0 && (
        <section className="card agent-intro">
          <p>
            Ask about {baby}'s day or general baby care. Questions about the day are answered from what you have logged. It is not a doctor: for anything
            worrying, call your pediatrician.
          </p>
          <div className="chips">
            {suggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      <ol className="chat">
        {chat.map((m) => (
          <li key={`${m.role}:${m.text}`} className={`bubble ${m.role}`}>
            {m.role === 'agent' ? <Reply text={m.text} /> : m.text}
            {m.logged && m.logged.length > 0 && (
              <span className="logged">
                {m.logged.map((l) => (
                  <span key={l}>
                    <CheckIcon width={14} height={14} /> {l}
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
        {busy && <li className="bubble agent typing">Thinking…</li>}
      </ol>
      <div ref={end} />

      <form
        className="composer agent-composer"
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a baby question" aria-label="Message" />
        {speech.supported && (
          <button
            type="button"
            className={speech.listening ? 'icon-button listening' : 'icon-button'}
            aria-label={speech.listening ? 'Stop listening' : 'Speak'}
            onClick={speech.listening ? speech.stop : speech.start}
          >
            <MicIcon />
          </button>
        )}
        <button type="submit" className="icon-button send" aria-label="Send" disabled={busy || !text.trim()}>
          <SendIcon width={20} height={20} />
        </button>
      </form>
    </div>
  )
}
