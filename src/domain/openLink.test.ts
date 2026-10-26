import { describe, expect, it } from 'vitest'
import { parseOpenLink } from './openLink'

describe('parseOpenLink', () => {
  it('reads an invite code from a normal link', () => {
    expect(parseOpenLink('?join=PK5-CPA')).toEqual({ joinCode: 'PK5-CPA' })
  })

  it('reads one from a web+calendaby: link handed over by the browser', () => {
    expect(parseOpenLink(`?open=${encodeURIComponent('web+calendaby:join/PK5-CPA')}`)).toEqual({ joinCode: 'PK5-CPA' })
    expect(parseOpenLink(`?open=${encodeURIComponent('web+calendaby://join/pk5cpa')}`)).toEqual({ joinCode: 'PK5-CPA' })
  })

  it('cleans up a code the way a phone or messaging app may have rewritten it', () => {
    expect(parseOpenLink(`?join=${encodeURIComponent('pk5–cpa ')}`)).toEqual({ joinCode: 'PK5-CPA' })
  })

  it('ignores anything that is not an invite', () => {
    expect(parseOpenLink('')).toEqual({})
    expect(parseOpenLink('?join=')).toEqual({})
    expect(parseOpenLink('?join=ab')).toEqual({})
    expect(parseOpenLink('?join=' + 'A'.repeat(40))).toEqual({})
    expect(parseOpenLink(`?open=${encodeURIComponent('web+calendaby:delete/everything')}`)).toEqual({})
    expect(parseOpenLink(`?open=${encodeURIComponent('https://evil.example/join/PK5-CPA')}`)).toEqual({})
  })
})
