import { UserButton } from '@clerk/react'
import { Badge } from './controls'
import { useAccount } from './accountContext'

/** Only rendered when Clerk is configured, so it always sits inside ClerkProvider. */
export function Account() {
  const { signedIn, name, email, requestSignIn } = useAccount()
  if (!signedIn) {
    return (
      <section className="card">
        <div className="card-head">
          <h3>Account</h3>
          <Badge tone="oat">Guest</Badge>
        </div>
        <p className="muted">
          You are using Calendaby as a guest. Logging, the timeline, analytics, handoff and reminders all work and stay on this device. Sign in with
          Google to add Gmail doctor appointments, your calendar and the assistant.
        </p>
        {requestSignIn && (
          <button type="button" className="pill primary" onClick={requestSignIn}>
            Sign in with Google
          </button>
        )}
      </section>
    )
  }
  return (
    <section className="card">
      <div className="card-head">
        <h3>Account</h3>
        <Badge tone="sage">Signed in</Badge>
      </div>
      <p className="muted">
        {name ? `Signed in as ${name}` : 'Signed in'}
        {email ? ` (${email})` : ''}. Gmail appointments, calendar and the assistant use this Google account.
      </p>
      <UserButton />
    </section>
  )
}
