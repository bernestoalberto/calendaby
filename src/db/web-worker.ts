/// <reference lib="webworker" />
import sqlite3InitModule, { type SAHPoolUtil } from '@sqlite.org/sqlite-wasm'
import type { SqlValue } from './driver'

type Request = { id: number; sql: string; params: SqlValue[]; rows: boolean }

interface Db {
  exec(opts: { sql: string; bind?: SqlValue[]; rowMode?: 'object'; returnValue?: 'resultRows' }): unknown
  close(): void
}

type Backend = { pool: SAHPoolUtil } | { db: Db }

// Serialize OPFS handle ownership across tabs and workers with a Web Lock.
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (!('locks' in navigator)) return fn()
  return navigator.locks.request('calendaby-db', fn)
}

function exec(db: Db, msg: Request): unknown {
  return msg.rows
    ? db.exec({ sql: msg.sql, bind: msg.params, rowMode: 'object', returnValue: 'resultRows' })
    : (db.exec({ sql: msg.sql, bind: msg.params }), null)
}

// opfs-sahpool persists to the origin private file system without needing COOP/COEP headers.
// Pausing the VFS between calls releases the OPFS file handles so multiple tabs can share the database.
const ready: Promise<Backend> = sqlite3InitModule().then((sqlite3) =>
  withLock(async () => {
    try {
      const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'calendaby', preserveOnInitFailure: true })
      pool.pauseVfs()
      return { pool }
    } catch (err) {
      // No OPFS: plain http on a LAN address, an old browser, or a private window.
      console.warn('SQLite: OPFS unavailable, using memory', err)
      return { db: new sqlite3.oo1.DB(':memory:') as unknown as Db }
    }
  }),
)

self.onmessage = async (e: MessageEvent<Request | { id: number; hello: true }>) => {
  const msg = e.data
  try {
    const backend = await ready
    if ('hello' in msg) return self.postMessage({ id: msg.id, result: 'pool' in backend })
    if ('db' in backend) return self.postMessage({ id: msg.id, result: exec(backend.db, msg) })
    const result = await withLock(async () => {
      await backend.pool.unpauseVfs()
      const db = new backend.pool.OpfsSAHPoolDb('/calendaby.sqlite3') as unknown as Db
      try {
        return exec(db, msg)
      } finally {
        db.close()
        backend.pool.pauseVfs()
      }
    })
    self.postMessage({ id: msg.id, result })
  } catch (err) {
    self.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) })
  }
}
