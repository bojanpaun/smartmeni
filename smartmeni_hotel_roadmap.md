# SmartMeni → HospitalityOS — Produkt roadmap

> **Verzija:** 2.3 *(dopunjeno — Faza 8.5 Spa & Wellness razrađena i korigovana — 2026-05-31)*
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
    │                 │   │ Spa & Wellness  │
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
| `spa_wellness` | Booking spa tretmana, kapaciteta, terapeuti, folio integracija | ⬜ Faza 8.5 |

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

#### `room_availability` tabela + `get_available_rooms()` RPC
```sql
-- Tabela za inventory po datumu
CREATE TABLE room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID REFERENCES room_types(id),
  date DATE NOT NULL,
  total_rooms INT,
  available_rooms INT,
  stop_sell BOOLEAN DEFAULT false,
  UNIQUE(room_type_id, date)
);

-- PostgreSQL funkcija za provjeru dostupnosti
CREATE OR REPLACE FUNCTION get_available_rooms(
  p_restaurant_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_adults INT DEFAULT 1
)
RETURNS TABLE (
  room_type_id UUID,
  room_type_name TEXT,
  available_count INT,
  price_per_night NUMERIC,
  total_price NUMERIC,
  nights INT
) AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
BEGIN
  RETURN QUERY
  SELECT
    rt.id, rt.name,
    MIN(ra.available_rooms)::INT,
    rp.price_per_night,
    rp.price_per_night * v_nights,
    v_nights
  FROM room_types rt
  JOIN room_availability ra ON ra.room_type_id = rt.id
  JOIN rate_plans rp ON rp.room_type_id = rt.id AND rp.is_active = true
  WHERE rt.restaurant_id = p_restaurant_id
    AND rt.max_occupancy >= p_adults
    AND rt.is_active = true
    AND ra.date >= p_check_in AND ra.date < p_check_out
    AND ra.available_rooms > 0
    AND ra.stop_sell = false
    AND rp.min_stay <= v_nights
  GROUP BY rt.id, rt.name, rp.price_per_night
  HAVING COUNT(ra.date) = v_nights;
END;
$$ LANGUAGE plpgsql;
```
Trigger koji smanjuje `available_rooms` pri potvrdi rezervacije i vraća ga pri otkazivanju.

#### Stripe payment flow za booking
```
Gost bira sobu
  ↓
Stripe Payment Intent (amount = total_price)
  ↓
Kartica potvrđena
  ↓
Webhook: payment_intent.succeeded
  ↓
Edge Function: kreira hotel_reservation, smanjuje room_availability, šalje email
```

#### Cancellation flow
- ⬜ Gost može otkazati putem linka iz emaila (do X sati unaprijed)
- ⬜ Stripe refund (pun ili djelimičan, zavisno od cancellation policy rate plana)
- ⬜ `room_availability` se vraća na prethodni nivo

#### Ostalo:
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

## ⬜ Faza Y.1 — Upload slika u Supabase Storage

> **Preduslov:** Faza Y završena (block editori rade).
> **Trajanje:** 2–3 dana

Trenutno editori primaju URL-ove kao text input. Cilj: pravi drag & drop upload direktno u Supabase Storage.

### Šta treba:

**Baza / Storage:**
- Novi public bucket `landing-images` u Supabase Storage
- RLS policy: INSERT dozvoljen autentifikovanim korisnicima (vlastiti tenant folder)
- Struktura putanje: `landing-images/{restaurant_id}/{timestamp}_{filename}`

**`ImageUpload` komponenta:**
```jsx
// src/components/shared/ImageUpload.jsx
// Props: value (url), onChange(url), label, accept
// Internalno: drag & drop zona + klik za odabir
// Upload: supabase.storage.from('landing-images').upload(path, file)
// Po uspjehu: poziva onChange sa javnim URL-om
// Preview: thumbnail slike odmah po uploadu
```

**Gdje zamijeniti URL input s ImageUpload:**
1. `HotelLandingEditor` — Hero `bg_image_url`, O hotelu `image_url`, Galerija `image_urls`
2. `RestaurantLandingEditor` — Hero `bg_image_url`, Priča `image_url`, Galerija `image_urls`
3. `RoomTypesPage` — `images` JSONB polje
4. `LogoUpload` — već postoji, može se refaktorisati da koristi isti komponent

**Definition of Done:**
- [ ] `landing-images` bucket kreiran sa ispravnom RLS politikom
- [ ] `ImageUpload` komponenta radi (drag & drop + click + preview)
- [ ] Hero blokovi u oba editora koriste upload umjesto URL tekst polja
- [ ] Galerija blok uploaduje multiple slike

---

## ⬜ Faza 6 — Channel Manager (`channel_manager`)

> **Preduslov:** `hotel_core` + `booking_engine` s availability engineom.
> **Trajanje:** 12–16 sedmica — najveći tehnički izazov u projektu.
> **Napomena:** Premium addon zbog troška i kompleksnosti razvoja.

### Zašto je ovo teško
- Booking.com Connectivity Partner program zahtijeva aplikaciju, review i certifikaciju (2–6 mj)
- Svaki OTA kanal ima vlastiti XML/JSON API sa drugačijim modelom podataka
- Availability i rate sync mora biti real-time — overbooking je katastrofalan
- Svaki kanal ima drugačiju politiku otkazivanja i provizija

### Strategija: Beds24 middleware (preporučeno)

Umjesto direktnih integracija sa svakim OTA-om, integracija sa jednim aggregatorom:

```
SmartMeni ←→ Beds24 REST API
                ↓
    Beds24 ←→ Booking.com
    Beds24 ←→ Airbnb
    Beds24 ←→ Expedia
    Beds24 ←→ 100+ OTA-a
```

Beds24, Lodgify i SiteMinder su već certificirani partneri svih major OTA-a. Naplatiti kao premium addon i uračunati Beds24 API trošak u cijenu.

