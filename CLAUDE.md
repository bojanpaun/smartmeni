# rest.by.me (smartmeni) — Claude Code uputstvo

Hospitality SaaS platforma: vertikale **restoran** i **hotel** + dijeljeni operativni addoni
(HR, gosti, zalihe, analitika). Vertikale rade samostalno; kad su obje aktivne, dijele istu
bazu gostiju/osoblja/zaliha. Tim: 1 developer + Claude Code.

## Tech stack
- **Frontend:** React 18 + Vite 5, React Router v6, CSS Modules, i18next/react-i18next
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime), RLS svuda
- **Edge Functions:** Deno (`supabase/functions/`)
- **Plaćanja:** Stripe + Monri (apstrahovani provajderi), PayPal (pretplate)
- **Deploy:** Vercel auto-deploy sa `main` (SPA rewrite → `index.html`)
- **Klijent libovi:** `@dnd-kit` (DnD editor), `recharts` (analitika), `react-qr-code`, `react-hot-toast`

## Komande
```bash
npm run dev       # lokalni dev server (http://localhost:5173)
npm run build     # produkciona izgradnja (vite build)
npm run preview   # preview build-a
```
Deploy se NE radi ručno — push na `main` ⇒ Vercel automatski deployuje.

## Jezik
- **Aplikacija je na crnogorskom** (primarni jezik za sav korisnički vidljiv tekst).
- Ne miješaj hrvatski: koristi **istorija** (ne historija), **sprat** (ne kat),
  **sedmica/sedmično** (ne tjedan), **plata/zarada** (ne plaća), **zaposleni** (ne zaposlenici).
- Mijenja se SAMO vidljiv tekst (labele, opisi, toast, modali). Nikad nazivi ruta,
  varijabli, CSS klasa, DB kolona.

## Fajlovi koje IGNORISATI
Ne čitaj i ne koristi kao izvor istine ova dva root fajla — zastarjeli su:
- `HospitalityOS_Master_Roadmap - stara verzija - NE uzimati u obzir.md`
- `Hotel_IS_Funkcionalna_Specifikacija - RADNA VERZIJA - NE uzimati u obzir.md`

Aktuelni roadmap/istorija faza je u **`restbyme_hotel_roadmap.md`** — otvori ga kad ti
treba kontekst prošlih/budućih faza, ali ga ne učitavaj rutinski (velik je).

---

## Arhitektura (zapamtiti)
```
PLATFORMA (Auth · Billing · Multi-tenancy · Onboarding · osnovno osoblje/gosti)
   ├── RESTORAN verticala (meni, narudžbe, stolovi, waiter, restoran sajt)
   └── HOTEL verticala (sobe, booking, front desk, folio, housekeeping, revenue, spa)
        └── OPERATIVNI ADDONI (dijeljeni): HR Pro · Inventory Pro · Analytics Pro · Loyalty ...
```
- Platforma je infrastruktura — kupac kupuje **vertikale i addonе**, ne platformu.
- `hr_pro` / `inventory_pro` rade za OBA vertikala.

### Tenant identifikator — KRITIČNO
`restaurants` tabela je primarni tenant identifikator. Hotel bez restorana i dalje ima
`restaurant_id` (konceptualno netačno, ali tako je dok se ne odluči drugačije).
**Koristi `restaurant_id`. NE migriraj na `tenants`/`properties` bez eksplicitnog dogovora.**

---

## Pravila razvoja (obavezno)

### 1. Multi-tenancy i sigurnost
- Svaka nova tabela MORA imati `restaurant_id`. Bez iznimke.
- RLS politika je obavezna na svakoj novoj tabeli — kreirati **uz migraciju**, ne naknadno.
  Minimum: `USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))`.
- Svaki Supabase upit u komponentama koji čita/mijenja podatke mora imati eksplicitno
  `.eq('restaurant_id', restaurant.id)` — i kad RLS već štiti (defense in depth).
