# SmartMeni → HospitalityOS — Produkt roadmap

> **Verzija:** 2.0 *(potpuno ažurirano — reflektuje stvarno stanje na 2026-05-30)*
> **Kontekst:** Evolucija SmartMeni SaaS platforme prema punom hospitality management sistemu
> **Tim:** 1 developer + Claude Code AI asistent
> **Branch:** `main` → direktno na produkciju (Vercel auto-deploy)

---

## Vizija proizvoda

SmartMeni počinje kao restoran SaaS. Krajnji cilj je **jedinstvena platforma** koja pokreće cijelo ugostiteljstvo — od restorana do hotela, hostelova, apartmana i resort kompleksa — sa jednim login-om, jednom bazom gostiju, i modulima koji se naplaćuju po potrebi.

### Ključni arhitekturalni princip (usvojen 2026-05-30)

**Restoran i hotel su dva zasebna digitalna identiteta koji mogu funkcionisati potpuno samostalno, ali se uvezuju kada su oba aktivirana.**

Svaki ima:
- Vlastiti customizabilni sajt (block-based, uređuje se iz admin panela)
- Potencijalno vlastiti domen (`hotelbojan.com`, `restoranribar.me`)
- Vlastitu javnu stranicu sa CTA akcijama
- Zajednički branding (logo, boje) i zajedničku bazu gostiju

---

## Arhitektura naplate (Billing model)

### Osnova (Base plan)
Svaki tenant plaća osnovu koja uključuje:
- Digitalni meni + narudžbe
- Upravljanje stolovima
- Osnovni HR (osoblje, rasporedi)
- Gosti modul (CRM)
- Analitika (osnovna)
- Do 5 korisnika (staff accounts)

### Addon moduli

| Modul | Opis | Status u kodu |
|-------|------|---------------|
| `inventory_pro` | Puno upravljanje zalihama, recepti, FIFO | ✅ UI postoji, billing guard aktivan |
| `hr_pro` | Payroll, prisustvo, napredni rasporedi | ✅ UI postoji, billing guard aktivan |
| `analytics_pro` | Napredni izvještaji, export, prognoza | ✅ UI postoji, billing guard aktivan |
| `hotel_core` | Sobe, rezervacije, front desk, folio | ✅ Potpuno implementiran |
| `booking_engine` | Online booking sa javne stranice | ✅ Booking stranica radi, payment ⬜ |
| `channel_manager` | Sync sa Booking.com, Airbnb, Expedia | ⬜ Planiran Faza 6 |
| `housekeeping` | Housekeeping dashboard, taskovi | ✅ UI implementiran |
| `revenue_mgmt` | Dinamičke cijene, yield management | ✅ UI + metrics implementirani |
| `spa_wellness` | Booking spa tretmana | ⬜ Daleka faza |
| `loyalty` | Loyalty program, bodovi, nagrade | ⬜ Faza 8 |
| `guest_app` | White-label PWA za goste | ✅ Implementiran (/:slug/guest) |
| `multi_property` | Upravljanje više nekretnina | ⬜ Faza 9 |
| `portfolio_owner` | Portfolio dashboard, komparativna analitika | ⬜ Faza 9 |
| `brand_mgmt` | Centralizovani sabloni, više brandova | ⬜ Faza 10 |
| `regional_mgmt` | Hijerarhija pristupa za portfelje | ⬜ Faza 10 |

---

## Faze razvoja — stvarno stanje

---

## ✅ Faza 0 — Stabilizacija SmartMenija (ZAVRŠENA)

Restoran SaaS stabilizovan i spreman za korisnike:
- ✅ Migracije uređene, RLS provjeren
- ✅ Error handling, toastovi, loading stanja
- ✅ Code splitting, lazy loading svih stranica
- ✅ Onboarding flow radi end-to-end

---

## ✅ Faza 1 — Billing infrastruktura (ZAVRŠENA — osnova)

**Napomena:** PayPal implementiran za base plan. Stripe za addonе dolazi u kasnijoj fazi.

### Što je urađeno:
- ✅ `subscriptions` tabela sa RLS (`20260528000001`)
- ✅ `addon_catalog` tabela, 15 addona definisano
- ✅ `planUtils.js` — `hasAddon()` i `addonTrialDaysLeft()` helperi
- ✅ `PlatformContext` — učitava subscription, eksponira `hasAddon(addonId)`
- ✅ `UpgradePrompt` komponenta (fullPage varijanta)
- ✅ `AddonGuard` wrapper za zaštitu ruta
- ✅ `BillingPage` — addon katalog sa kategorijama
- ✅ Trial sistem za addonе (14 dana)
- ✅ Stripe webhook skeleton (čeka Stripe integraciju)