### Ključne funkcionalnosti:
```js
// src/lib/channelManager.js
syncAvailability(restaurantId, roomTypeId, dates)
  // SmartMeni → Beds24 → svi OTA kanali

syncRates(restaurantId, roomTypeId, ratePlan)
  // Sinhronizacija cijena na sve kanale

handleExternalBooking(beds24Booking)
  // Webhook: nova rezervacija sa Booking.com/Airbnb
  // → kreira hotel_reservation (source: 'booking_com')
  // → smanjuje room_availability
  // → šalje email potvrdu gostu
```

**Definition of Done:**
- [ ] Beds24 API integracija radi u test modu
- [ ] Promjena dostupnosti u SmartMeniju se reflektuje na Booking.com
- [ ] Nova rezervacija sa Booking.coma se pojavljuje u dashboardu
- [ ] Otkazivanje sa eksternog kanala ažurira dostupnost
- [ ] Overbooking prevencija radi (real-time sync ili buffer strategija)

---

## ⬜ Faza 7 — Mobilna aplikacija (React Native / Expo)

> **Preduslov:** 50+ aktivnih tenanata, validiran produkt.
> **Trajanje:** 16–24 sedmice
> **Tehnologija:** React Native (Expo) — dijeli hooks, API pozive i logiku sa web app

### Zašto Expo
- Jedan codebase → iOS + Android
- Supabase React Native SDK postoji i dobro radi
- Over-the-air updates bez app store reviewa (za bug fixove)
- EAS Build — cloud build bez Mac-a (za Android)

### Prioritet ekrana po verzijama

**V1 (launch):**
- Waiter app — primanje i upravljanje narudžbama, waiter requests
- Kitchen display — prikaz narudžbi u kuhinji (mora raditi offline)
- Housekeeping app — taskovi za sobarice, mobilni prikaz
- Front desk quick actions — check-in/out, room status

**V2:**
- Guest app — digitalni meni, room service, rezervacije, folio
- Manager overview — KPIs, live occupancy, prihod danas
- HR — osoblje vidi raspored, prijava prisustva

**V3:**
- Push notifikacije za sve role
- Offline mode za Kitchen display
- NFC check-in

```bash
# Setup
npm install -g @expo/cli
npx create-expo-app smartmeni-mobile --template
# Apple Developer: 99$/god | Google Play Console: 25$ jednokratno
eas build --platform all  # production build
```

**Definition of Done V1:**
- [ ] Expo projekt setup, Supabase konekcija radi
- [ ] Waiter app — lista narudžbi, promjena statusa
- [ ] Kitchen display — real-time narudžbe, offline tolerantan
- [ ] Housekeeping app — lista taskova, promjena statusa
- [ ] App store submission (iOS + Android)

---

## ⬜ Faza 8 — Loyalty program + Guest App addon (`loyalty`)

> **Preduslov:** 100+ aktivnih tenanata, stabilna platforma.
> **Trajanje:** 8–10 sedmica

### Loyalty sistem
```sql
CREATE TABLE loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT,                        -- 'SmartRewards' ili vlastiti naziv
  points_per_euro NUMERIC DEFAULT 1,
  redemption_rate NUMERIC DEFAULT 0.01,  -- 1 bod = 0.01€
  tier_rules JSONB                  -- [{min_points: 0, tier: 'bronze'}, ...]
);

CREATE TABLE loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id),
  restaurant_id UUID REFERENCES restaurants(id),
  points_balance INT DEFAULT 0,
  total_points_earned INT DEFAULT 0,
  tier TEXT DEFAULT 'bronze',       -- bronze | silver | gold | platinum
  UNIQUE(guest_id, restaurant_id)
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES loyalty_accounts(id),
  type TEXT,    -- 'earn' | 'redeem' | 'expire' | 'adjustment'
  points INT,
  reference_id UUID,  -- folio_id ili order_id
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Guest App proširenje
Proširiti postojeći `GuestAppPage` (`/:slug/guest`) sa:
- Prikaz loyalty bodova i tier-a
- Room service narudžbe direktno na folio
- Spa / wellness booking (ako aktivan addon)
- Late checkout request

**Definition of Done:**
- [ ] Loyalty program tabele kreirane sa RLS
- [ ] Gost zarađuje bodove pri svakoj narudžbi/boravku
- [ ] Redemption flow — gost troši bodove pri plaćanju
- [ ] Tier sistem automatski napreduje po bodovima
- [ ] GuestApp prikazuje bodove i tier status

---


## ⬜ Faza 8.5 — Spa & Wellness modul (`spa_wellness`)

> **Preduslov:** `hotel_core` aktivan. `booking_engine` i `housekeeping` preporučeni ali nisu strogi preduslov.
> **Trajanje:** 8–10 sedmica
> **Tim:** 2 developera
> **Addon cijena:** ~199€/godišnje (hotel-specifični addon, nadgradnja Hotel verticale)

Spa & Wellness modul pokriva kompletan životni ciklus spa objekta unutar hotela — od kataloga tretmana i booking sistema do operativnog dashboarda za spa menadžera i folio integracije sa hotelskim računom.

---

### 8.5.1 Baza podataka — nove tabele

```sql
-- Prostorije / kabine spa centra
CREATE TABLE spa_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- 'Kabina 1', 'Sauna', 'Hammam', 'Bazen'
  type TEXT NOT NULL,                  -- 'treatment_room' | 'wet_facility' | 'fitness' | 'group'
  capacity INT DEFAULT 1,              -- 1 = solo, 2 = par, 10+ = grupni
  description TEXT,
  amenities JSONB DEFAULT '[]',       -- ['heated_table', 'music', 'shower']
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Katalog tretmana
CREATE TABLE spa_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- 'Aromaterapijska masaža', 'Hot stone', 'Facial'
  category TEXT NOT NULL,              -- 'massage' | 'facial' | 'body' | 'nail' | 'wellness' | 'group'
  description TEXT,
  duration_minutes INT NOT NULL,       -- 30, 60, 90, 120
  buffer_minutes INT DEFAULT 15,       -- priprema kabine između tretmana
  price NUMERIC(10,2) NOT NULL,
  price_couple NUMERIC(10,2),          -- cijena za par tretman (opciono)
  max_guests INT DEFAULT 1,
  allowed_room_types TEXT[],           -- koji tip kabine može primiti ovaj tretman
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  requires_consultation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Terapeuti (proširenje na staff modul)
CREATE TABLE spa_therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  bio TEXT,
  specializations TEXT[],              -- ['deep_tissue', 'hot_stone', 'facial']
  languages TEXT[] DEFAULT ARRAY['bs'],
  rating NUMERIC(3,2),                 -- 0.00–5.00, automatski iz recenzija
  is_available BOOLEAN DEFAULT true,
  UNIQUE(staff_id, restaurant_id)
);