- `SECURITY DEFINER` RPC samo za anon pristup (booking, Guest App) — ne kao shortcut u
  autentifikovanim dijelovima.
- **Superadmin RLS politike koriste `public.is_superadmin()`** (SECURITY DEFINER helper) u
  `USING`/`WITH CHECK` — NIKAD inline `EXISTS (SELECT 1 FROM user_profiles ...)`. Inline
  varijanta pravi ciklus sa politikom `user_profiles → restaurants` i obara bazu na
  `infinite recursion` (HTTP 500). Funkcija čita `user_profiles` zaobilazeći RLS pa prekida
  ciklus. Šablon: `FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin())`.
- Foreign key constraints obavezni za sve veze. Bez slobodnih UUID referenci.

### 2. Billing i addoni
- Svaka feature iza addona ide kroz `<AddonGuard addonId="...">` (route-level, vidi `App.jsx`)
  ili `if (!hasAddon('...')) return <UpgradePrompt />`.
- U komponentama: `const { hasAddon } = usePlatform()` pa `hasAddon('addon_id')`.
  **Nikad ne čitaj `subscriptions` tabelu direktno.**
  (Low-level `hasAddon(subscription, addonId)` živi u `src/lib/planUtils.js`; komponente
  koriste verziju vezanu kroz `PlatformContext`.)
- Novi addon ID registruj na DVA mjesta: `addon_catalog` (migracija) **i** `planUtils.js`.
- Modul bez guarda = sigurnosni propust, ne tehnički dug za kasnije.
- Postojeći addoni: `hotel_core`, `spa_wellness`, `inventory_pro`, `hr_pro` (izvor istine je
  `addon_catalog`).

### 3. Baza i migracije (`supabase/migrations/`)
- **Migracije su nepromjenjive** — pushovan fajl se nikad ne edituje. Grešku ispravljaš
  novom migracijom.
- Imenovanje: `YYYYMMDDHHMMSS_kratki_opis_snake_case.sql`, stvarni datum kreiranja.
- Svaki DB trigger ima komentar ZAŠTO postoji / koji invariant štiti (ne samo šta radi).
- `select('*')` zabranjen u production hookovima koji se često pozivaju — specificiraj kolone.
  (Iznimka: one-time admin query na sporednim stranicama.)
- Kompleksnu logiku (dostupnost, folio kalkulacije) drži u PostgreSQL funkcijama —
  ne reimplementiraj u JS/React hookovima.

### 4. Frontend struktura
- Modul struktura obavezna: `src/modules/{modul}/pages|components|hooks/`. Stranica koja
  pripada modulu NE ide u `src/pages/`.
  (Moduli: `analytics, guests, hotel, hr, inventory, menu, spa, tables`.)
- Shared komponente u `src/components/shared/` — nikad kopiraj komponentu između modula;
  ako se pojavi na dva mjesta, izvuci u shared.
- **CSS cross-import zabranjen** — modul uvozi samo svoj CSS ili `shared/` CSS
  (`spa/` ne uvozi iz `hotel/`, itd.).
- Hookovi (`use{Naziv}.js`) enkapsuliraju Supabase upite za jednu domenu — komponente ne
  pišu inline upit ako hook postoji.
- Lazy loading za sve stranice: `React.lazy()` + Suspense.

### 5. CSS, dizajn, dark mode
- Sve boje kroz CSS varijable — nikad hardcoded hex u inline `style={{}}`.
  Jedina iznimka: brend boja restorana (`restaurant.color`) sa fallbackom `var(--c-brand)`.
- Status boje definiši kao `STATUS_BADGE` objekt na vrhu fajla — ne inline po statusu u JSX.
- Dark mode testiraj pri svakoj UI izmjeni (`[data-theme*="-dark"]` override). Hardcoded boja
  ⇒ dark mode je vjerovatno slomljen.