### Preostalo:
- ⬜ Stripe integracija za addon purchase flow
- ⬜ Addon purchase UI ("Aktiviraj modul" → Stripe Checkout)

---

## ✅ Faza 2 — Hotel Core modul (ZAVRŠENA)

Svi ključni dijelovi hotel core modula su implementirani.

### Baza podataka:
- ✅ `room_types` tabela (RLS, sort_order, amenities JSONB)
- ✅ `rooms` tabela (status, floor, notes, last_cleaned_at)
- ✅ `hotel_reservations` tabela (svi statusi, source tracking)
- ✅ `folios` + `folio_items` tabele
- ✅ `orders.folio_id` — veza restoran narudžbi sa foliom
- ✅ `rate_plans` tabela (base i seasonal rates)
- ✅ `housekeeping_tasks` tabela
- ✅ `revenue_metrics` view + funkcije

### Admin UI (`/admin/hotel/...`):
- ✅ `HotelDashboard` — KPI-evi, brzi pristup, danas
- ✅ `RoomsPage` — grid soba sa filterima po statusu
- ✅ `RoomFormPage` — kreiranje i uređivanje soba (`/rooms/new`, `/rooms/:id`)
- ✅ `RoomTypesPage` — upravljanje tipovima, amenities, slike
- ✅ `ReservationsPage` — lista rezervacija sa filterima
- ✅ `ReservationForm` — kreiranje/uređivanje rezervacija
- ✅ `CalendarPage` — Gantt availability calendar, 14 dana, navigacija
- ✅ `FrontDeskPage` — tri taba: Check-in danas, Check-out, Zahtjevi gostiju
- ✅ `FolioPage` — pregled i upravljanje foliom
- ✅ `FolioPrint` — print-ready PDF folio
- ✅ `RatePlansPage` — upravljanje cjenovnim planovima
- ✅ `BookingSettings` — podešavanja booking engina
- ✅ `HousekeepingPage` — housekeeping dashboard
- ✅ `RevenueManagementPage` — ADR, RevPAR, trendovi

### Integracije:
- ✅ Check-in automatski kreira folio
- ✅ Check-out automatski zatvara folio i postavlja sobu na "cleaning"
- ✅ WaiterDashboard — "Naplati na sobu" dodaje narudžbu na folio

---

## ✅ Faza 3 — Booking Engine (DJELIMIČNO ZAVRŠENA)

### Što je urađeno:
- ✅ `BookingPage` (`/:slug/book`) — kompletna javna booking stranica
  - Odabir datuma, tip sobe, podaci gosta, plaćanje
  - i18n (MNE/EN)
  - Stripe Payment Element integracija
- ✅ `send-booking-email` Edge Function (Resend)
  - Tipovi: confirmed, cancelled, checkin, checkout
  - HTML email sa brandingom hotela
  - Link na Guest App + kod gosta u emailu
- ✅ `RatePlansPage` + `BookingSettings` admin UI

### Preostalo:
- ⬜ `get_available_rooms()` PostgreSQL funkcija (prava availability provjera)
- ⬜ `room_availability` tabela (inventory management po datumu)
- ⬜ Cancellation flow sa refundom (Stripe)
- ⬜ Resend domen verifikacija (trenutno `onboarding@resend.dev`)

---

## ✅ Faza 4 — Housekeeping modul (DJELIMIČNO ZAVRŠENA)

- ✅ `housekeeping_tasks` tabela sa RLS
- ✅ `HousekeepingPage` admin UI — taskovi, statusi, dodjela
- ⬜ Auto-task kreiranje pri check-outu (DB trigger)
- ⬜ Mobile-optimizovani prikaz za sobarice

---

## ✅ Faza 5 — Revenue Management (DJELIMIČNO ZAVRŠENA)

- ✅ Revenue metrics materialized view + pg funkcija
- ✅ `RevenueManagementPage` — ADR, RevPAR, Occupancy Rate, grafovi
- ⬜ Price suggestion algoritam (prijedlog cijene na osnovu popunjenosti)
- ⬜ Export analitike u PDF/Excel

---

## ✅ Faza X — Guest Experience Layer (NOVA FAZA — nije bila u originalnom planu)

Ova faza je nastala organički tokom razvoja. Pokriva sve što gost vidi i koristi — javnu stranu platforme.

