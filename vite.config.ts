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
      registerType: 'autoUpdate',
      // main.tsx registers it, and only in the browser: the native shells bundle their own files.
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      // Precache the SQLite engine too, so the app opens offline.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,wasm}'], maximumFileSizeToCacheInBytes: 3_000_000 },
      manifest: {
        name: 'Calendaby',
        short_name: 'Calendaby',
        description: 'Baby tracker that logs from one sentence and hands off between caregivers.',
        theme_color: '#121b2b',
        background_color: '#121b2b',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
