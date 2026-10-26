const NATIVE_ORIGINS = new Set(['https://localhost', 'capacitor://localhost'])

/**
 * Which pages may call the server from a browser. The app's own address always may (a page can only reach its own
 * server from there, so a custom domain works without a setting), as do the phone apps and any address in
 * AGENT_ALLOWED_ORIGIN, a comma separated list. Pages on other sites are refused.
 */
export function isAllowedOrigin(origin: string | null, requestUrl: string, configured: string | undefined): boolean {
  if (!origin) return false
  if (NATIVE_ORIGINS.has(origin)) return true
  const listed = (configured ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  if (listed.includes(origin)) return true
  try {
    return origin === new URL(requestUrl).origin
  } catch {
    // An unreadable request address cannot match, and the origin is then judged by the list alone.
    return false
  }
}
