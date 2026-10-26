import { Capacitor } from '@capacitor/core'
import { SpeechRecognition as NativeSpeech } from '@capgo/capacitor-speech-recognition'
import { useEffect, useRef, useState } from 'react'
import { cleanSpoken } from './domain/spoken'
import { speechProblem } from './speechErrors'

// The Web Speech API is not in the TS DOM lib; type only what we use.
interface Recognition {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const native = Capacitor.isNativePlatform()

/** Voice capture: the Web Speech API in the PWA, the device recognizer in the Android and iOS shells (WebView has none). */
export function useSpeech(onText: (text: string) => void, onProblem?: (message: string) => void) {
  const [listening, setListening] = useState(false)
  const [nativeReady, setNativeReady] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  const onProblemRef = useRef(onProblem)
  useEffect(() => {
    onTextRef.current = onText
    onProblemRef.current = onProblem
  }, [onText, onProblem])

  useEffect(() => {
    if (!native) return
    NativeSpeech.available().then(
      ({ available }) => setNativeReady(available),
      () => setNativeReady(false),
    )
  }, [])

  const Ctor = native ? undefined : getCtor()

  async function startNative() {
    const access = await NativeSpeech.requestPermissions()
    if (access.speechRecognition !== 'granted') {
      onProblemRef.current?.('Allow microphone access in Settings to log by voice.')
      return
    }
    setListening(true)
    try {
      const { matches } = await NativeSpeech.start({ language: navigator.language || 'en-US', partialResults: false, popup: false })
      const heard = cleanSpoken(matches?.[0] ?? '')
      if (heard) onTextRef.current(heard)
    } catch {
      onProblemRef.current?.("Couldn't hear that. Try again.")
    } finally {
      setListening(false)
    }
  }

  function start() {
    if (native) {
      void startNative()
      return
    }
    if (!Ctor || listening) return
    const r = new Ctor()
    r.lang = navigator.language || 'en-US'
    r.interimResults = false
    r.onresult = (e) => {
      const heard = cleanSpoken(Array.from(e.results).map((res) => res[0].transcript).join(' '))
      if (heard) onTextRef.current(heard)
    }
    r.onerror = (e) => {
      const message = speechProblem(e.error)
      if (message) onProblemRef.current?.(message)
    }
    r.onend = () => {
      rec.current = null
      setListening(false)
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch (err) {
      rec.current = null
      console.warn('Speech recognition would not start', err)
      onProblemRef.current?.("Couldn't start the microphone. Try again.")
    }
  }

  function stop() {
    if (native) void NativeSpeech.stop().catch(() => undefined)
    else rec.current?.stop()
  }

  return { supported: native ? nativeReady : Boolean(Ctor), listening, start, stop }
}
