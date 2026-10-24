import { createClerkClient } from '@clerk/backend'

/** A Google problem the parent can fix; the message is safe to show them. Anything else stays a generic failure. */
export class GoogleError extends Error {}

export function googleStatusError(service: string, status: number): Error {
  if (status === 401) return new GoogleError('Google access expired. Sign out of Calendaby and sign in again.')
  if (status === 403) {
    return new GoogleError(
      `Google refused ${service} access. Sign in again and allow ${service}; also check that the ${service} API is enabled for the project and your account is a test user.`,
    )
  }
  return new Error(`${service} returned ${status}`)
}

export interface Mail {
  id: string
  from: string
  subject: string
  date: string
  body: string
}

export interface Mailbox {
  search(query: string, max: number): Promise<Mail[]>
}

const API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages'
const MAX_BODY = 4000

interface Part {
  mimeType?: string
  body?: { data?: string }
  parts?: Part[]
}

interface Message {
  payload?: Part & { headers?: { name: string; value: string }[] }
}

function decode(data: string | undefined): string {
  return data ? Buffer.from(data, 'base64url').toString('utf8') : ''
}

function textOf(part: Part, mime: string): string {
  if (part.mimeType === mime) return decode(part.body?.data)
  for (const child of part.parts ?? []) {
    const found = textOf(child, mime)
    if (found) return found
  }
  return ''
}

function bodyText(payload: Part): string {
  const plain = textOf(payload, 'text/plain')
  const text = plain || textOf(payload, 'text/html').replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_BODY)
}

export function gmailMailbox(accessToken: string, fetchImpl: typeof fetch = fetch): Mailbox {
  const get = async <T>(url: string): Promise<T> => {
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) throw googleStatusError('Gmail', res.status)
    return (await res.json()) as T
  }
  return {
    async search(query, max) {
      const list = await get<{ messages?: { id: string }[] }>(
        `${API}?${new URLSearchParams({ q: query, maxResults: String(max) })}`,
      )
      const mails: Mail[] = []
      for (const { id } of list.messages ?? []) {
        const msg = await get<Message>(`${API}/${id}?format=full`)
        const header = (name: string) => msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? ''
        mails.push({
          id,
          from: header('from'),
          subject: header('subject'),
          date: header('date'),
          body: msg.payload ? bodyText(msg.payload) : '',
        })
      }
      return mails
    },
  }
}

/** The Google token Clerk holds for this user; it never leaves the server. */
export async function googleAccessToken(userId: string): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error('Sign-in is not configured')
  const { data } = await createClerkClient({ secretKey }).users.getUserOauthAccessToken(userId, 'google')
  const token = data[0]?.token
  if (!token) {
    throw new GoogleError('Google is not connected to this account. Sign out, then sign in with Google and allow Gmail and Calendar access.')
  }
  return token
}
