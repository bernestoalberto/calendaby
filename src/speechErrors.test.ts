import { describe, expect, it } from 'vitest'
import { speechProblem } from './speechErrors'

describe('speechProblem', () => {
  it('tells the parent how to fix a blocked microphone', () => {
    expect(speechProblem('not-allowed')).toMatch(/microphone/i)
    expect(speechProblem('service-not-allowed')).toMatch(/microphone/i)
  })

  it('explains a missing connection, silence and a missing microphone', () => {
    expect(speechProblem('network')).toMatch(/internet/i)
    expect(speechProblem('no-speech')).toMatch(/didn't hear/i)
    expect(speechProblem('audio-capture')).toMatch(/no microphone/i)
  })

  it('stays quiet when the person stopped it themselves', () => {
    expect(speechProblem('aborted')).toBeUndefined()
  })

  it('still says something for an error it does not know', () => {
    expect(speechProblem('something-new')).toMatch(/try again/i)
  })
})
