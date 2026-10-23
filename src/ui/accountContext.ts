import { createContext, useContext } from 'react'

export interface AccountInfo {
  signedIn?: boolean
  /** First name from the signed-in account; undefined when signed out or sign-in is not configured. */
  name?: string
  email?: string
  /** Set when Clerk is configured but the user skipped sign-in; returns to the sign-in screen. */
  requestSignIn?: () => void
}

export const AccountContext = createContext<AccountInfo>({})

export function useAccount(): AccountInfo {
  return useContext(AccountContext)
}