-- Veza: koji terapeut može raditi koji tretman
CREATE TABLE spa_therapist_services (
  therapist_id UUID REFERENCES spa_therapists(id) ON DELETE CASCADE,
  service_id UUID REFERENCES spa_services(id) ON DELETE CASCADE,
  PRIMARY KEY (therapist_id, service_id)
);

-- Sezonski cjenovnik (override na spa_services.price)
CREATE TABLE spa_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  service_id UUID REFERENCES spa_services(id),
  label TEXT NOT NULL,                 -- 'Ljetna sezona', 'Vikend rate', 'Early bird'
  price_override NUMERIC(10,2),
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  days_of_week INT[],                  -- [1,2,3,4,5] = pon-pet, [6,7] = vikend
  is_active BOOLEAN DEFAULT true
);

-- Spa rezervacije (termini)
CREATE TABLE spa_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  service_id UUID REFERENCES spa_services(id),
  therapist_id UUID REFERENCES spa_therapists(id),
  spa_room_id UUID REFERENCES spa_rooms(id),
  guest_id UUID REFERENCES guests(id),
  hotel_reservation_id UUID REFERENCES hotel_reservations(id), -- null za vanjske goste

  -- Termin
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,              -- start_time + duration + buffer
  duration_minutes INT NOT NULL,

  -- Gost podaci (za vanjske goste koji nisu u guests tabeli)
  external_guest_name TEXT,
  external_guest_phone TEXT,
  external_guest_email TEXT,           -- potreban za email potvrdu vanjskim gostima

  -- Finansije
  price NUMERIC(10,2) NOT NULL,
  payment_method TEXT,                 -- 'folio' | 'card' | 'cash'
  payment_status TEXT DEFAULT 'pending', -- pending | paid | refunded | no_show

  -- Status
  status TEXT DEFAULT 'confirmed',    -- confirmed | checked_in | completed | cancelled | no_show
  notes TEXT,                          -- interni notes terapeuta
  guest_notes TEXT,                    -- posebni zahtjevi gosta

  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Podešavanja spa centra (radno vrijeme, politika otkazivanja)
CREATE TABLE spa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE UNIQUE,
  open_time TIME DEFAULT '09:00',
  close_time TIME DEFAULT '20:00',
  -- Radno vrijeme po danima (null = ne radi; 0=ned, 1=pon, ..., 6=sub)
  working_days INT[] DEFAULT ARRAY[1,2,3,4,5,6],
  min_advance_hours INT DEFAULT 2,     -- minimum X sati unaprijed za booking
  cancellation_hours INT DEFAULT 24,   -- besplatno otkazivanje do X sati prije
  reminder_hours INT DEFAULT 2,        -- email podsjetnik X sati prije termina
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Spa inventar (potrošni materijal — ulja, kreme, čarape...)
-- Koristi postojeću inventory_items tabelu sa category = 'spa'
-- Dodati kolonu ako ne postoji:
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS
  category TEXT DEFAULT 'general';

-- Napomena: folio_items.type treba podržavati vrijednost 'spa'.
-- Ako postoji CHECK constraint, dodati 'spa' u dozvoljene tipove migracijom:
-- ALTER TABLE folio_items DROP CONSTRAINT IF EXISTS folio_items_type_check;
-- (folio_items.type je TEXT bez constraint-a — nova vrijednost 'spa' radi bez izmjene)

-- Retail spa proizvodi (prodaja gostima)
CREATE TABLE spa_retail_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT NOT NULL,                  -- 'Lavender massage oil 100ml'
  brand TEXT,
  price NUMERIC(10,2),
  stock_quantity INT DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Spa paketi (hotel soba + tretmani = paket cijena)
CREATE TABLE spa_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT NOT NULL,                  -- 'Romantic getaway', 'Wellness weekend'
  description TEXT,
  includes JSONB NOT NULL,
  -- [{type: 'room_type', id: '...', nights: 2},
  --  {type: 'spa_service', id: '...', quantity: 2},
  --  {type: 'meal', description: 'Breakfast included'}]
  total_price NUMERIC(10,2),
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 8.5.2 Dostupnost — algoritam za spa termine

Za razliku od soba (dostupnost po danima), spa termin je dostupan po vremenskim slotovima unutar dana.

