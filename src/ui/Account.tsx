import { UserButton } from '@clerk/react'
import { Badge } from './controls'
import { useAccount } from './accountContext'

/** Only rendered when Clerk is configured, so it always sits inside ClerkProvider. */
export function Account() {
  const { name, email } = useAccount()
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
