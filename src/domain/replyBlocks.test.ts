import { describe, expect, it } from 'vitest'
import { parseReply, speakable } from './replyBlocks'

describe('speakable', () => {
  it('turns a formatted reply into sentences a voice can read, without symbols or addresses', () => {
    const reply = "Next nap is around **2:10 PM**.\n\n- Offer a feed at **1:30 PM**.\n- Wind down from 1:55 PM\n\nSee [CDC](https://www.cdc.gov/sleep) and https://www.cdc.gov/vaccines."
    expect(speakable(reply)).toBe('Next nap is around 2:10 PM. Offer a feed at 1:30 PM. Wind down from 1:55 PM. See CDC and link.')
  })

  it('says the step number for numbered lists', () => {
    expect(speakable('1. Feed\n2. Burp')).toBe('Step 1. Feed. Step 2. Burp.')
  })

  it('is empty for empty text', () => {
    expect(speakable('  ')).toBe('')
  })
})

const text = (t: string) => ({ kind: 'text', text: t })
const bold = (t: string) => ({ kind: 'bold', text: t })
const link = (t: string, href: string) => ({ kind: 'link', text: t, href })

describe('parseReply', () => {
  it('keeps plain text as one paragraph', () => {
    expect(parseReply('Next nap is around 2:10 PM.')).toEqual([{ type: 'p', inline: [text('Next nap is around 2:10 PM.')] }])
  })

  it('splits paragraphs on blank lines and keeps single line breaks inside one', () => {
    expect(parseReply('First line\nsecond line\n\nNew paragraph')).toEqual([
      { type: 'p', inline: [text('First line\nsecond line')] },
      { type: 'p', inline: [text('New paragraph')] },
    ])
  })

  it('turns dashes, asterisks and bullets into one list', () => {
    expect(parseReply('Try this:\n- Dim the lights\n* Start a feed\n• Wind down')).toEqual([
      { type: 'p', inline: [text('Try this:')] },
      { type: 'ul', items: [[text('Dim the lights')], [text('Start a feed')], [text('Wind down')]] },
    ])
  })

  it('turns numbered lines into an ordered list', () => {
    expect(parseReply('1. Feed\n2) Burp\n3. Down')).toEqual([{ type: 'ol', items: [[text('Feed')], [text('Burp')], [text('Down')]] }])
  })

  it('reads **bold** and shows a heading as bold', () => {
    expect(parseReply('Nap at **2:10 PM** today')).toEqual([{ type: 'p', inline: [text('Nap at '), bold('2:10 PM'), text(' today')] }])
    expect(parseReply('## Today\nAll good')).toEqual([
      { type: 'p', inline: [bold('Today')] },
      { type: 'p', inline: [text('All good')] },
    ])
  })

  it('makes https links from markdown and from bare addresses, without the trailing punctuation', () => {
    expect(parseReply('See [the CDC](https://www.cdc.gov/sleep) or https://www.cdc.gov/vaccines.')).toEqual([
      { type: 'p', inline: [text('See '), link('the CDC', 'https://www.cdc.gov/sleep'), text(' or '), link('https://www.cdc.gov/vaccines', 'https://www.cdc.gov/vaccines'), text('.')] },
    ])
  })

  it('never turns anything else into a link or into markup', () => {
    const [block] = parseReply('[click](javascript:alert(1)) <b>x</b> <img src=x onerror=alert(1)>')
    expect(JSON.stringify(block)).not.toContain('"kind":"link"')
    expect(JSON.stringify(block)).toContain('<img src=x onerror=alert(1)>')
  })

  it('returns nothing for empty text', () => {
    expect(parseReply('  \n ')).toEqual([])
  })
})
