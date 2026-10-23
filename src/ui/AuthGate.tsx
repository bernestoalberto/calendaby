import { Show, SignIn, useAuth, useUser } from '@clerk/react'
import { useEffect, useState, type ReactNode } from 'react'
import { setAgentTokenSource } from '../agents/remote'
import { AccountContext } from './accountContext'

// Clerk loads from the network; offer a way in so the log still opens with no signal.
const SLOW_MS = 4000
const GUEST_KEY = 'calendaby.guest'

function readGuest(): boolean {
  try {
    return localStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

function writeGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(GUEST_KEY, '1')
    else localStorage.removeItem(GUEST_KEY)
  } catch {
    // Storage blocked: guest mode lasts until reload.
  }
}

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const { isLoaded, getToken } = useAuth()
  const { user } = useUser()
  const [slow, setSlow] = useState(false)
  const [offline, setOffline] = useState(readGuest)
  const setGuest = (on: boolean) => {
    writeGuest(on)
    setOffline(on)
  }

  useEffect(() => {
    setAgentTokenSource(() => getToken())
    return () => setAgentTokenSource(undefined)
  }, [getToken])

  useEffect(() => {
    if (isLoaded) return
    const id = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(id)
  }, [isLoaded])

  if (offline) {
    return <AccountContext value={{ requestSignIn: () => setGuest(false) }}>{children}</AccountContext>
  }
  if (!isLoaded) {
    return (
      <main className="center">
        <p>Loading…</p>
        {slow && (
          <button type="button" className="pill quiet" onClick={() => setGuest(true)}>
            Continue without signing in
          </button>
        )}
      </main>
    )
  }
  return (
    <>
      <Show when="signed-out">
        <main className="center auth">
          <h1>Calendaby</h1>
          <p className="muted">Sign in or create an account to keep your baby&apos;s day straight.</p>
          <SignIn routing="hash" />
          <button type="button" className="pill quiet" onClick={() => setGuest(true)}>
            Continue as guest
          </button>
        </main>
      </Show>
      <Show when="signed-in">
        <AccountContext value={{ signedIn: true, name: user?.firstName ?? undefined, email: user?.primaryEmailAddress?.emailAddress }}>{children}</AccountContext>
      </Show>
    </>
  )
}
