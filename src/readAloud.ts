/** Reading text out loud with the device's own voice (Web Speech API; also in the Android and iOS web views). */
export function readAloudSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

/** Starts reading, replacing anything already being read. `onEnd` runs when it finishes, is stopped or fails. */
export function readAloud(text: string, onEnd: () => void): void {
  if (!readAloudSupported() || text.trim() === '') {
    onEnd()
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = navigator.language || 'en-US'
  utterance.onend = onEnd
  utterance.onerror = onEnd
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

export function stopReading(): void {
  if (readAloudSupported()) window.speechSynthesis.cancel()
}
