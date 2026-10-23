import { Show, SignIn, useAuth, useUser } from '@clerk/react'
import { useEffect, useState, type ReactNode } from 'react'
import { setAgentTokenSource } from '../agents/remote'
import { AccountContext } from './accountContext'

// Clerk loads from the network; offer a way in so the log still opens with no signal.
const SLOW_MS = 4000

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const { isLoaded, getToken } = useAuth()
  const { user } = useUser()
  const [slow, setSlow] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setAgentTokenSource(() => getToken())
    return () => setAgentTokenSource(undefined)
  }, [getToken])

  useEffect(() => {
    if (isLoaded) return
    const id = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(id)
  }, [isLoaded])

  if (offline) return <>{children}</>
  if (!isLoaded) {
    return (
      <main className="center">
        <p>Loading…</p>
        {slow && (
          <button type="button" className="pill quiet" onClick={() => setOffline(true)}>
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
        </main>
      </Show>
      <Show when="signed-in">
        <AccountContext value={{ signedIn: true, name: user?.firstName ?? undefined }}>{children}</AccountContext>
      </Show>
    </>
  )
}