```sql
-- PostgreSQL funkcija: slobodni termini za tretman na određeni dan
CREATE OR REPLACE FUNCTION get_available_spa_slots(
  p_restaurant_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_therapist_id UUID DEFAULT NULL  -- null = bilo koji dostupni terapeut
)
RETURNS TABLE (
  slot_start TIME,
  slot_end TIME,
  therapist_id UUID,
  therapist_name TEXT,
  spa_room_id UUID,
  room_name TEXT,
  price NUMERIC
) AS $$
DECLARE
  v_service spa_services%ROWTYPE;
  v_duration INT;
  v_buffer INT;
  v_total_minutes INT;
  v_open_time TIME := '09:00';    -- ovo će biti iz restaurant_settings
  v_close_time TIME := '20:00';
BEGIN
  SELECT * INTO v_service FROM spa_services WHERE id = p_service_id;
  -- Učitaj radno vrijeme iz spa_settings (fallback na 09:00-20:00)
  SELECT COALESCE(ss.open_time,  '09:00'::TIME),
         COALESCE(ss.close_time, '20:00'::TIME)
  INTO v_open_time, v_close_time
  FROM spa_settings ss
  WHERE ss.restaurant_id = p_restaurant_id;

  v_total_minutes := v_service.duration_minutes + v_service.buffer_minutes;

  RETURN QUERY
  WITH time_slots AS (
    -- Generiše sve potencijalne slotove svakih 30 min
    SELECT generate_series(
      p_date + v_open_time,
      p_date + v_close_time - (v_total_minutes || ' minutes')::INTERVAL,
      '30 minutes'::INTERVAL
    )::TIMESTAMPTZ AS slot_start
  ),
  available_therapists AS (
    SELECT t.id AS therapist_id,
           s.first_name || ' ' || s.last_name AS therapist_name
    FROM spa_therapists t
    JOIN staff s ON s.id = t.staff_id
    JOIN spa_therapist_services ts ON ts.therapist_id = t.id
    WHERE t.restaurant_id = p_restaurant_id
    AND ts.service_id = p_service_id
    AND t.is_available = true
    AND (p_therapist_id IS NULL OR t.id = p_therapist_id)
  ),
  available_rooms AS (
    SELECT r.id AS room_id, r.name AS room_name
    FROM spa_rooms r
    WHERE r.restaurant_id = p_restaurant_id
    AND r.is_active = true
    AND v_service.allowed_room_types @> ARRAY[r.type]
  )
  SELECT
    ts.slot_start::TIME,
    (ts.slot_start + (v_service.duration_minutes || ' minutes')::INTERVAL)::TIME,
    at.therapist_id,
    at.therapist_name,
    ar.room_id,
    ar.room_name,
    COALESCE(
      (SELECT price_override FROM spa_pricing_rules
       WHERE service_id = p_service_id
       AND p_date BETWEEN valid_from AND valid_to
       AND is_active = true
       AND (days_of_week IS NULL OR EXTRACT(DOW FROM p_date) = ANY(days_of_week))
       LIMIT 1),
      v_service.price
    ) AS price
  FROM time_slots ts
  CROSS JOIN available_therapists at
  CROSS JOIN available_rooms ar
  WHERE NOT EXISTS (
    -- Provjeri da terapeut nema drugi termin koji se preklapa (uz buffer)
    SELECT 1 FROM spa_appointments a
    WHERE a.therapist_id = at.therapist_id
    AND a.appointment_date = p_date
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (
      ts.slot_start::TIME < a.end_time AND
      (ts.slot_start + (v_total_minutes || ' minutes')::INTERVAL)::TIME > a.start_time
    )
  )
  AND NOT EXISTS (
    -- Provjeri da kabina nije zauzeta
    SELECT 1 FROM spa_appointments a
    WHERE a.spa_room_id = ar.room_id
    AND a.appointment_date = p_date
    AND a.status NOT IN ('cancelled', 'no_show')
    AND (
      ts.slot_start::TIME < a.end_time AND
      (ts.slot_start + (v_total_minutes || ' minutes')::INTERVAL)::TIME > a.start_time
    )
  )
  ORDER BY ts.slot_start, at.therapist_name;
END;
$$ LANGUAGE plpgsql;
```

---

### 8.5.3 DB trigger — automatski folio item

Kada se spa termin potvrdi sa `payment_method = 'folio'`, automatski se dodaje stavka na hotelski folio:

```sql
CREATE OR REPLACE FUNCTION create_spa_folio_item()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_method = 'folio'
     AND NEW.hotel_reservation_id IS NOT NULL
     AND NEW.status = 'confirmed'
     AND (OLD.status IS DISTINCT FROM 'confirmed' OR TG_OP = 'INSERT') THEN

    INSERT INTO folio_items (
      folio_id, type, description, quantity, unit_price, total_price, date
    )
    SELECT
      f.id,
      'spa',
      (SELECT name FROM spa_services WHERE id = NEW.service_id),
      1,
      NEW.price,
      NEW.price,
      NEW.appointment_date
    FROM folios f
    WHERE f.reservation_id = NEW.hotel_reservation_id
    AND f.status = 'open'
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_spa_folio
AFTER INSERT OR UPDATE ON spa_appointments
FOR EACH ROW EXECUTE FUNCTION create_spa_folio_item();
```

---

### 8.5.4 Frontend struktura

**Admin rute** (sve pod `/admin/hotel/spa/...` jer preduslov je `hotel_core`):

| Ruta | Stranica |
|------|---------|
| `/admin/hotel/spa` | SpaDashboard |
| `/admin/hotel/spa/calendar` | SpaCalendarPage |
| `/admin/hotel/spa/appointments` | AppointmentsPage |
| `/admin/hotel/spa/services` | ServicesPage |
| `/admin/hotel/spa/therapists` | TherapistsPage |
| `/admin/hotel/spa/rooms` | SpaRoomsPage |
| `/admin/hotel/spa/packages` | PackagesPage |
| `/admin/hotel/spa/analytics` | SpaAnalyticsPage |
| `/admin/hotel/spa/settings` | SpaSettingsPage |

```
src/modules/spa/
├── pages/
│   ├── SpaDashboard.jsx          -- Dnevni pregled: termini, prihod, utilization
│   ├── SpaCalendarPage.jsx       -- Gantt po terapeutima i kabinama (dnevni/sedmični)
│   ├── AppointmentsPage.jsx      -- Lista svih termina sa filterima
│   ├── AppointmentDetail.jsx     -- Detalji termina, notes, folio status
│   ├── ServicesPage.jsx          -- Upravljanje katalogom tretmana
│   ├── TherapistsPage.jsx        -- Profili terapeuta, specijalizacije, raspored
│   ├── SpaRoomsPage.jsx          -- Upravljanje kabinama
│   ├── PackagesPage.jsx          -- Kreiranje i upravljanje spa paketima
│   ├── SpaAnalyticsPage.jsx      -- Revenue per treatment, utilization rate
│   └── SpaSettingsPage.jsx       -- Radno vrijeme, buffer, politika otkazivanja
├── components/
│   ├── AppointmentCard.jsx       -- Kartica termina u kalendaru
│   ├── TherapistSchedule.jsx     -- Raspored jednog terapeuta (dnevni view)
│   ├── ServiceCard.jsx           -- Kartica tretmana sa slikom i cijenom
│   ├── SlotPicker.jsx            -- UI za odabir slobodnog termina
│   └── SpaKPIWidgets.jsx         -- Revenue, bookings today, utilization
└── hooks/
    ├── useSpaAvailability.js     -- Poziva get_available_spa_slots()
    ├── useSpaAppointments.js     -- CRUD za termine
    └── useSpaAnalytics.js        -- Revenue i utilization metrike
```

