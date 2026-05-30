# SmartMeni → HospitalityOS — Produkt roadmap

> **Verzija:** 2.1 *(arhitekturalni model revidiran — 2026-05-30)*
> **Kontekst:** Evolucija SmartMeni SaaS platforme prema punom hospitality management sistemu
> **Tim:** 1 developer + Claude Code AI asistent
> **Branch:** `main` → direktno na produkciju (Vercel auto-deploy)

---

## Vizija proizvoda

SmartMeni je **hospitality platforma** koja se sastoji od vertikalnih modula (restoran, hotel) i dijeljenih operativnih servisa (HR, gosti, zalihe, analitika). Svaki vertikalni modul može funkcionisati samostalno, a kad su oba aktivirana — dijele istu bazu gostiju, osoblja i zaliha.

---

## Arhitekturalni model (usvojen 2026-05-30)

```
┌─────────────────────────────────────────────────────┐
│                 PLATFORMA (uvijek tu)               │
│   Auth · Billing · Multi-tenancy · Onboarding       │
│   Osnovno osoblje · Osnovna baza gostiju            │
└────────────┬─────────────────────┬──────────────────┘
             │                     │
    ┌────────▼────────┐   ┌────────▼────────┐
    │  RESTORAN       │   │  HOTEL          │
    │  verticala      │   │  verticala      │
    │                 │   │                 │
    │ Meni + narudžbe │   │ Sobe + booking  │
    │ Stolovi         │   │ Front desk      │
    │ Waiter zahtjevi │   │ Folio sistem    │
    │ Restoran sajt   │   │ Housekeeping    │
    │                 │   │ Revenue mgmt    │
    │                 │   │ Hotel sajt      │
    └────────┬────────┘   └────────┬────────┘
             │                     │
    ┌────────▼─────────────────────▼──────────────────┐
    │          OPERATIVNI ADDONI (dijeljeni)           │
    │                                                  │
    │  HR Pro · Inventory Pro · Analytics Pro          │
    │  Loyalty · Channel Manager · Multi-property      │
    └──────────────────────────────────────────────────┘
```

### Ključni principi

1. **Platforma nije produkt koji kupac kupuje** — to je infrastruktura. Kupac kupuje vertikale i addonе.

2. **Vertikale su samostalne** — hotel bez restorana (i obratno) funkcioniše potpuno normalno. Kad su oba aktivirana, dijele podatke.

3. **Operativni addoni rade za oba vertikala** — `hr_pro` podjednako vrijedi za restoransko i hotelsko osoblje, `inventory_pro` za kuhinjske i minibar zalihe.

4. **Svaki vertikalni modul ima vlastiti customizabilni sajt** — block-based editor, uređuje se iz admin panela, potencijalno na vlastitom domenu.

### Tehnički dug — `restaurants` tabela (⚠️ važno znati)

Trenutno `restaurants` tabla služi kao primarni tenant identifikator. Hotel bez restorana i dalje ima `restaurant_id` — što je konceptualno netačno.

**Dugoročno:** treba preименovati u `properties` ili `tenants` — neutralan entitet koji može biti restoran, hotel, ili oboje. Ovo nije hitno za MVP, ali treba biti svjestan da svaki novi modul koji se naslanja na `restaurant_id` produbljuje ovaj dug.

---

## Arhitektura naplate (Billing model)

### Vertikalne pretplate (šta kupac bira)

| Verticala | Šta uključuje | Okvirna cijena |
|-----------|--------------|----------------|
| **Restoran** | Digitalni meni, narudžbe, stolovi, waiter zahtjevi, restoran sajt, osnovna analitika, osnovni HR, osnovna baza gostiju | ~49€/mj |
| **Hotel** | Sobe, rezervacije, front desk, folio, booking engine, housekeeping, revenue mgmt, hotel sajt, Guest App | ~99€/mj |
| **Oba zajedno** | Sve gore + integracija restoran↔folio | ~129€/mj (popust) |

> **Napomena:** Trenutna implementacija koristi Base plan + addon model. Migracija prema vertikalnom modelu je produkt/billing odluka za kasniju fazu — kod je kompatibilan sa oba pristupa.

### Operativni addoni (naplaćuju se zasebno, rade za oba vertikala)

| Addon ID | Opis | Status u kodu |
|----------|------|---------------|
| `inventory_pro` | Puno upravljanje zalihama, recepture, FIFO | ✅ UI + billing guard |
| `hr_pro` | Payroll, napredni rasporedi, godišnji odmori | ✅ UI + billing guard |
| `analytics_pro` | Napredni izvještaji, export PDF/Excel | ✅ UI + billing guard |
| `loyalty` | Loyalty bodovi, tier sistem, redemption | ⬜ Faza 8 |
| `channel_manager` | Sync sa Booking.com, Airbnb, Expedia | ⬜ Faza 6 |
| `multi_property` | Upravljanje više nekretnina jednim nalogom | ⬜ Faza 9 |
| `portfolio_owner` | Portfolio dashboard, komparativna analitika | ⬜ Faza 9 |
| `brand_mgmt` | Centralizovani sabloni, više brandova | ⬜ Faza 10 |
| `regional_mgmt` | Hijerarhija pristupa za portfelje | ⬜ Faza 10 |

### Hotel-specifični addoni (naplaćuju se kao nadgradnja Hotel verticale)

