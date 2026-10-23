import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { NAP_DUE_ID, NAP_SOON_ID, type NapAlert } from './domain/notifications'

export type NotificationAccess = 'granted' | 'denied' | 'prompt' | 'unsupported'

const TEST_ID = 199
const webTimers: ReturnType<typeof setTimeout>[] = []

function clearWebTimers() {
  while (webTimers.length > 0) {
    const id = webTimers.pop()
    if (id !== undefined) clearTimeout(id)
  }
}

async function showWebNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' })
      return
    }
  } catch {
    // Fall back to the page Notification constructor below.
  }
  new Notification(title, { body, icon: '/icon-192.png' })
}

export async function notificationAccess(): Promise<NotificationAccess> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { display } = await LocalNotifications.checkPermissions()
      return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
    } catch {
      return 'unsupported'
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

export async function requestNotificationAccess(): Promise<NotificationAccess> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { display } = await LocalNotifications.requestPermissions()
      return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
    } catch {
      return 'unsupported'
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  const res = await Notification.requestPermission()
  return res === 'default' ? 'prompt' : res
}

export async function syncNapNotifications(enabled: boolean, alerts: NapAlert[]): Promise<void> {
  clearWebTimers()
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NAP_SOON_ID }, { id: NAP_DUE_ID }] })
      if (!enabled || alerts.length === 0) return
      const { display } = await LocalNotifications.checkPermissions()
      if (display !== 'granted') return
      await LocalNotifications.schedule({
        notifications: alerts.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          schedule: { at: new Date(a.at), allowWhileIdle: true },
          isExactNotification: false,
        })),
      })
    } catch {
      // Ignore scheduling errors if notifications were revoked at OS level.
    }
    return
  }

  if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const now = Date.now()
  for (const a of alerts) {
    const delay = a.at - now
    if (delay > 0 && delay <= 12 * 3_600_000) {
      webTimers.push(setTimeout(() => void showWebNotification(a.title, a.body), delay))
    }
  }
}

export async function sendTestNotification(baby: string): Promise<boolean> {
  const access = await requestNotificationAccess()
  if (access !== 'granted') return false
  const title = `${baby}: nap reminders are on`
  const body = `Calendaby will notify you 15 minutes before ${baby}'s predicted nap and when nap time arrives.`

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: TEST_ID,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          isExactNotification: false,
          foreground: true,
        },
      ],
    })
    return true
  }
  await showWebNotification(title, body)
  return true
}

