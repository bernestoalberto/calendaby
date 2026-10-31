import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { APPT_ID_BASE, APPT_ID_COUNT } from './domain/appointmentAlerts'
import { ALL_ALERT_IDS, type NapAlert } from './domain/notifications'

const CANCEL_IDS = [...ALL_ALERT_IDS, ...Array.from({ length: APPT_ID_COUNT }, (_, i) => APPT_ID_BASE + i)]

export type NotificationAccess = 'granted' | 'denied' | 'prompt' | 'unsupported'

const TEST_ID = 199
const NOW_ID_BASE = 5000
const webTimers: ReturnType<typeof setTimeout>[] = []

function mapNativePermission(display: string): NotificationAccess {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  return 'prompt'
}

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
      return mapNativePermission(display)
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
      return mapNativePermission(display)
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
      await LocalNotifications.cancel({ notifications: CANCEL_IDS.map((id) => ({ id })) })
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

/** Every reminder still waiting, including ones from older app versions whose ids this one no longer knows. */
export async function cancelAllNotifications(): Promise<void> {
  clearWebTimers()
  if (!Capacitor.isNativePlatform()) return
  const { notifications } = await LocalNotifications.getPending()
  if (notifications.length > 0) await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) })
}

/** Shows one notification right away, for news that should not wait for a schedule. False when it could not be shown. */
export async function notifyNow(title: string, body: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { display } = await LocalNotifications.checkPermissions()
      if (display !== 'granted') return false
      await LocalNotifications.schedule({
        notifications: [
          {
            // Outside the cancelled alert ids, so rescheduling the reminders never removes it.
            id: NOW_ID_BASE + (Date.now() % 100_000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
            isExactNotification: false,
            foreground: true,
          },
        ],
      })
      return true
    } catch (err) {
      console.warn('Could not show the notification', err)
      return false
    }
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  await showWebNotification(title, body)
  return true
}

export async function sendTestNotification(baby: string): Promise<boolean> {
  const access = await requestNotificationAccess()
  if (access !== 'granted') return false
  const title = `${baby}: smart reminders are on`
  const body = `Calendaby will alert you for ${baby}'s predicted naps, wake-ups, feeds, and diaper checks.`

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