---

### 8.5.5 Javni booking widget (gosti)

Dostupan na `/:slug/spa` za direktno bookiranje tretmana:

```
Tok za hotelskog gosta (iz Guest App, login putem rezervacijskog koda):
1. Pregled kataloga tretmana (slike, opis, trajanje, cijena)
2. Odabir tretmana
3. Odabir terapeuta (opciono — "bez preference" je opcija)
4. Odabir datuma i slobodnog termina (get_available_spa_slots())
5. Potvrda + odabir načina plaćanja (folio ili kartica)
6. Email potvrda → folio item automatski kreira DB trigger
7. Podsjetnik email X sati prije (iz spa_settings.reminder_hours)

Tok za vanjskog gosta (spa day visitor, bez hotel rezervacije):
1. Isti tok odabira tretmana / terapeuta / termina
2. Unos kontakt podataka (ime, telefon, email → external_guest_*)
3. Plaćanje karticom (Stripe Payment Intent)
4. Email potvrda na external_guest_email
5. Podsjetnik email X sati prije termina
```

**Booking flow za spa pakete (`spa_packages`):**
Paketi se kreiraju u admin panelu (`PackagesPage`). Gost ih može bookirati na `/:slug/spa` na posebnoj kartici "Paketi". Odabirom paketa koji uključuje smještaj, sistem preusmjerava na standardni hotel booking flow (`/:slug/book`) sa pre-odabranim tipom sobe, a tretmani se automatski dodaju kao spa termini uz rezervaciju. Paketi bez smještaja direktno otvaraju spa booking flow za sve uključene tretmane.

**Email podsjetnik — implementacija:**
Edge Function `send-spa-reminder` poziva se pg_cron jobom svakih 15 minuta:
```sql
SELECT cron.schedule('spa-reminders', '*/15 * * * *',
  $$SELECT net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/send-spa-reminder',
    headers := '{"Authorization": "Bearer " || current_setting("app.service_key")}',
    body := '{}') $$
);
```
Funkcija traži termine čiji je `start_time` za `reminder_hours` sati od sada (±15 min tolerancija), i šalje HTML email sa detaljima termina.

---

### 8.5.6 Operativni dashboard — Spa menadžer

Spa Calendar prikazuje Gantt po terapeutima — svaki red je terapeut, kolone su vremenski slotovi:

```
          | 09:00 | 09:30 | 10:00 | 10:30 | 11:00 | 11:30 | 12:00 |
----------|-------|-------|-------|-------|-------|-------|-------|
Ana K.    | [==Aromaterapija 60min==]  |  [prep] | [===Hot Stone===]
Marko P.  |       | [=Facial 45min=]          |       | [==Deep tissue==]
Kabina 3  | [==============Hammam (par)================]  |
```

**Ključne metrike na dashboard-u:**
- Termini danas: potvrđeni / završeni / no-show
- Prihod danas (folio + direktno)
- Utilization rate: % popunjenosti rasporeda terapeuta
- Upcoming termini — sljedećih 2 sata

---

### 8.5.7 Analitika

```sql
-- View za spa analitiku
CREATE OR REPLACE VIEW spa_analytics AS
SELECT
  a.restaurant_id,
  DATE_TRUNC('month', a.appointment_date) AS month,
  COUNT(*) AS total_appointments,
  COUNT(CASE WHEN a.status = 'completed' THEN 1 END) AS completed,
  COUNT(CASE WHEN a.status = 'no_show' THEN 1 END) AS no_shows,
  SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END) AS revenue,
  AVG(CASE WHEN a.status = 'completed' THEN a.price END) AS avg_revenue_per_treatment,
  COUNT(CASE WHEN a.hotel_reservation_id IS NOT NULL THEN 1 END) AS hotel_guests,
  COUNT(CASE WHEN a.hotel_reservation_id IS NULL THEN 1 END) AS external_guests,
  -- Utilization = zauzeti minuti / (radni sati * broj terapeuta * radni dani)
  SUM(CASE WHEN a.status = 'completed' THEN a.duration_minutes ELSE 0 END) AS total_treatment_minutes,
  s.name AS service_name
FROM spa_appointments a
JOIN spa_services s ON s.id = a.service_id
GROUP BY a.restaurant_id, DATE_TRUNC('month', a.appointment_date), s.name;
```

**Izvještaji dostupni spa menadžeru:**
- Revenue po tretmanu (koji tretman donosi najviše prihoda)
- Utilization rate po terapeutu (ko je najpopularniji)
- No-show stopa i trend (za optimizaciju politike otkazivanja)
- Hotel gosti vs. vanjski gosti — omjer
- Najpopularniji termini (peak hours)
- Export u PDF/Excel

---

### 8.5.8 Integracije sa postojećim modulima

| Modul | Integracija |
|-------|-------------|
| `hotel_core` / Folio | Spa tretman → automatski folio item via DB trigger |
| `booking_engine` | Spa booking dostupan na hotelskoj landing stranici |
| `inventory_pro` | Spa potrošni materijal (ulja, kreme) prati se kroz inventory |
| `hr_pro` | Terapeuti su u staff tabeli — rasporedi, prisustvo, payroll |
| `housekeeping` | Kabina nakon tretmana → automatski housekeeping task (čišćenje) |
| `loyalty` | Spa tretman donosi loyalty bodove hotelskim gostima |
| `guest_app` | Gost booira tretman direktno iz Guest App na telefonu |
| `analytics_pro` | Spa metrike integrisane u opći revenue dashboard hotela |

---

### Definition of Done — Faza 8.5

