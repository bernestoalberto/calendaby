import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5173', channel: 'chrome', viewport: { width: 400, height: 800 } },
  webServer: { command: 'npx vite --host', url: 'http://localhost:5173', reuseExistingServer: true },
})