### i18n sistem (Višejezičnost)
- ✅ `react-i18next` setup, `sm_lang` localStorage key
- ✅ `LanguageSwitcher` komponenta (globe + native select, skalabilno na N jezika)
- ✅ MNE (default) i EN prevodi za booking stranicu
- ✅ `ThemeToggle` redesign — animirani sun/moon pill
- ✅ Language switcher u svim layoutima (AdminLayout desktop/mobile, BookingPage, GuestApp, HotelLanding)
- ⬜ Prevodi za admin panel (opciono, niska prioriteta)

### Guest App (`/:slug/guest`)
- ✅ `GuestAppPage` — mobilna standalone stranica za hotelske goste
- ✅ Login: email + 8-char rezervacijski kod (UUID prefix)
- ✅ Session management (`sessionStorage`, bez Supabase Auth)
- ✅ SECURITY DEFINER RPCs (anon pristup bez JWT):
  - `get_guest_reservation(code, email, restaurant_id)`
  - `get_guest_folio(reservation_id)`
  - `get_guest_requests(reservation_id)`
- ✅ Tabovi: Moj boravak, Hotel info, Zahtjevi sobi, Folio
- ✅ Slanje zahtjeva sobi po kategorijama (housekeeping, linen, food, maintenance...)
- ✅ Real-time status zahtjeva (Supabase Realtime)
- ✅ `GuestApp.module.css` — mobile-first, zeleni gradient header, bottom nav
- ✅ `guest_requests` tabela sa RLS

### Front Desk — Zahtjevi gostiju
- ✅ Treći tab u `FrontDeskPage` — "Zahtjevi gostiju"
- ✅ Real-time Supabase subscription na INSERT u `guest_requests`
- ✅ Status management: pending → in_progress → resolved
- ✅ Crveni badge za broj neriješenih zahtjeva

### Hotel Landing Page (`/:slug/hotel`)
- ✅ Javna stranica hotela (hero, CTAs, sobe, kontakt, link na meni)
- ✅ Dinamički grid tipova smještaja iz `room_types`
- ✅ `hotel_visibility` kolona u `restaurants` (TEXT, default 'off')
- ✅ `GeneralSettings` — VisibilityControl za hotel link (samo ako `hotel_core` aktivan)
- ✅ `GuestMenu` — link prema hotel landing strani sa `canSee(hotelVis)` logikom
- ✅ `HotelLanding.module.css` — mobile-first, responsivan grid

---

## 🔄 Faza Y — Customizabilni sajtovi (SLJEDEĆE — u planiranju)

### Arhitekturalna odluka (2026-05-30)

Restoran i hotel trebaju vlastite **customizabilne sajtove** koji:
- Mogu imati vlastiti domen (`hotelbojan.com`, `restoranribar.me`)
- Uređuju se iz admin panela (block-based, bez page-buildera)
- Funkcionišu potpuno samostalno ili u kombinaciji

### Pristup: Block-based editor

Predefinisani blokovi koje admin pali/gasi i puni sadržajem. Ne drag&drop, ne slobodni layout — ali 95% hotela i restorana to ne treba.

**Hotel blokovi:**
- Hero (upload pozadinske slike, naslov, tagline, CTA tekst i link)
- O hotelu (tekst, jedna slika)
- Sobe (automatski iz `room_types` — već dinamično)
- Galerija (upload do 12 slika)
- Pogodnosti / Amenities (ikone + tekst)
- Lokacija (adresa + Google Maps embed)
- Kontakt (telefon, email, radno vrijeme)
- Recenzije (ručni unos)

**Restoran blokovi:**
- Hero
- Priča o restoranu (tekst + slika)
- Meni preview (automatski iz kategorija)
- Galerija
- Radno vrijeme + lokacija
- Rezervacija stola CTA

