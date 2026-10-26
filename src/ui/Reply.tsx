import { parseReply, type Inline } from '../domain/replyBlocks'

function Inlines({ parts }: Readonly<{ parts: Inline[] }>) {
  return parts.map((p, i) => {
    const key = `${i}:${p.text}`
    if (p.kind === 'bold') return <strong key={key}>{p.text}</strong>
    if (p.kind === 'link') {
      return (
        <a key={key} href={p.href} target="_blank" rel="noreferrer noopener">
          {p.text}
        </a>
      )
    }
    return <span key={key}>{p.text}</span>
  })
}

/** The agent's reply with its paragraphs, lists, bold text and links drawn properly. Only safe elements are ever created. */
export function Reply({ text }: Readonly<{ text: string }>) {
  return (
    <div className="reply">
      {parseReply(text).map((block, i) => {
        const key = `${i}:${block.type}`
        if (block.type === 'p') {
          return (
            <p key={key}>
              <Inlines parts={block.inline} />
            </p>
          )
        }
        const List = block.type
        return (
          <List key={key}>
            {block.items.map((item, j) => (
              <li key={`${j}:${item.map((p) => p.text).join('')}`}>
                <Inlines parts={item} />
              </li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
