import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Vitest: unit testovi su SAMO čiste JS funkcije u src/. Deno edge testovi
  // (supabase/functions/**, jsr: importi) i Playwright e2e (e2e/**) se NE pokreću
  // ovdje — njih vrte `npm run test:edge` (Deno) i `npm run test:e2e` (Playwright).
  test: {
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules/**', 'e2e/**', 'supabase/**', 'dist/**'],
  },
  build: {
    rollupOptions: {
      output: {
        // Vendor split — stabilni libovi u zasebnim chunkovima radi boljeg
        // keširanja (deploy aplikativnog koda ne ruši vendor keš na mobilnom).
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts':   ['recharts'],
          'vendor-dnd':      ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-i18n':     ['i18next', 'react-i18next'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'SmartMeni',
        short_name: 'SmartMeni',
        description: 'Digitalni meni za restorane',
        theme_color: '#0d7a52',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Keširaj sve statičke resurse
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Keširaj API pozive za meni (za offline prikaz)
        runtimeCaching: [
          {
            // Supabase REST API — keširaj GET zahtjeve za meni
            urlPattern: ({ url }) =>
              url.hostname.includes('supabase.co') &&
              url.pathname.includes('/rest/v1/') &&
              ['restaurants', 'categories', 'menu_items'].some(t =>
                url.pathname.includes(t)
              ),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'smartmeni-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 sata
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Slike iz Supabase Storage
            urlPattern: ({ url }) =>
              url.hostname.includes('supabase.co') &&
              url.pathname.includes('/storage/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'smartmeni-images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dana
              },
            },
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 godina
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // Ne aktiviraj SW u dev modu
      },
    }),
  ],
})
