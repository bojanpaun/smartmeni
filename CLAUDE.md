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

### Tenant model — KRITIČNO (2b, 2026-06-07)
- **`tenants` = nalog** (billing/vlasništvo). **`tenants.id == restaurants.id`** (1:1, stabilni
  id-jevi). Zato `restaurant_id` na svim child tabelama **i dalje JESTE tenant id** — kolona
  NIJE preimenovana. **Koristi `restaurant_id`** u upitima/RLS kao i prije.
- **`restaurants` = profil restoran-vertikale + javni tenant-root** (name, slug, meni postavke,
  `active_verticals`). Javno čitljiv.
- **Account/billing polja DUPLIRANA** na `restaurants` i `tenants` (plan, is_complimentary,
  suspended_at, trial_ends_at, plan_expires_at, admin_theme, onboarding_completed,
  subscription_id, paypal_customer_id). **Izvor čitanja = `tenants`** (PlatformContext spaja na
  `restaurant` objekat). **Pisci pišu `restaurants`** → **mirror trigger** drži tenants sinhron.
- **Vertikale:** `restaurants.active_verticals` (text[], javno). `hasVertical(v)` (PlatformContext)
  + `<VerticalGuard>` (App.jsx) gejtuju. Restoran = besplatna baza; hotel = plaćen (`hotel_core`).
  Nova vertikala: dodaj u `active_verticals` + `ALL_VERTICALS` (ControlPanel) + RPC kategorije + guard.
- **NE raditi** bez eksplicitnog dogovora i staging-a: tvrdi DROP `restaurants` account kolona /
  prepis payment edge funkcija na `tenants` (kozmetika s rizikom po naplate; mirror već drži sve).
  Detalji: `restbyme_hotel_roadmap.md` (v5.8) i memorija `project_tenant_model`.

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
- **DVA odvojena sistema plaćanja** (ne miješati):
  - **A) Plaćanja gostiju** (booking/folio/spa) — **per-tenant** (`tenant_payment_configs` +
    `payment_credentials`, šifrovano). Apstrakcija: `supabase/functions/_shared/payments/`
    (Stripe ✓ kompletan; Monri za CG — usklađen sa WebPay v2, dormant dok tenant ne unese
    ključeve). Tok: `payments-create-session` → checkout → `payments-webhook` → izvor (rezervacija/folio).
    Frontend redirect: `src/lib/payments.js` `goToPaymentSession` (Stripe redirect / Monri POST).
    Detalji: memorija [[project-payments-booking-monri]].
  - **B) Pretplate** (tenant→platforma) — PayPal/Stripe na platform-nivou; ODGOĐENO do Monri,
    sad `beta_free_mode` ON (naplata off). Detalji: [[project-payments-direction]].

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
- **Token sistem:** svi `--c-*` tokeni definisani u `src/index.css` u 4 bloka:
  `:root` (zelena/light), `[data-theme="green-dark"]`, `[data-theme="blue"]`, `[data-theme="blue-dark"]`,
  `[data-theme="purple"]`, `[data-theme="purple-dark"]`. **Nova paleta = dodaj 2 bloka (light+dark)
  + 1 red u `ADMIN_THEMES` (SuperAdminPanel.jsx).** Dark mode je per-user toggle; paleta je per-tenant
  (`restaurants.admin_theme`, primjenjuje `useTheme` koji MORA dobiti `restaurant`).
  Dark mode/tema se primjenjuju SAMO na admin rutama (`/admin`,`/superadmin`) — vidi `index.html`
  inline skriptu + `ThemeRouteSync` (App.jsx); login/javne stranice ostaju svijetle.
- **Naslov stranice (admin/superadmin) — JEDINSTVENI IZVOR:** svi page-naslovi koriste tokene
  `--c-page-title-size` + `--c-page-title-weight` (definisani u `index.css` `:root`) + font
  `var(--c-font-display)`. **Nova admin stranica:** naslov stilizuj sa
  `font-family: var(--c-font-display); font-size: var(--c-page-title-size); font-weight: var(--c-page-title-weight);`
  — NIKAD hardkodovana px veličina. Promjena veličine svih naslova = 1 red u `index.css`.
  (Javni portali nisu obuhvaćeni — imaju svoj hero stil.)
