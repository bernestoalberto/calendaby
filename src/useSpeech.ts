import { useEffect, useRef, useState } from 'react'

// The Web Speech API is not in the TS DOM lib; type only what we use.
interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Voice capture for the PWA. Native builds can swap in a Capacitor speech plugin behind the same shape. */
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  const Ctor = getCtor()

  function start() {
    if (!Ctor) return
    const r = new Ctor()
    r.lang = navigator.language || 'en-US'
    r.interimResults = false
    r.onresult = (e) => {
      const heard = Array.from(e.results)
        .map((res) => res[0].transcript)
        .join(' ')
        .trim()
      if (heard) onTextRef.current(heard)
    }
    r.onend = () => setListening(false)
    rec.current = r
    r.start()
    setListening(true)
  }

  function stop() {
    rec.current?.stop()
  }

  return { supported: Boolean(Ctor), listening, start, stop }
}
