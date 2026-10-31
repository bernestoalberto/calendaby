import { Capacitor } from '@capacitor/core'

/**
 * Over-the-air web updates inside the Android and iOS shells. The plugin downloads a new bundle in the
 * background (see capacitor.config.ts) and swaps it in on the next launch. Telling it the new bundle
 * started fine is what stops the automatic rollback to the previous one.
 */
export async function confirmLiveUpdate(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
  await CapacitorUpdater.notifyAppReady()
}