- **Custom palete:** superadmin ih kreira na `/superadmin/theme` (tabela `theme_palettes`);
  `useTheme` ih primjenjuje inline preko `documentElement.style.setProperty` (baza green/green-dark
  za neutralne tokene).
- **Responsive je OBAVEZAN (osnovno pravilo).** Sve što se razvija mora biti vizuelno
  prilagođeno i potpuno upotrebljivo na mobilnom i raznim uređajima — ne samo na desktopu.
  Definition of Done svake UI izmjene uključuje provjeru na **375px (mobilni) / 768px (tablet) /
  desktop**. Mobile-first gdje god može.
  - **Bez horizontalnog scroll-a cijele stranice.** Širok sadržaj koji ne staje (tabele,
    dugmad, redovi filtera) mora se ili prelomiti (`flex-wrap`) ili scroll-ovati **unutar svog
    kontejnera** (`overflow-x:auto` wrapper), nikad gurati cijeli layout.
  - **Tabele s više kolona** idu u scroll-wrapper sa `min-width` (vidi `FiscalizationPage` —
    `.tableWrap`/`.tableWide`), da kolone ostanu čitljive a stranica ne pukne.
  - Redovi dugmadi/badge-ova/filtera: `flex-wrap: wrap` + razumni `min-width` na djeci.
  - Na uskom ekranu smanji margine/padding (media query) za više korisnog prostora.
  - Fiksne `width` u px na sadržajnim elementima su sumnjive — koristi `max-width`/`%`/`flex`.

### 6. i18n — DVA SLOJA (statički UI + dinamični sadržaj)
**7 jezika:** `me` (primarni/izvor/fallback), `en`, `sr`, `hr`, `sq`, `tr`, `ru`. Detalji i
istorija faza: memorija [[project-i18n-multilingual]].

