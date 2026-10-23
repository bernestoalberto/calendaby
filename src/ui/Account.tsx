import { UserButton } from '@clerk/react'
import { useAccount } from './accountContext'

/** Only rendered when Clerk is configured, so it always sits inside ClerkProvider. */
export function Account() {
  const { name } = useAccount()
  return (
    <section className="card">
      <div className="card-head">
        <h3>Account</h3>
      </div>
      <p className="muted">{name ? `Signed in as ${name}.` : 'Signed in.'} Gmail and Calendar sync use this Google account.</p>
      <UserButton />
    </section>
  )
}
