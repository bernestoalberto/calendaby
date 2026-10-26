import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './ui/AuthGate.tsx'
import { capturePendingJoin } from './pendingJoin.ts'
import { setUpServiceWorker } from './pwa.ts'

// With a Clerk key the app requires sign-in; without one it runs signed out, exactly as before.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

capturePendingJoin()
void setUpServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkKey ? (
      <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
        <AuthGate>
          <App />
        </AuthGate>
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