- [ ] `spa_rooms`, `spa_services`, `spa_therapists`, `spa_appointments` tabele kreirane sa RLS
- [ ] `spa_therapist_services` veza radi (terapeut → tretmani koje može raditi)
- [ ] `get_available_spa_slots()` PostgreSQL funkcija vraća ispravne slobodne termine
- [ ] Buffer vrijeme između termina se pravilno računa (terapeut i kabina)
- [ ] DB trigger automatski kreira folio item za hotel goste
- [ ] Spa Calendar (Gantt) prikazuje dnevni/sedmični raspored po terapeutima
- [ ] Javna booking stranica radi na `/:slug/spa`
- [ ] Booking flow za hotelskog gosta (folio plaćanje) radi end-to-end
- [ ] Booking flow za vanjskog gosta (Stripe plaćanje) radi end-to-end
- [ ] Email potvrda i podsjetnik se šalju automatski
- [ ] No-show tracking — terapeut može označiti no-show
- [ ] Spa paket (room + tretmani) se može kreirati i bookirati
- [ ] Spa analitika prikazuje utilization rate i revenue per treatment
- [ ] `inventory_pro` integracija — spa materijal se oduzima po završenom tretmanu (opciono)
- [ ] RLS: spa podaci jednog hotela nisu vidljivi drugom

---

## ⬜ Faza 9 — Portfolio Owner Dashboard (`portfolio_owner`, `multi_property`)

> **Preduslov:** `multi_property` addon aktivan, minimum 2 objekta na platformi.
> **Trajanje:** 8–10 sedmica

### Arhitektura — hijerarhija tenanata
Trenutna arhitektura ima jedan nivo (`restaurant_id`). Portfolio owner zahtijeva:
```
portfolio (top-level — vlasnik)
  └── brand (opciono — "Grand Hotels", "Bistro Co.")
        └── property_group (opciono — "Jadranska regija", "Centralna EU")
              └── restaurant / hotel (tenant — postojeća arhitektura)
```

### Ključne tabele:
```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  currency_primary TEXT DEFAULT 'EUR'
);

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand_type TEXT  -- 'hotel' | 'restaurant' | 'mixed'
);

CREATE TABLE property_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id),
  brand_id UUID REFERENCES brands(id),
  name TEXT NOT NULL,
  country_code TEXT
);

CREATE TABLE portfolio_properties (
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id),
  property_group_id UUID REFERENCES property_groups(id),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  PRIMARY KEY (portfolio_id, restaurant_id)
);

CREATE TABLE portfolio_access (
  portfolio_id UUID REFERENCES portfolios(id),
  user_id UUID REFERENCES user_profiles(id),
  role TEXT NOT NULL,  -- 'owner' | 'regional_manager' | 'analyst' | 'auditor'
  scope JSONB,         -- null = sve, ili {group_ids:[...], property_ids:[...]}
  PRIMARY KEY (portfolio_id, user_id)
);

-- Tečajevi valuta (osvježava se dnevno via ECB API)
CREATE TABLE exchange_rates (
  from_currency TEXT NOT NULL,
  to_currency TEXT DEFAULT 'EUR',
  rate NUMERIC(10,6) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (from_currency, to_currency, date)
);
```

### Portfolio Dashboard
- Agregirani KPI-evi: ukupni prihod danas, prosječna popunjenost, broj upozorenja
- Tabela objekata: naziv, država, prihod danas, occupancy, status
- Filteri po brandu, državi, grupi
- Klik → drill-down u puni admin panel objekta

```sql
-- Materialized view za performanse (osvježava se svakih 5 min)
CREATE MATERIALIZED VIEW portfolio_kpis AS
SELECT
  pp.portfolio_id, r.id AS restaurant_id, r.name AS property_name,
  r.country_code, pp.brand_id, pp.property_group_id,
  COALESCE(SUM(CASE WHEN DATE(o.created_at) = CURRENT_DATE
    THEN o.total_amount END), 0) AS revenue_today,
  COALESCE(SUM(CASE WHEN DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', NOW())
    THEN o.total_amount END), 0) AS revenue_mtd,
  COUNT(CASE WHEN DATE(o.created_at) = CURRENT_DATE THEN 1 END) AS orders_today
FROM portfolio_properties pp
JOIN restaurants r ON r.id = pp.restaurant_id
LEFT JOIN orders o ON o.restaurant_id = r.id
GROUP BY pp.portfolio_id, r.id, r.name, r.country_code, pp.brand_id, pp.property_group_id;

-- Cron osvježavanje svakih 5 minuta
SELECT cron.schedule('refresh-portfolio-kpis', '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_kpis');
```

### Alert sistem
Edge Function `detect-portfolio-alerts` (hourly cron) provjerava:
- Prihod danas < 60% prosječnog dnevnog prihoda prošlog mj → upozorenje
- Nema narudžbi > 4 sata u radnom vremenu → upozorenje
- Popunjenost ispod definisanog praga → upozorenje
- Neriješen maintenance ticket stariji od 48h → upozorenje

### Komparativna analitika
- Side-by-side prikaz 2–5 objekata: prihod MTD, occupancy, RevPAR, ADR, trošak osoblja
- Konsolidovani finansijski izvještaji na 5 nivoa (portfelj → brand → regija → država → objekat)
- Valutna konverzija u primarnu valutu portfelja (EUR) po ECB dnevnom tečaju
- Export u PDF i Excel

**Definition of Done:**
- [ ] `portfolios`, `brands`, `property_groups`, `portfolio_access` tabele s RLS
- [ ] Portfolio dashboard prikazuje live KPI-eve svih objekata
- [ ] Hijerarhija pristupa: vlasnik vidi sve, menadžer samo vlastiti objekat
- [ ] `portfolio_kpis` materialized view osvježava se svakih 5 min
- [ ] Alert sistem detektuje anomalije i šalje notifikacije
- [ ] Komparativna analitika radi za odabrane objekte
- [ ] Konsolidovani izvještaji sa valutnom konverzijom
- [ ] Export u PDF i Excel

---

## ⬜ Faza 10 — Brand & Regional Management (`brand_mgmt`, `regional_mgmt`)

> **Preduslov:** `portfolio_owner` aktivan.
> **Trajanje:** 6–8 sedmica

