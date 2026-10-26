/** What to tell the parent when the browser's speech recognition stops with an error; undefined when it was their own stop. */
export function speechProblem(error: string): string | undefined {
  switch (error) {
    case 'aborted':
      return undefined
    case 'not-allowed':
    case 'service-not-allowed':
      return "Allow microphone access in your browser's site settings to log by voice."
    case 'network':
      return 'Voice in the browser needs an internet connection. Type it instead, or try again.'
    case 'no-speech':
      return "Didn't hear anything. Tap the microphone and try again."
    case 'audio-capture':
      return 'No microphone found on this device.'
    default:
      return "Couldn't hear that. Try again."
  }
}
