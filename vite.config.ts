/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { gmailImporter } from './agent/appointments.ts'
import { createApp, sharedDb } from './backend/app.ts'
import { userCalendar } from './backend/calendar.ts'

/** Local dev: serve /api/agent with the same function Vercel runs, so no second process is needed. */
function vercelApi(): Plugin {
  return {
    name: 'calendaby-vercel-api',
    configureServer(server) {
      // Server-side settings (MODEL_NAME, OPENROUTER_API_KEY) from .env.local, for the dev functions only; never bundled.
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use('/api/backend', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const out: Response = await createApp(sharedDb(), { importer: gmailImporter, calendar: userCalendar }).fetch(
          new Request(`http://localhost${req.url ?? '/'}`, {
            method: req.method,
            headers: { authorization: req.headers.authorization ?? '' },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          }),
        )
        res.statusCode = out.status
        res.setHeader('content-type', 'application/json')
        res.end(await out.text())
      })
      server.middlewares.use('/api/agent', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const { POST } = await server.ssrLoadModule('/api/agent.ts')
        const out: Response = await POST(
          new Request(`http://localhost${req.url ?? ''}`, {
            method: req.method,
            headers: {
              'content-type': 'application/json',
              origin: req.headers.origin ?? '',
              authorization: req.headers.authorization ?? '',
            },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          }),
        )
        res.statusCode = out.status
        res.setHeader('content-type', 'application/json')
        res.end(await out.text())
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    vercelApi(),
    VitePWA({
      // 'prompt' keeps a new version waiting; src/pwa.ts applies it when the app is in the background, never mid-entry.
      registerType: 'prompt',
      // main.tsx registers it, and only in the browser: the native shells bundle their own files.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      // Precache the SQLite engine too, so the app opens offline.
      // The install screenshots are only shown by the browser's install dialog, so they stay out of the offline cache.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,wasm}'], globIgnores: ['screenshots/**'], maximumFileSizeToCacheInBytes: 3_000_000 },
      manifest: {
        // Keeps the app's identity fixed even if start_url changes later.
        id: '/',
        name: 'Calendaby',
        short_name: 'Calendaby',
        description: 'Baby tracker that logs from one sentence and hands off between caregivers.',
        theme_color: '#16131a',
        background_color: '#16131a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // web+calendaby:join/ABC-123 opens the app on the join box (src/domain/openLink.ts). %s is the whole link.
        protocol_handlers: [{ protocol: 'web+calendaby', url: '/?open=%s' }],
        // Made by `npm run screenshots`. Wide ones are for the desktop install dialog, narrow ones for phones.
        screenshots: [
          { src: 'screenshots/today-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Today: next nap, last feed and diaper' },
          { src: 'screenshots/timeline-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Timeline of the day' },
          { src: 'screenshots/today-narrow.png', sizes: '540x960', type: 'image/png', form_factor: 'narrow', label: 'Today: next nap, last feed and diaper' },
          { src: 'screenshots/timeline-narrow.png', sizes: '540x960', type: 'image/png', form_factor: 'narrow', label: 'Timeline of the day' },
        ],
      },
    }),
  ],
  // SQLite WASM loads its own .wasm file; pre-bundling breaks that.
  optimizeDeps: {
    entries: ['index.html'],
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  server: {
    watch: {
      ignored: ['**/android/**', '**/ios/**', '**/_*/**'],
    },
  },
  worker: {
    format: 'es',
  },
  ssr: {
    external: true,
  },
  test: {
    environment: 'node',
    setupFiles: ['backend/test-setup.ts'],
    exclude: ['node_modules', 'dist', 'e2e', '_*'],
  },
})