### Centralizovano upravljanje šablonima
```sql
CREATE TABLE brand_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  template_type TEXT NOT NULL,
  -- 'menu_structure'       → kategorije i nazivi stavki (bez cijena)
  -- 'hr_policy'            → radno vrijeme, pravila odsustva
  -- 'housekeeping'         → standardni checklist za čišćenje
  -- 'guest_communication'  → šabloni emailova i SMS poruka
  name TEXT NOT NULL,
  template_data JSONB NOT NULL,
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE template_assignments (
  template_id UUID REFERENCES brand_templates(id),
  restaurant_id UUID REFERENCES restaurants(id),
  override_data JSONB,   -- lokalne izmjene na šablon
  applied_at TIMESTAMPTZ DEFAULT now(),
  applied_by UUID REFERENCES user_profiles(id),
  PRIMARY KEY (template_id, restaurant_id)
);
```

**Flow primjene šablona:**
1. Vlasnik edituje brand šablon (npr. dodaje novu kategoriju menija)
2. Klikne "Primijeni na sve Grand Hotels objekte"
3. Sistem šalje notifikaciju manageru svakog objekta
4. Manager prihvata / odbija / modifikuje šablon za vlastiti objekat
5. Po prihvatanju → primjenjuje se uz mogućnost lokalnih izmjena

### Hijerarhija pristupa (RBAC na portfolio nivou)
```
PORTFOLIO OWNER     → sve akcije, svi objekti, billing
  ├── BRAND MANAGER → svi objekti pod jednim brandom, brand šabloni
  ├── REGIONAL MGR  → svi objekti u svojoj grupi, HR odobravanje
  └── PROPERTY MGR  → samo vlastiti objekat (postojeća rola)
```
RLS politike se proširuju da provjeravaju `portfolio_access.scope` — regional manager ne može pristupiti podacima izvan svoje grupe ni ako zna `restaurant_id`.

**Definition of Done:**
- [ ] Brand šabloni se mogu kreirati i primjenjivati na objekte
- [ ] Manager objekta može prihvatiti/odbiti šablon sa lokalnim izmjenama
- [ ] Regional manager ima ograničen pristup samo svojoj grupi
- [ ] RLS politike pravilno provode cijelu hijerarhiju
- [ ] Notifikacije pri ažuriranju šablona stižu odgovornim osobama

---

## Tehnički dug / Poznati problemi

| Stavka | Prioritet | Šta konkretno treba | Faza |
|--------|-----------|---------------------|------|
| Resend domen verifikacija | 🔴 Visok | Verifikovati vlastiti domen na resend.com, zamijeniti `onboarding@resend.dev` u Edge Function env varijablama | Y.1 |
| RESEND_API_KEY regeneracija | 🔴 Visok | Generisati novi API key na resend.com → ažurirati u Supabase Edge Function secrets | Odmah |
| PAYPAL_WEBHOOK_ID env var | 🟡 Srednji | Dodati `PAYPAL_WEBHOOK_ID` u Supabase Edge Function secrets (PayPal Dashboard → Webhooks → ID) | 1 |
| SITE_URL env var u Supabase | 🟡 Srednji | Dodati `SITE_URL=https://smartmeni.vercel.app` u Supabase Edge Function secrets; koristi se u email linkovima | Odmah |
| Stripe addon purchase flow | 🟡 Srednji | "Aktiviraj modul" dugme treba kreirati Stripe Checkout Session i redirectovati korisnika; webhook ažurira subscription.addons | 1 dopuna |
| `room_availability` tabela + `get_available_rooms()` | 🟡 Srednji | Booking engine prikazuje sobe bez prave provjere zauzetosti — vidjeti detalje u Faza 3 Preostalo | 3 dopuna |
| Housekeeping auto-trigger | 🟡 Srednji | DB trigger `create_checkout_cleaning_task()` koji kreira task i mijenja status sobe na 'cleaning' pri check-outu | 4 |
| Folio PDF server-side | 🟢 Nizak | `FolioPrint` postoji kao print-friendly stranica, ali nema server-side PDF generisanja; razmotriti `@react-pdf/renderer` ili Puppeteer Edge Function | 2 dopuna |
| ~~Upload slika u editoru~~ | ✅ Riješeno | `ImageUpload` komponenta implementirana, oba editora ažurirana | Y.1 |
| `restaurants` tabela naziv | 🟢 Nizak | Dugoročni tehnički dug: preimenovati u `properties`/`tenants` jer hotel bez restorana i dalje ima `restaurant_id` — ne hitno za MVP | Daleka faza |

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
| Y.1 | `landing-images` Supabase Storage bucket | ✅ | 2026-05-30 |
| Y.1 | `ImageUpload` komponenta (drag & drop + preview) | ✅ | 2026-05-30 |
| Y.1 | Hero blokovi — zamjena URL inputa s ImageUpload | ✅ | 2026-05-30 |
| Y.1 | Galerija blok — multi-image upload | ✅ | 2026-05-30 |
| Y.2 | Custom domain podrška (Vercel API) | ⬜ | |
| 3d | `room_availability` tabela + trigger | ✅ | 2026-05-30 |
| 3d | `get_available_rooms()` PostgreSQL RPC | ✅ | 2026-05-30 |
| 3d | BookingPage integracija sa availability engineom | ✅ | 2026-05-30 |
| 3d | Stripe payment za booking (Payment Intent flow) | ⬜ | |
| 3d | Cancellation flow + Stripe refund | ⬜ | |
| 4d | Auto-task trigger pri check-outu (DB trigger) | ✅ | 2026-05-29 |
| 4d | Mobile-optimizovani prikaz za housekeeping osoblje | ✅ | 2026-05-30 |
| 5d | Price suggestion algoritam (suggestPrice funkcija) | ✅ | 2026-05-29 |
| 5d | Export revenue analitike u PDF/Excel | ✅ | 2026-05-30 |
| 1d | Stripe addon purchase flow (Checkout Session) | ⬜ | |
| 6 | Beds24 API integracija | ⬜ | |
| 6 | Availability/rate sync SmartMeni → Beds24 | ⬜ | |
| 6 | Webhook handler za rezervacije sa eksternih kanala | ⬜ | |
| 7 | Expo projekt setup, Supabase konekcija | ⬜ | |
| 7 | Waiter app (lista narudžbi, promjena statusa) | ⬜ | |
| 7 | Kitchen display (real-time, offline tolerantan) | ⬜ | |
| 7 | Housekeeping mobilna app | ⬜ | |
| 8 | loyalty_programs + loyalty_accounts tabele | ⬜ | |
| 8 | Loyalty earn/redeem logika | ⬜ | |
| 8 | GuestApp — loyalty prikaz i redemption | ⬜ | |
| 8.5 | spa_rooms + spa_services + spa_therapists tabele | ✅ | 2026-05-31 |
| 8.5 | spa_appointments tabela sa RLS | ✅ | 2026-05-31 |
| 8.5 | get_available_spa_slots() PostgreSQL funkcija | ✅ | 2026-05-31 |
| 8.5 | DB trigger → folio item za hotel goste | ✅ | 2026-05-31 |
| 8.5 | Admin UI — Services, Therapists, Rooms, Settings | ✅ | 2026-05-31 |
| 8.5 | Spa Calendar Gantt (terapeuti × vremenski slotovi) | ✅ | 2026-05-31 |
| 8.5 | book_spa_appointment() RPC (anon booking) | ✅ | 2026-05-31 |
| 8.5 | Javna booking stranica /:slug/spa | ✅ | 2026-05-31 |
| 8.5 | Booking flow hotelski gost (folio plaćanje + kod) | ✅ | 2026-05-31 |
| 8.5 | Email potvrda (send-spa-email Edge Function) | ✅ | 2026-05-31 |
| 8.5 | Spa analitika (revenue per treatment, no-show, CSV) | ✅ | 2026-05-31 |
| 8.5 | Spa paketi (CRUD, includes lista) | ✅ | 2026-05-31 |
| 8.5 | Booking flow vanjski gost — Stripe plaćanje | ⬜ | (Stripe odložen) |
| 8.5 | Email podsjetnik X sati prije (pg_cron) | ⬜ | |
| 9 | portfolios + brands + property_groups tabele | ⬜ | |
| 9 | portfolio_kpis materialized view + cron | ⬜ | |
| 9 | Portfolio dashboard UI | ⬜ | |
| 9 | detect-portfolio-alerts Edge Function | ⬜ | |
| 9 | Komparativna analitika + valutna konverzija | ⬜ | |
| 10 | brand_templates + template_assignments tabele | ⬜ | |
| 10 | Primjena šablona na objekte + notifikacije | ⬜ | |
| 10 | Regional manager RBAC + RLS proširenje | ⬜ | |

