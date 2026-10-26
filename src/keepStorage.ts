export type StorageAnswer = 'kept' | 'refused' | 'unsupported'

/**
 * Asks the browser not to clear this site's saved data (the log lives in it) when space runs low or the app has not been
 * opened for a while. The browser may refuse; that changes nothing else, and signed-in logs are also on the server.
 */
export async function keepStorage(): Promise<StorageAnswer> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported'
  if (await navigator.storage.persisted()) return 'kept'
  return (await navigator.storage.persist()) ? 'kept' : 'refused'
}
