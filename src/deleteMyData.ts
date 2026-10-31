import { callBackend } from './agents/remote'
import { LEGACY_KEY, type SqliteEventStore } from './domain/store'
import { cancelAllNotifications } from './notifications'
import { forgetPendingJoin } from './pendingJoin'

/**
 * The server copy goes first: if that fails, nothing on the phone is touched and the parent can try again, instead of
 * ending up with an empty phone while the server still holds the log.
 */
export async function deleteMyData(store: SqliteEventStore, signedIn: boolean, call = callBackend): Promise<void> {
  if (signedIn) await call('deleteMyData', {})
  await cancelAllNotifications()
  await store.wipe()
  localStorage.removeItem(LEGACY_KEY)
  localStorage.removeItem(`${LEGACY_KEY}.migrated`)
  forgetPendingJoin()
}