**Sloj A — statički UI tekst (i18next, `src/i18n/locales/{lng}/*.json`):**
- Sav vidljiv tekst kroz `t('ključ')` — i javne stranice I **admin** (admin JESTE preveden na
  svih 7; staro pravilo „prevodi nisu obavezni" više NE važi). Bez hardcoded stringova.
- Namespace-i: javni (eager me/en, lazy ostali) + `admin`/`modulehelp` (LAZY i za me/en — veliki,
  admin-only; vidi `src/i18n/index.js`). Nova javna stranica = samo dodaj locale JSON.
- **Key-parity gate `scripts/i18n-check.mjs`** (u `npm run check` + CI): svaki jezik mora imati
  identične ključeve kao `me`, inače pada. Novi ključ ide u SVIH 7 odjednom.
- Obrazac: config `label`→`labelKey`→`t()`; datumi `dl = i18n.language==='en'?'en-US':'sr-Latn'`;
  paziti na `t`-sjenku (preimenuj map/param varijable). Bundle: init JS hard cap 155 kB → admin ns
  mora ostati lazy.

**Sloj B — dinamični tenant-sadržaj (AI prevod, `content_translations`):**
- Slobodan sadržaj koji tenant unosi (nazivi/opisi jela, kategorije, poruke konobaru, spa usluge)
  prevodi se **AI-jem** (Claude Haiku / zamjenjivo, `TRANSLATE_PROVIDER` secret; Anthropic aktivan)
  i keširaju u `content_translations` (entity_type, entity_id, field, lang, value, is_override).
- **Izvor je `me`** (vrijednost u izvornoj koloni, npr. `menu_items.name`). Store drži 6 ciljnih jezika.
- **Tok za NOVU guest-facing tenant-sadržaj površinu (OBAVEZNO oba):**
  1. *Pisanje:* na snimanje okini `translateContent(restaurantId, items)` (`src/lib/contentTranslate.js`),
     `items=[{entity_type, entity_id, field, text}]` (fire-and-forget; edge dedupe-uje po source_hash
     i poštuje is_override).
  2. *Čitanje:* `const tr = useContentTranslations(restaurantId)` pa `tr(entity_type, id, field, fallback)`
     (fallback = izvor; za `me`/bez prevoda vraća izvor).
- **Ručna korekcija:** `components/shared/ContentTranslations` modal (🌐 dugme) — admin ispravi prevod,
  snima `is_override=true` (AI ga ne pregazi). Generičko: prima `entityType`/`entityId`/`fields`.
- **Backfill** zatečenih: superadmin `/superadmin` → „🌐 Prevedi sve" (edge `backfill:true`).
- Edge: `supabase/functions/translate-content/` (auth+vlasništvo, providers.ts, pure logika+Deno test
  translate.ts). pgTAP 038 (RLS izolacija content_translations). **Ne brisati stare `_en` kolone**
  (fallback). Setup/lekcije: [[todo-anthropic-api-key]].

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
- **Fiskalni računi:** `create_invoice_from_items` (atomarna numeracija + PDV grupe), readeri
  order/spa/folio, split (`create_split_invoices`) i storno (`create_storno_invoice`); izvor je
  „fakturisan" samo dok ima AKTIVAN (nestorniran) original. `restaurants.iban` je **mirror**
  primarnog `tenant_bank_accounts` (ne pisati direktno); PDV stope = `restaurants.tax_rates`
  (NULL = državne `tax_config`). Detalji: memorija `project_fiscalization`.
- **RLS politike:** svaka šema-izmjena može pokvariti RLS

### 9. Performanse i efikasnost (OSNOVNO PRAVILO)
Brzo učitavanje i efikasnost NISU naknadna optimizacija — to je osnovni zahtjev proizvoda.
Svaka izmjena se procjenjuje i kroz uticaj na brzinu, ne samo na funkciju.
- **Kritična putanja prvog rendera je sveta.** Sve što gejtuje prvi paint (`PlatformContext`,
  auth, gating upiti) mora biti minimalno: paralelni upiti (`Promise.all`, ne waterfall),
  samo neophodne kolone, bez blokiranja na ne-kritičnom configu (pali ga u pozadini).
- **`select('*')` zabranjen** u hookovima/kontekstima koji se učitavaju često ili na svakoj
  stranici — specificiraj kolone (pojačava pravilo iz §3 za frontend). Iznimka: one-time
  admin query na sporednoj stranici.
- **Lazy loading je default**: sve stranice `React.lazy()` + Suspense (§4). Teške biblioteke
  (`recharts`, `@dnd-kit`) smiju se uvoziti SAMO iz lazy ruta — nikad iz shell-a/dashboarda
  ili shared komponente koja se učitava svuda. Provjeri `vendor-*` chunk u `npm run build`
  prije pusha ako diraš import teške biblioteke.
- **Bundle budžet** (CI ga čuva): init JS hard cap 155 kB; `admin`/`modulehelp` ns ostaju lazy.
  Novi veliki import = provjeri da nije ušao u init chunk.
- **Paginacija/limiti obavezni** na listama koje rastu (narudžbe, gosti, rezervacije, računi) —
  nikad `select` bez `limit`/opsega na tabeli koja može imati hiljade redova.
- **Service worker / PWA (oprez pri deployu):** `registerType: 'autoUpdate'` + precache znači da
  svaki deploy tjera postojeće korisnike na re-download chunkova. Izbjegavaj nepotrebne uzastopne
  deploye; ne naduvavaj precache (ne precache-uj admin-only/jezičke chunkove bez razloga).
- **Mjeri, ne nagađaj:** kod prijave sporosti prvo lociraj fazu (Network waterfall / bundle /
  upit / render) pa onda popravljaj — ne refaktoriši naslijepo.

---

## Testiranje
Pokretati lokalno prije svakog pusha na `main` — najlakše `npm run check` (unit + pgTAP);
pre-push hook to i automatski radi (vidi Workflow → Deploy). CI ih ponovo vrti na svaki push/PR.

Slojevi i komande:
- **DB (pgTAP)** — `supabase/tests/`, komanda `supabase test db`. Svaki test u `BEGIN…ROLLBACK`.
- **Unit (Vitest)** — `*.test.js` uz modul, komanda `npm run test:unit`. Za čiste funkcije.
  - **Testirani modul NE smije (ni tranzitivno) uvoziti `lib/supabase.js`.** `createClient(URL, KEY)`
    se izvršava na importu i baca `supabaseUrl is required` kad nema `VITE_SUPABASE_*` — a CI
    nema env fajlove (lokalno prolazi jer `.env`/`.env.local` postoje, pa pad iznenadi tek na CI-ju).
    Drži čiste funkcije ODVOJENO od hook-a/komponente koja uvozi klijent (npr. `menuHelpers.js`
    vs `useMenuData.js`); test uvozi iz čistog fajla. Provjera prije pusha: testovi importuju samo
    pure module (ili reprodukuj CI lokalno tako što privremeno skloniš `.env*` pa pokreneš `vitest run`).
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

## Workflow — LOKALNO-FIRST (obavezno)
Razvoj ide nad **lokalnom** Supabase bazom (Docker), nikad direktno nad produkcijom.
Produkcija se dira tek kad je lokalno zeleno.

**Preduslov:** Docker Desktop mora biti upaljen.

### Jednokratni setup (svaki novi klon / nova mašina)
```
npm install
git config core.hooksPath .githooks   # aktivira pre-push hook (nije u repo configu!)
npm run db:start                       # prvi put povuče Docker images (~par GB)
```
- **`.env.local`** (gitignored, per-mašina) treba ručno kreirati — lokalni Supabase
  URL + ključ iz `supabase status`. Bez njega `npm run dev` gađa prod.

### Dnevni tok
```
npm run db:start     # podigni lokalni Supabase stack (Docker)
npm run db:reset     # primijeni SVE migracije + seed.sql lokalno (čista baza)
npm run dev          # frontend → LOKALNA baza (.env.local override)
# ...razvoj + nova migracija u supabase/migrations/...
npm run db:reset     # ponovi da nova migracija legne čisto
npm run check        # unit + pgTAP testovi (vidi Deploy dolje)
npm run db:push      # tek SAD: migracije na PRODUKCIJU (supabase db push)
git push             # tek SAD na main (Vercel deploy frontenda)
```

### Deploy — testovi PRIJE pusha (obavezno)
- **Prije `git push`** mora proći `npm run check` (= `test:unit` + `test:db`).
  Edge/E2E po potrebi (`npm run test:edge`, `npm run test:e2e`) kod izmjena te logike.
- **`.githooks/pre-push`** to **automatski** pokreće na svaki `git push` i blokira push
  ako padne. DB testove preskače samo ako lokalni Supabase nije upaljen (CI ih pokrije).
  Hitni bypass: `git push --no-verify` — izbjegavati, koristiti samo svjesno.
- **Redoslijed deploya je fiksan: `db:push` PRIJE `git push`** (frontend ne smije stići
  na prod prije šeme koju očekuje).
- CI (`.github/workflows/tests.yml`) ponovo vrti unit/edge/pgTAP + bundle budžet na svaki
  push/PR — druga mreža poslije lokalne.

### Pravila lokalne baze i seed-a
- **NIKAD** `supabase db reset --linked` (gađa prod). `db reset` bez flaga = lokalno, bezopasno.
- **`supabase/seed.sql`** puni SAMO lokalnu bazu (login: `za.bojana.paunovica@gmail.com` /
  `password123`, superadmin `bojanpaun@gmail.com` / `password123`). Ne ide na produkciju.
- **Seed mora ostati test-neutralan** (učitava se i prije `supabase test db`):
  koristi rezervisani UUID prostor `dddddddd-…` (testovi koriste `1111..`/`aaaa..`),
  NE diraj globalni `platform_settings.beta_free_mode` (test 018) — addone otključavaj
  per-tenant kroz `subscriptions.addons`.
- Ako `supabase test db` puca na zaostalim podacima → `npm run db:reset` pa ponovo.

- Kad završiš zaokruženu cjelinu, ažuriraj `restbyme_hotel_roadmap.md` (dnevnik napretka).
