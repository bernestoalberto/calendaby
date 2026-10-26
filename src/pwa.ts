import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'
import { keepStorage } from './keepStorage'

/**
 * Browsers get the offline service worker. The native shells bundle their files, and a service worker
 * installed by an older build would keep serving that old UI after an app update, so they drop it.
 */
export async function setUpServiceWorker(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    registerSW({ immediate: true })
    keepStorage().catch((err: unknown) => console.warn('Could not ask the browser to keep its saved data', err))
    return
  }
  const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
  const keys = await caches.keys()
  await Promise.all([...regs.map((r) => r.unregister()), ...keys.map((k) => caches.delete(k))])
  // Reload once so this launch runs the bundled files instead of the cached ones.
  if (regs.length > 0 || keys.length > 0) location.reload()
}
