/**
 * Turns the agent's reply into a few safe blocks for the chat bubble: paragraphs, lists, bold text and https links.
 * The reply is untrusted text from a model, so nothing else (no HTML, no other link types) gets through; the screen
 * draws these blocks as React elements, never as markup.
 */
export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'link'; text: string; href: string }
export type Block = { type: 'p'; inline: Inline[] } | { type: 'ul' | 'ol'; items: Inline[][] }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBER = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^\s*#{1,6}\s+(.*)$/
// **bold**, [label](https://...), or a bare https:// address that does not end in punctuation.
const INLINE = /\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)<]*[^\s).,;:!?<])/g

function inline(line: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of line.matchAll(INLINE)) {
    if (m.index > last) out.push({ kind: 'text', text: line.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] })
    else if (m[3] !== undefined) out.push({ kind: 'link', text: m[2], href: m[3] })
    else out.push({ kind: 'link', text: m[4], href: m[4] })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ kind: 'text', text: line.slice(last) })
  return out
}

export function parseReply(reply: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  const endParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'p', inline: inline(paragraph.join('\n')) })
    paragraph = []
  }
  const addItem = (type: 'ul' | 'ol', content: string) => {
    endParagraph()
    const last = blocks.at(-1)
    if (last?.type === type) last.items.push(inline(content))
    else blocks.push({ type, items: [inline(content)] })
  }

  for (const line of reply.replaceAll('\r\n', '\n').split('\n')) {
    const bullet = BULLET.exec(line)
    const number = NUMBER.exec(line)
    const heading = HEADING.exec(line)
    if (bullet) addItem('ul', bullet[1])
    else if (number) addItem('ol', number[1])
    else if (heading) {
      endParagraph()
      blocks.push({ type: 'p', inline: [{ kind: 'bold', text: heading[1].trim() }] })
    } else if (line.trim() === '') endParagraph()
    else paragraph.push(line.trim())
  }
  endParagraph()
  return blocks
}
