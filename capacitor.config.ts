import type { CapacitorConfig } from '@capacitor/cli'

// The same Vite build in dist/ ships as the PWA and inside the iOS and Android shells.
const config: CapacitorConfig = {
  appId: 'com.calendaby.app',
  appName: 'Calendaby',
  webDir: 'dist',
  plugins: {
    // Status-bar icon for reminders: the moon, as a white drawable (res/drawable/ic_stat_calendaby.xml).
    LocalNotifications: { smallIcon: 'ic_stat_calendaby', iconColor: '#91f78e' },
    // Over-the-air web updates from Capgo. Native changes still need a new APK from Play.
    CapacitorUpdater: { autoUpdate: true, resetWhenUpdate: true },
  },
}

export default config