---

## Roadmap timeline (ažurirano)

```
2026
│
├── Maj        ✅ Faza 0  — Stabilizacija SmartMenija
│              ✅ Faza 1  — Billing infrastruktura (osnova: PayPal base plan, addon catalog)
│              ✅ Faza 2  — Hotel Core modul (sobe, rezervacije, folio, front desk, calendar)
│              ✅ Faza 3  — Booking Engine (booking stranica + email ✅)
│              ✅ Faza 4  — Housekeeping (UI ✅)
│              ✅ Faza 5  — Revenue Management (UI + metrics ✅)
│              ✅ Faza X  — Guest Experience (i18n, Guest App, Hotel Landing)
│
├── Maj–Jun    ✅ Faza Y  — Customizabilni sajtovi (block editor, hotel + restoran)
│                           landing_pages tabela, 7 hotel blokova, 6 restoran blokova
│                           /:slug/hotel i /:slug/home javne stranice
│
│              ← OVDJE SMO (2026-05-30)
│
├── Jun        🔄 Faza Y.1 — Upload slika u Supabase Storage
│                            ImageUpload komponenta, landing-images bucket
│
├── Jun        🔄 HITNO: RESEND_API_KEY regeneracija + SITE_URL env var
│
├── Jun–Jul    🔄 Faza 3d — Availability engine
│                            room_availability tabela, get_available_rooms() RPC,
│                            BookingPage integracija, Stripe payment flow
│
├── Jul        🔄 Faza 4d — Housekeeping auto-trigger + mobile prikaz
│              🔄 Faza 5d — Price suggestion algoritam + analytics export
│
├── Jul–Aug    🔄 Faza 1d — Stripe addon purchase flow
│
├── Sep+       ⬜ Faza 6  — Channel Manager (Beds24 integracija)
│
2027
│
├── Q1         ⬜ Faza 7  — Mobilna aplikacija (React Native / Expo)
│                            V1: Waiter app, Kitchen display, Housekeeping app
│
├── Q2         ⬜ Faza 8  — Loyalty program + Guest App addon
│
├── Q2–Q3      ⬜ Faza 8.5 — Spa & Wellness modul
│                            8.5.A: DB shema + get_available_spa_slots() + folio trigger
│                            8.5.B: Admin UI (Services, Therapists, Rooms, Settings)
│                            8.5.C: Spa Calendar (Gantt terapeuti × slotovi)
│                            8.5.D: Javna booking stranica /:slug/spa + email podsjetnik
│                            8.5.E: Analitika + paketi
│
├── Q3–Q4      ⬜ Faza 9  — Portfolio Owner Dashboard
│                            portfolios tabele, KPI aggregacija, alert sistem
│
└── Q4         ⬜ Faza 10 — Brand & Regional Management
                             brand šabloni, RBAC hijerarhija pristupa

2028
│
└── TBD        ⬜ Faza Y.2 — Custom domain podrška (Vercel API, po potražnji)
```

---

*Roadmap ažuriran: 2026-05-31 (v2.3 — Faza 8.5 Spa & Wellness korigovana i dopunjena: bug fix full_name→first/last_name, external_guest_email, languages array sintaksa, spa_settings tabela, admin rute, spa packages booking flow, email reminder implementacija, dijagram i timeline) | Branch: main | Deployment: Vercel auto-deploy*
