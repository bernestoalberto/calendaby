import type { CapacitorConfig } from '@capacitor/cli'

// The same Vite build in dist/ ships as the PWA and inside the iOS and Android shells.
const config: CapacitorConfig = {
  appId: 'com.calendaby.app',
  appName: 'Calendaby',
  webDir: 'dist',
}

export default config
