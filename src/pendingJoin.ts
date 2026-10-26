import { parseOpenLink } from './domain/openLink'

const KEY = 'calendaby.pendingJoin'
let code: string | undefined

function readSession(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined
  } catch {
    // Blocked storage (some private windows): the code then lives only in memory, which is enough unless sign-in reloads the page.
    return undefined
  }
}

function writeSession(value: string | undefined): void {
  try {
    if (value) sessionStorage.setItem(KEY, value)
    else sessionStorage.removeItem(KEY)
  } catch {
    // Same as above: nothing to save to.
  }
}

/**
 * Called once before the app draws. An invite link carries a code; it is kept for the session, because signing in with
 * Google leaves the page and loads it again, and is removed from the address bar so a reload does not use it twice.
 */
export function capturePendingJoin(): void {
  const fromLink = parseOpenLink(location.search).joinCode
  if (fromLink) {
    code = fromLink
    writeSession(fromLink)
    history.replaceState(null, '', location.pathname)
    return
  }
  code = readSession()
}

export function peekPendingJoin(): string | undefined {
  return code
}

export function forgetPendingJoin(): void {
  code = undefined
  writeSession(undefined)
}