**Nova tabela:**
```sql
CREATE TABLE landing_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  page_type       TEXT NOT NULL,  -- 'hotel' | 'restaurant'
  blocks          JSONB DEFAULT '[]',
  -- [{type: 'hero', enabled: true, data: {title, subtitle, bg_image_url, cta_text}}, ...]
  seo_title       TEXT,
  seo_description TEXT,
  custom_domain   TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

**Admin UI:**
- `/admin/hotel/landing` — hotel sajt editor
- `/admin/settings/landing` — restoran sajt editor
- Svaki blok: toggle enabled/disabled + forma za sadržaj
- Opcija reorderinga blokova (gore/dole)

**Javna ruta:**
- `/:slug/hotel` — već postoji, čita blokove iz `landing_pages`
- `/:slug` — trenutno GuestMenu, proširuje se o landing sekciju (ili nova ruta `/:slug/home`)

### Custom domeni (Faza Y.2 — odvojeno)
- Admin unosi `hotelbojan.com` u podešavanjima
- Vercel API za custom domain management
- DNS instrukcije u admin panelu
- Vercel ruter: custom domain → `smartmeni.vercel.app/:slug/hotel`
- **Implementirati tek kad ima potražnje** (3–5 dana zasebnog rada)

**Definition of Done — Faza Y:**
- [ ] `landing_pages` tabela sa RLS
- [ ] Admin editor za hotel blokove
- [ ] Admin editor za restoran blokove
- [ ] `/:slug/hotel` čita i renderuje blokove
- [ ] Svaki blok se može isključiti bez brisanja podataka
- [ ] Upload slika u Supabase Storage
- [ ] SEO title/description se može podesiti

---

## ⬜ Faza 6 — Channel Manager

> **Preduslov:** `hotel_core` + `booking_engine` s availability engineom.
> **Trajanje:** 12–16 sedmica — najveći tehnički izazov.

**Preporučena strategija:** Beds24 middleware (već certificiran za Booking.com, Airbnb, Expedia) umjesto direktnih integracija.

---

## ⬜ Faza 7 — Mobilna aplikacija (React Native / Expo)

> **Preduslov:** 50+ aktivnih tenanata.

**Prioritet V1:** Waiter app, Kitchen display, Housekeeping app, Front desk quick actions.

---

## ⬜ Faza 8 — Loyalty program + Guest App addon

- Loyalty bodovi, tier sistem, redemption
- Guest App proširenje: room service, spa booking, loyalty prikaz

---

## ⬜ Faza 9 — Portfolio Owner Dashboard

- `portfolios`, `brands`, `property_groups` tabele
- Portfolio KPI dashboard, komparativna analitika
- Alert sistem za anomalije

---

## ⬜ Faza 10 — Brand & Regional Management

- Centralizovani sabloni (meni, HR politike, housekeeping standardi)
- Hijerarhija pristupa: owner → brand manager → regional manager → property manager

---

## Tehnički dug / Poznati problemi

| Stavka | Prioritet | Napomena |
|--------|-----------|----------|
| Resend domen verifikacija | 🔴 Visok | `onboarding@resend.dev` → vlastiti domen prije produkcije |
| RESEND_API_KEY regeneracija | 🔴 Visok | Ključ bio izložen u chatu |
| PAYPAL_WEBHOOK_ID env var | 🟡 Srednji | Signature verifikacija ne radi bez ovoga |
| SITE_URL env var u Supabase | 🟡 Srednji | Guest App URL u emailima zavisi od ovoga |
| Stripe addon purchase flow | 🟡 Srednji | "Aktiviraj" dugme vodi samo na info, ne checkout |
| `get_available_rooms()` RPC | 🟡 Srednji | Booking engine radi bez prave availability provjere |
| Folio PDF export | 🟢 Nizak | FolioPrint postoji ali nema server-side PDF |

---

## Dnevnik napretka

| Faza | Zadatak | Status | Datum |
|------|---------|--------|-------|
| 1 | Subscriptions + addon_catalog tabele | ✅ | 2026-05-28 |
| 1 | hasAddon() helper + PlatformContext | ✅ | 2026-05-28 |
| 1 | UpgradePrompt + AddonGuard | ✅ | 2026-05-28 |
| 1 | BillingPage UI + trial sistem | ✅ | 2026-05-28 |
| 1 | Stripe webhook skeleton | ✅ | 2026-05-28 |
| 1 | Stripe addon purchase flow | ⬜ | |
| 2 | room_types + rooms tabele | ✅ | 2026-05-28 |
| 2 | hotel_reservations tabela | ✅ | 2026-05-28 |
| 2 | folios + folio_items tabele | ✅ | 2026-05-28 |
| 2 | orders.folio_id integracija | ✅ | 2026-05-28 |
| 2 | HotelDashboard | ✅ | 2026-05-28 |
| 2 | RoomsPage + RoomCard | ✅ | 2026-05-28 |
| 2 | RoomFormPage (kreiranje/uređivanje soba) | ✅ | 2026-05-30 |
| 2 | RoomTypesPage | ✅ | 2026-05-28 |
| 2 | ReservationsPage + ReservationForm | ✅ | 2026-05-28 |
| 2 | CalendarPage (Gantt availability) | ✅ | 2026-05-28 |
| 2 | FrontDeskPage (check-in/out) | ✅ | 2026-05-28 |
| 2 | FolioPage + FolioPrint | ✅ | 2026-05-28 |
| 2 | RatePlansPage | ✅ | 2026-05-28 |
| 2 | BookingSettings | ✅ | 2026-05-28 |
| 2 | HousekeepingPage | ✅ | 2026-05-28 |
| 2 | RevenueManagementPage | ✅ | 2026-05-28 |
| 3 | BookingPage (/:slug/book) | ✅ | 2026-05-29 |
| 3 | send-booking-email Edge Function | ✅ | 2026-05-29 |
| 3 | guest_requests tabela + RLS | ✅ | 2026-05-30 |
| 3 | SECURITY DEFINER RPCs za guest pristup | ✅ | 2026-05-30 |
| 3 | room_availability tabela + get_available_rooms() | ⬜ | |
| 3 | Stripe payment za booking | ⬜ | |
| 3 | Cancellation flow + refund | ⬜ | |
| 4 | housekeeping_tasks tabela | ✅ | 2026-05-29 |
| 4 | HousekeepingPage UI | ✅ | 2026-05-29 |
| 4 | Auto-task trigger pri check-outu | ⬜ | |
| 5 | revenue_metrics view + pg funkcija | ✅ | 2026-05-29 |
| 5 | RevenueManagementPage UI | ✅ | 2026-05-29 |
| 5 | Price suggestion algoritam | ⬜ | |
| X | react-i18next setup (MNE/EN) | ✅ | 2026-05-29 |
| X | LanguageSwitcher komponenta | ✅ | 2026-05-29 |
| X | ThemeToggle redesign | ✅ | 2026-05-29 |
| X | GuestAppPage (/:slug/guest) | ✅ | 2026-05-30 |
| X | FrontDeskPage — Zahtjevi gostiju tab | ✅ | 2026-05-30 |
| X | Booking email s Guest App linkom | ✅ | 2026-05-30 |
| X | Hotel Landing Page (/:slug/hotel) | ✅ | 2026-05-30 |
| X | hotel_visibility — konfigurabilni link iz menija | ✅ | 2026-05-30 |
| X | anon SELECT policy na room_types | ✅ | 2026-05-30 |
| Y | landing_pages tabela | ⬜ | |
| Y | Hotel sajt block editor (/admin/hotel/landing) | ⬜ | |
| Y | Restoran sajt block editor (/admin/settings/landing) | ⬜ | |
| Y | Dinamički rendering blokova na /:slug/hotel | ⬜ | |
| Y | Dinamički rendering blokova na /:slug (ili /home) | ⬜ | |
| Y | Upload slika u Supabase Storage | ⬜ | |
| Y | Custom domain podrška | ⬜ | |
| 6 | Beds24 API integracija | ⬜ | |
| 7 | Expo projekt setup | ⬜ | |
| 8 | Loyalty program | ⬜ | |
| 9 | Portfolio dashboard | ⬜ | |
| 10 | Brand & Regional management | ⬜ | |

---

## Roadmap timeline (ažurirano)

```
2026
│
├── Maj        ✅ Faza 1 — Billing infrastruktura (osnova završena)
│              ✅ Faza 2 — Hotel Core modul (ZAVRŠEN)
│              ✅ Faza 3 — Booking Engine (booking stranica + email ✅, availability engine ⬜)
│              ✅ Faza 4 — Housekeeping (UI ✅, auto-trigger ⬜)
│              ✅ Faza 5 — Revenue Management (UI ✅, export ⬜)
│              ✅ Faza X — Guest Experience (i18n, Guest App, Hotel Landing) ← OVDJE SMO
│
├── Jun        🔄 Faza Y — Customizabilni hotel + restoran sajtovi (block editor)
│                          landing_pages tabela, hotel editor, restoran editor
│
├── Jun–Jul    🔄 Faza 3 dopuna — Availability engine, room_availability
│
├── Jul–Aug    ⬜ Faza 1 dopuna — Stripe addon purchase flow
│
├── Sep+       ⬜ Faza 6 — Channel Manager (Beds24)
│
2027
│
├── TBD        ⬜ Faza 7 — Mobilna aplikacija (React Native / Expo)
├── TBD        ⬜ Faza 8 — Loyalty + Guest App addon
├── TBD        ⬜ Faza 9 — Portfolio Owner Dashboard
└── TBD        ⬜ Faza 10 — Brand & Regional Management
```

---

*Roadmap ažuriran: 2026-05-30 | Branch: main | Deployment: Vercel auto-deploy*