| Addon ID | Opis | Status u kodu |
|----------|------|---------------|
| `hotel_core` | Osnova hotel verticale (sobe, rezervacije, folio) | ✅ Potpuno implementiran |
| `booking_engine` | Online booking sa javne stranice | ✅ UI radi, Stripe payment ⬜ |
| `housekeeping` | Housekeeping dashboard i taskovi | ✅ UI implementiran |
| `revenue_mgmt` | Dinamičke cijene, yield management, RevPAR | ✅ UI + metrics |
| `spa_wellness` | Booking spa tretmana i kapaciteta | ⬜ Daleka faza |

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

## ✅ Admin dashboard korekcije (2026-05-30)

Korekcije identifikovane pregledom dashboarda u kontekstu novog plana:

### 1. "Hotel sajt" link uz "Restoran" link ✅
- Hub header: preimenovano "Meni uživo" → "Restoran", dodat "🏨 Hotel sajt" (vidljiv samo kad je `hotel_core` aktivan)
- Sidebar sbBottom: isto — dva linka, uslovljeni addonom
- Priprema za Fazu Y kad oba sajta budu potpuno customizabilna

### 2. Addon badge na kartici modula ✅
- `MODULES` dobio `addonId` polje (trenutno samo hotel: `addonId: 'hotel_core'`)
- Kartica bez aktivnog addona: isprekidana granica, badge "Addon →", klik vodi na `/admin/billing`
- Proširivo: kad se doda `analytics_pro`, `hr_pro` itd. — samo dodati `addonId` u MODULES

### 3. Buduće korekcije (čekaju Fazu Y) ⬜
- Hotel admin navigacija: dodati "Sajt hotela" → `/admin/hotel/landing`
- Settings admin navigacija: dodati "Sajt restorana" → `/admin/settings/landing`
- Oba linka se dodaju kad se implementiraju odgovarajući editori

---

## ✅ Faza Y — Customizabilni sajtovi (ZAVRŠENA — osnova)

### Implementirano (2026-05-30)

**Baza podataka:**
- ✅ `landing_pages` tabela sa RLS (`20260530000004`)
  - `UNIQUE (restaurant_id, page_type)` — jedan sajt po tipu po tenantu
  - Anon SELECT + tenant INSERT/UPDATE/DELETE politike
  - JSONB `blocks` kolona, SEO polja, `custom_domain` (za buduće)

**Hotel sajt editor** (`/admin/hotel/landing`):
- ✅ 7 blokova: Hero, O hotelu, Tipovi smještaja (auto), Galerija, Pogodnosti, Lokacija, Kontakt
- ✅ Toggle enable/disable po bloku
- ✅ Up/down reordering blokova
- ✅ Automatski upsert (INSERT prvi put, UPDATE pri svakom save)
- ✅ SEO title/description polja
- ✅ "Vidi sajt" link → `/:slug/hotel`
- ✅ Zaštićeno `hotel_core` AddonGuardom

**Restoran sajt editor** (`/admin/settings/landing`):
- ✅ 6 blokova: Hero, Priča o restoranu, Pregled menija (auto), Galerija, Radno vrijeme + lokacija, Rezervacija CTA
- ✅ Isti UI kao hotel editor (shared CSS modul)
- ✅ "Vidi sajt" link → `/:slug/home`

**Javne stranice:**
- ✅ `/:slug/hotel` — block rendering (fallback na statički prikaz ako nema blokova)
- ✅ `/:slug/home` — nova javna stranica restorana (block rendering + statički fallback)
- ✅ Oba imaju statički fallback za tenanate koji još nisu konfigurirali blokove

**Admin navigacija:**
- ✅ Hotel admin sidebar: dodato "🌐 Sajt hotela" → `/admin/hotel/landing`
- ✅ Postavke sidebar: dodato "🌐 Sajt restorana" → `/admin/settings/landing`

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

**Definition of Done — Faza Y (osnova):**
- [x] `landing_pages` tabela sa RLS
- [x] Admin editor za hotel blokove
- [x] Admin editor za restoran blokove
- [x] `/:slug/hotel` čita i renderuje blokove
- [x] Svaki blok se može isključiti bez brisanja podataka
- [x] SEO title/description se može podesiti
- [ ] Upload slika u Supabase Storage (Faza Y.1 — sljedeće)
- [ ] Custom domain podrška (Faza Y.2 — po potražnji)

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
| X | Dashboard korekcije — addon badge + hotel sajt link | ✅ | 2026-05-30 |
| Y | landing_pages tabela sa RLS | ✅ | 2026-05-30 |
| Y | Hotel sajt block editor (/admin/hotel/landing) | ✅ | 2026-05-30 |
| Y | Restoran sajt block editor (/admin/settings/landing) | ✅ | 2026-05-30 |
| Y | Dinamički rendering blokova na /:slug/hotel | ✅ | 2026-05-30 |
| Y | Javna stranica restorana na /:slug/home | ✅ | 2026-05-30 |
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
├── Jun        ✅ Faza Y — Customizabilni hotel + restoran sajtovi (block editor) ← OVDJE SMO
│                          landing_pages tabela, hotel editor (7 blokova), restoran editor (6 blokova)
│                          /:slug/hotel block rendering, /:slug/home nova javna stranica
│
├── Jun        🔄 Faza Y.1 — Upload slika u Supabase Storage (sljedeće)
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

*Roadmap ažuriran: 2026-05-30 (Faza Y — block editor sajtovi) | Branch: main | Deployment: Vercel auto-deploy*