- Responsive je standard: upotrebljivo na 375px / 768px / desktop. Mobile-first gdje može.

### 6. i18n
- Javne stranice (BookingPage, GuestApp, HotelLanding, RestaurantLanding, SpaBooking):
  sav vidljiv tekst kroz `t('ključ')`, bez hardcoded stringova. Locale-i: `me` (primarni), `en`
  (`src/i18n/locales/`).
- Admin panel: prevodi nisu obavezni — prihvatljiv hardcoded crnogorski tekst.

### 7. Realtime, performanse, cleanup
- Svaki Supabase Realtime channel ima cleanup u `useEffect` return
  (`supabase.removeChannel(ch)`). Isto za `setInterval`/`setTimeout`.
- **Ref pattern obavezan:** `load`/`onRefresh` se NE stavljaju u dependency array subscription
  `useEffect`-a (uzrokuju tear-down + gubitak eventova). Drži ih u `useRef` i u depsu samo
  `restaurantId`.
- Channel name mora uključivati `restaurantId`: format `{kontekst}-{scope}-${restaurantId}`.
- DB preduslov za `postgres_changes`: tabela u `supabase_realtime` publikaciji **i**
  `REPLICA IDENTITY FULL` (za tabele gdje staff radi UPDATE). Dodaj to migracijom za svaku
  novu realtime tabelu.

### 8. Kritične funkcionalnosti — ne narušavati
Stabilne i end-to-end testirane; izmjene izoliraj i ručno testiraj cijeli scenario
(ne samo compile check):
- **Rezervacije:** provjera preklapanja datuma, overbooking prevencija, room status na check-in/out
- **Folio:** auto-kreiranje pri check-in, folio items iz narudžbi/spa, zaključavanje
- **Digitalni meni:** order flow, narudžba na sobu, košarica u sessionStorage
- **Booking engine:** `get_available_rooms()`, `create_booking_direct()`, payment webhookovi
- **Guest trigger:** `trg_hotel_reservation_auto_guest` (auto-kreiranje/linkovanje gosta)
- **RLS politike:** svaka šema-izmjena može pokvariti RLS

---

## Testiranje
Pokretati lokalno prije svakog pusha na `main`; CI ih pokreće na svaki push/PR.

Slojevi i komande:
- **DB (pgTAP)** — `supabase/tests/`, komanda `supabase test db`. Svaki test u `BEGIN…ROLLBACK`.
- **Unit (Vitest)** — `*.test.js` uz modul, komanda `npm run test:unit`. Za čiste funkcije.
- **Edge (Deno)** — `*.test.ts` uz funkciju, `deno test supabase/functions`. Za payment/shared logiku.
- **E2E (Playwright)** — `e2e/`, `npm run test:e2e`. 3 kritične putanje; traži pokrenutu app
  i odvojen test tenant (NE puštati protiv produkcione baze).

**Kad NAPISATI (dio Definition of Done):**
- Nova tabela s RLS-om → RLS izolacioni test po šablonu `001_rls_isolation_*.sql`
  (tenant A ne vidi i ne može pisati podatke tenanta B).
- Nova/izmijenjena kritična DB funkcija ili trigger (booking, folio, plaćanja, dostupnost)
  → test koji pokriva i happy path i odbijanje — prije nego se smatra gotovim.
- Nova čista helper funkcija (npr. `planUtils`) → Vitest unit test.
- Izmjena mapiranja statusa plaćanja (`status-map.ts`) → Deno test; svaki izlaz mora ostati
  validan `NormalizedStatus` (Princip 2), nikad provajder-specifičan string.

## Workflow
- Radi direktno na `main` (push ⇒ produkcija). Zato: pokreni `supabase test db` i testiraj
  kritične oblasti prije pusha.
- Kad završiš zaokruženu cjelinu, ažuriraj `restbyme_hotel_roadmap.md` (dnevnik napretka).
