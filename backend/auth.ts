import { verifyToken } from '@clerk/backend'

/** Returns the Clerk user id for a valid session token, or null. */
export type Verifier = (token: string) => Promise<string | null>

export function clerkVerifier(secretKey: string): Verifier {
  return async (token) => {
    try {
      const claims = await verifyToken(token, { secretKey })
      return claims.sub
    } catch {
      return null
    }
  }
}

/**
 * The signed-in user, or the 401 to return.
 * With no CLERK_SECRET_KEY the API stays open (local dev and tests), as before sign-in existed, and userId is null.
 */
export async function authenticate(request: Request, verify?: Verifier): Promise<Response | { userId: string | null }> {
  const secretKey = process.env.CLERK_SECRET_KEY
  const check = verify ?? (secretKey ? clerkVerifier(secretKey) : undefined)
  if (!check) return { userId: null }
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
  const userId = token ? await check(token) : null
  return userId ? { userId } : Response.json({ error: 'Sign in required' }, { status: 401 })
}

/** Null when the request may proceed, otherwise the 401 to return. */
export async function authorize(request: Request, verify?: Verifier): Promise<Response | null> {
  const result = await authenticate(request, verify)
  return result instanceof Response ? result : null
}
