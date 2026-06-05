// ============================================================================
// Sloj 4 — Playwright config (E2E smoke testovi)
// ----------------------------------------------------------------------------
// Instalacija:  npm i -D @playwright/test && npx playwright install chromium
// Pokretanje:   npm run test:e2e   (vidi package.json)
//
// NAPOMENA: E2E pretpostavlja pokrenutu app (npm run dev) i SEEDOVAN test
// tenant u (po mogućnosti odvojenoj test) Supabase bazi. NE puštaj E2E protiv
// produkcione baze — pravi prave rezervacije/narudžbe.
// ============================================================================
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // mobilni viewport — bitan jer su gosti/konobari na telefonu
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  // Opciono: neka Playwright sam digne dev server
  // webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
})
