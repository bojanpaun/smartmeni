import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
