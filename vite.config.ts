/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Calendaby',
        short_name: 'Calendaby',
        description: 'Baby tracker that logs from one sentence and hands off between caregivers.',
        theme_color: '#2f6f5e',
        background_color: '#f7f6f2',
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
  server: {
    // Local dev: send /api/agent straight to the agent running with `npm run agent` on port 8080.
    proxy: {
      '/api/agent': { target: 'http://localhost:8080', rewrite: () => '/invocations' },
    },
  },
  test: {
    environment: 'node',
  },
})
