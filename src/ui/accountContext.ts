import { createContext, useContext } from 'react'

export interface AccountInfo {
  signedIn?: boolean
  /** First name from the signed-in account; undefined when signed out or sign-in is not configured. */
  name?: string
}

export const AccountContext = createContext<AccountInfo>({})

export function useAccount(): AccountInfo {
  return useContext(AccountContext)
}
