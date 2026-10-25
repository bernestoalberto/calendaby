import { useEffect, useRef, useState } from 'react'
import { callBackend } from '../agents/remote'
import type { SqliteEventStore } from '../domain/store'
import { syncOnce } from '../domain/sync'

export type SyncStatus = { state: 'off' | 'idle' | 'syncing' | 'error'; lastAt?: number; error?: string }

const EVERY_MS = 30_000
const SOON_MS = 1_500

/**
 * Keeps this phone in step with its household while the app is open: right after a local change, when the app comes
 * back to the front, when the network returns, and every 30 seconds. `onChanged` runs when other phones' changes arrived.
 */
export function useSync(store: SqliteEventStore, enabled: boolean, onChanged: () => void) {
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' })
  const running = useRef(false)
  const again = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  async function run(): Promise<void> {
    if (!enabled) return
    if (running.current) {
      again.current = true
      return
    }
    running.current = true
    setStatus((s) => ({ ...s, state: 'syncing' }))
    try {
      const result = await syncOnce(store, (op, body) => callBackend(op, body))
      if (result.pulled > 0) onChanged()
      setStatus({ state: 'idle', lastAt: Date.now() })
    } catch (err) {
      // Offline is normal for a phone; keep what was last known and say so, the next trigger retries.
      setStatus((s) => ({ ...s, state: 'error', error: err instanceof Error ? err.message : 'Could not sync' }))
    } finally {
      running.current = false
      if (again.current) {
        again.current = false
        void run()
      }
    }
  }

  // The triggers below are set up once per sign-in state; they always call the newest run, never a stale one.
  const latest = useRef(run)
  useEffect(() => {
    latest.current = run
  })

  useEffect(() => {
    if (!enabled) return
    const go = () => void latest.current()
    go()
    const every = setInterval(go, EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && go()
    const onOnline = go
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(every)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [enabled])

  useEffect(() => () => clearTimeout(timer.current), [])

  /** After a local change: wait a moment so a burst of taps goes up as one request. */
  function soon(): void {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void run(), SOON_MS)
  }

  return { status: enabled ? status : ({ state: 'off' } as SyncStatus), now: run, soon }
}
