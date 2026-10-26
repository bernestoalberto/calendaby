export interface OpenLink {
  joinCode?: string
}

// Invite codes are 6 letters and digits, shown as ABC-123; anything else is not an invite.
const CODE_LENGTH = 6
const PROTOCOL_JOIN = /^web\+calendaby:(?:\/\/)?join\/(.+)$/i

function cleanCode(raw: string): string | undefined {
  const letters = raw.toUpperCase().replaceAll(/[^A-Z0-9]/g, '')
  if (letters.length !== CODE_LENGTH || raw.length > 20) return undefined
  return `${letters.slice(0, 3)}-${letters.slice(3)}`
}

/**
 * What a link into the app asks for: `?join=CODE` from an ordinary link, or `?open=web%2Bcalendaby:join/CODE` when the
 * browser hands over a link registered in the manifest. The link is untrusted: only a well-formed code comes out.
 */
export function parseOpenLink(search: string): OpenLink {
  const params = new URLSearchParams(search)
  const fromProtocol = PROTOCOL_JOIN.exec(params.get('open') ?? '')?.[1]
  const code = cleanCode(params.get('join') ?? fromProtocol ?? '')
  return code ? { joinCode: code } : {}
}
