import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthGate } from './ui/AuthGate.tsx'

// With a Clerk key the app requires sign-in; without one it runs signed out, exactly as before.
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

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
