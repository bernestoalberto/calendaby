import { afterEach, describe, expect, it, vi } from 'vitest'
import { readAloud, readAloudSupported, stopReading } from './readAloud'

class FakeUtterance {
  text: string
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

function fakeSpeech() {
  const spoken: FakeUtterance[] = []
  const synth = {
    speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
    cancel: vi.fn(),
  }
  vi.stubGlobal('window', { speechSynthesis: synth })
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return { synth, spoken }
}

afterEach(() => vi.unstubAllGlobals())

describe('read aloud', () => {
  it('says so when the device has no speech', () => {
    vi.stubGlobal('window', {})
    expect(readAloudSupported()).toBe(false)
  })

  it('reads the text in the device language and reports when it ends', () => {
    const { synth, spoken } = fakeSpeech()
    vi.stubGlobal('navigator', { language: 'es-US' })
    const onEnd = vi.fn()
    expect(readAloudSupported()).toBe(true)
    readAloud('Next nap at 2:10 PM', onEnd)
    expect(synth.cancel).toHaveBeenCalled()
    expect(spoken[0].text).toBe('Next nap at 2:10 PM')
    expect((spoken[0] as unknown as { lang: string }).lang).toBe('es-US')
    spoken[0].onend?.()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('also reports the end when speech fails, so the button never stays stuck', () => {
    const { spoken } = fakeSpeech()
    vi.stubGlobal('navigator', { language: 'en-US' })
    const onEnd = vi.fn()
    readAloud('Hello', onEnd)
    spoken[0].onerror?.()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('does not read empty text, and stop cancels what is playing', () => {
    const { synth, spoken } = fakeSpeech()
    const onEnd = vi.fn()
    readAloud('   ', onEnd)
    expect(spoken).toEqual([])
    expect(onEnd).toHaveBeenCalledTimes(1)
    stopReading()
    expect(synth.cancel).toHaveBeenCalled()
  })
})
