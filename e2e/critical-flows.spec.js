// ============================================================================
// Sloj 4 — E2E smoke testovi: 3 kritične "novčane" putanje
// ----------------------------------------------------------------------------
// SKELET — selektori, rute i test podaci su TODO; popuni ih protiv žive app.
// Cilj NIJE pokrivenost, nego 3 putanje koje ako puknu = direktan gubitak novca.
//
// Preduslov: seedovan test tenant (slug) sa: aktivnim hotel_core + spa addonima,
// barem jednim tipom sobe + sobom, i admin nalogom za prijavu.
// Predlog: ENV varijable E2E_SLUG, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD.
// ============================================================================
import { test, expect } from '@playwright/test'

const SLUG = process.env.E2E_SLUG ?? 'demo'

// ── Putanja 1: Gost naručuje preko digitalnog menija ────────────────────────
test('gost može da naruči sa menija', async ({ page }) => {
  await page.goto(`/${SLUG}/menu`) // TODO: potvrdi tačnu rutu menija
  // TODO: otvori stavku, dodaj u korpu, pošalji narudžbu
  // await page.getByRole('button', { name: 'Dodaj' }).first().click()
  // await page.getByRole('button', { name: 'Naruči' }).click()
  // await expect(page.getByText(/narudžba (poslata|primljena)/i)).toBeVisible()
  test.fixme(true, 'Popuni selektore protiv žive app')
})

// ── Putanja 2: Booking — gost rezerviše sobu ────────────────────────────────
test('gost može da napravi rezervaciju', async ({ page }) => {
  await page.goto(`/${SLUG}/hotel`) // TODO: potvrdi booking rutu
  // TODO: izaberi datume → tip sobe → podaci gosta → "Pay on arrival" ili plaćanje
  // await expect(page.getByText(/rezervacija potvrđena/i)).toBeVisible()
  test.fixme(true, 'Popuni selektore + seedovan tip sobe protiv žive app')
})

// ── Putanja 3: Recepcija — check-in i folio ─────────────────────────────────
test('recepcija radi check-in i vidi folio', async ({ page }) => {
  // TODO: prijava kao admin
  // await page.goto('/login')
  // await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!)
  // await page.getByLabel(/lozinka/i).fill(process.env.E2E_ADMIN_PASSWORD!)
  // await page.getByRole('button', { name: /prijav/i }).click()
  await page.goto('/admin/hotel/reservations') // TODO: potvrdi rutu
  // TODO: otvori rezervaciju → Check-in → otvori folio → provjeri da je folio 'open'
  test.fixme(true, 'Popuni prijavu + selektore protiv žive app')
})
