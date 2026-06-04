# rest.by.me — HospitalityOS Produkt roadmap

> **Verzija:** 4.7 *(dopunjeno — Arhitektura plaćanja: multi-provider apstrakcija + Faza PAY (Stripe + Monri), CC-spremni koraci PAY-1…PAY-13 — 2026-06-04)*
> **Kontekst:** Evolucija rest.by.me (bivši SmartMeni) SaaS platforme prema punom hospitality management sistemu
> **Tim:** 1 developer + Claude Code AI asistent
> **Branch:** `main` → direktno na produkciju (Vercel auto-deploy)
> **Rebrand:** SmartMeni → **rest.by.me** (izvršeno 2026-05-31 — novi Landing page, logotip, domen)

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

## Pravila razvoja (Development Standards)

> Ova pravila su obavezna za sve buduće izmjene i nove faze. Cilj: konzistentnost arhitekture, predvidljivost koda i zaštita kritičnih funkcionalnosti (rezervacije, digitalni meni, gosti).

---

### 0. Jezik aplikacije — Crnogorski (obavezno)

Aplikacija je na **crnogorskom jeziku** kao primarnom. Ovo pravilo važi za sav UI tekst, uputstva, poruke i notifikacije.

**Konkretne razlike crnogorski vs. hrvatski koje se često miješaju:**

| ❌ Hrvatski | ✅ Crnogorski |
|------------|--------------|
| historija  | **istorija** |
| kat (sprat) | **sprat** |
| tjedan / tjedno | **sedmica / sedmično** |
| plaća | **plata / zarada** |
| zaposlenici | **zaposleni** |
| bolovanie (typo) | **bolovanje** |
| povijest | **istorija** |

**Pravilo:** Nikad ne mijenjati nazive ruta, varijabli, CSS klasa, database kolona — samo korisnički vidljiv tekst (labele, opisi, toast poruke, modalni tekstovi, uputstva).

---

### 1. Multi-tenancy i sigurnost

- **Svaka nova tabela mora imati `restaurant_id`** — bez iznimke. Ovo je primarni tenant identifikator dok se ne izvrši migracija na `tenants` tabelu.
- **RLS politika je obavezna** na svakoj novoj tabeli — kreirati uz migraciju, ne naknadno. Minimum: `USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))`.
- **Svaki Supabase upit u komponentama** koji čita/mijenja podatke mora eksplicitno imati `.eq('restaurant_id', restaurant.id)` — čak i kad RLS štiti na DB nivou. Konzistentnost je odbrana u dubinu.
- **`SECURITY DEFINER` RPCs** koristiti samo za anon pristup (booking stranica, Guest App) — ne kao shortcut u autentifikovanim dijelovima.
- **Foreign key constraints** obavezni za sve veze između tabela. Bez slobodnih UUID referenci.

---

### 2. Billing i addon sistem

- **Svaka feature zaštićena addonom** mora imati `<AddonGuard addonId="...">` wrapper ili `if (!hasAddon('...')) return <UpgradePrompt />` provjeru.
- **`hasAddon('addon_id')`** je jedini način provjere — nikad direktno čitati `subscriptions` tabelu u komponentama.
- **Novi addon ID** mora biti registrovan i u `addon_catalog` tabeli (migracija) i u `planUtils.js` (helperi) — oboje, ne samo jedno.
- **Billing guard nije opcionalan** — modul bez guarda je sigurnosni propust, ne tehnički dug za kasnije.

---

### 3. Baza podataka i migracije

- **Migracije su nepromjenjive** — fajl koji je jednom pushovan/primijenjen se nikad ne edituje. Greška se ispravlja novom migracijom.
- **Imenovanje migracija:** `YYYYMMDDHHMMSS_kratki_opis_snake_case.sql` — datum mora biti stvarni datum kreiranja.
- **DB triggeri:** svaki trigger mora imati komentar koji objašnjava ZAŠTO postoji i koji invariant štiti (ne samo šta radi).
- **`select('*')` zabranjen u production hookovima** koji se pozivaju učestalo — uvijek specificirati kolone. Iznimka: one-time admin query na sporednim stranicama.
- **PostgreSQL funkcije** za kompleksnu logiku (dostupnost, folio kalkulacije) — ne reimplementirati tu logiku u JS/React hookovima.

---

### 4. Frontend struktura i komponente

- **Modul struktura je obavezna:** `src/modules/{modul}/pages/` + `src/modules/{modul}/components/` + `src/modules/{modul}/hooks/`. Nijedna stranica ne ide direktno u `src/pages/` ako pripada modulu.
- **Shared komponente** idu u `src/components/shared/` — nikad kopirati komponentu između modula. Ako se ista stvar pojavi na dva mjesta, izvuci je u shared.
- **CSS cross-import zabranjen** — modul uvozi samo vlastiti CSS modul ili `shared/` CSS. `spa/` ne uvozi iz `hotel/`, `menu/` ne uvozi iz `hotel/`.
- **Hookovi** (`use{Naziv}.js`) enkapsuliraju sve Supabase upite za jednu domenu — komponente ne pišu inline upit ako postoji hook za to.
- **Lazy loading** za sve stranice — `React.lazy()` + Suspense je uspostavljen standard, svaka nova stranica mora ga pratiti.

---

### 5. CSS, dizajn i dark mode

- **Sve boje kroz CSS varijable** — nikad hardcoded hex u inline `style={{}}`. Jedina iznimka: dinamička boja brenda restorana (`restaurant.color`) s fallbackom na `var(--c-brand)`.
- **Status boje** (rezervacije, narudžbe, housekeeping...) definisati kao `STATUS_BADGE` objekt na vrhu fajla — ne inline stilizovanje po statusu unutar JSX-a.
- **Dark mode se testira pri svakoj izmjeni UI** — koristiti `[data-theme*="-dark"]` override u CSS modulima. Ako komponenta ima hardcoded boju, dark mode je vjerovatno slomljen.
- **Responsive je standard, ne bonus** — sve nove stranice moraju biti upotrebljive na 375px (mobilni), 768px (tablet) i desktop. Mobile-first CSS gdje je moguće.
- **Shared CSS patterne** koristiti konzistentno: `nav.module.css` za tab/pill navigaciju, `LandingEditor.module.css` za block editore.

---

### 6. i18n i višejezičnost

- **Javne stranice** (BookingPage, GuestApp, HotelLanding, RestaurantLanding, SpaBooking) — sav user-facing tekst mora ići kroz `t('ključ')`. Bez hardcoded stringova u JSX-u.
- **Admin panel** — prevodi nisu obavezni (niska prioriteta). Prihvatljivo je hardcoded BS/HR tekst.
- **Dodavanje novog jezika** = novi JSON fajl u `locales/` — bez izmjena komponenti. Ako dodavanje jezika zahtijeva izmjenu komponente, i18n je pogrešno implementiran.
- **`sm_lang` localStorage key** je standard za čuvanje odabranog jezika — ne uvodi drugi mehanizam.

---

### 7. Realtime, performanse i cleanup

#### 7.1 Osnovna pravila (channels i cleanup)

- **Svaki Supabase Realtime channel** mora imati cleanup u `useEffect` return:
  ```js
  useEffect(() => {
    const ch = supabase.channel(...).on(...).subscribe()
    return () => supabase.removeChannel(ch)
  }, [dep])
  ```
- **`setInterval` / `setTimeout`** u komponentama — uvijek clearInterval/clearTimeout u useEffect cleanup.
- **Channel ref pattern** za channels koji se kreiraju izvan useEffect-a (event handleri): koristiti `useRef` za čuvanje reference i cleanup pri unmount.
- **Supabase realtime** ne koristiti za podatke koji se ne mijenjaju učestalo — polling ili refetch pri korisničkoj akciji je prihvatljiviji od stalnog otvorenog channela.

#### 7.2 Channel dependency array — ref pattern (OBAVEZNO)

Subscription `useEffect` koji prima `load` ili `onRefresh` funkcije **NE smije** ih stavljati u dependency array direktno. Promjena referenci uzrokuje tear-down + re-subscribe kanala, što kratkoročno gubi evente.

**Zabranjeno (nestabilan subscription):**
```js
useEffect(() => {
  const ch = supabase.channel(`xyz-${restaurantId}`)
    .on('postgres_changes', ..., () => { load(); onRefresh?.() })
    .subscribe()
  return () => supabase.removeChannel(ch)
}, [restaurantId, load, onRefresh]) // ❌ load i onRefresh uzrokuju re-subscribe
```

**Obavezno (stabilan subscription — ref pattern):**
```js
const loadRef = useRef(load)
const onRefreshRef = useRef(onRefresh)
useEffect(() => { loadRef.current = load }, [load])
useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

useEffect(() => {
  if (!restaurantId) return
  const ch = supabase.channel(`xyz-${restaurantId}`)
    .on('postgres_changes', ..., () => { loadRef.current(); onRefreshRef.current?.() })
    .subscribe()
  return () => supabase.removeChannel(ch)
}, [restaurantId]) // ✅ samo restaurantId — kanal živi cijeli mount ciklus
```

Ovaj pattern je implementiran u: `useHousekeeping.js`, `HousekeepingView.jsx`, `MaintenanceView.jsx`.
Treba se primijeniti na: `BarView`, `KitchenView`, `WaiterView`, `SpaView`, `ReceptionView`, `useRooms` (vidi bug registar §B-RT).

#### 7.3 Channel imenovanje

- **Channel name mora uključivati `restaurantId`** — bez toga dolazi do konflikata na shared Supabase klijentu ako je isti korisnik otvorio više tabova ili ako se hook instancira na više mjesta.
- **Format:** `{kontekst}-{scope}-{restaurantId}` — npr. `hk-portal-${restaurantId}`, `kc-${restaurantId}`, `rooms-rt-${restaurantId}`.
- **Iznimka:** Admin singleton stranice sa jednim mountom i kratkim životnim vijekom (npr. `WaiterMapView`) — ali i tu se preporučuje uključiti `restaurantId`.

#### 7.4 Supabase publikacija i REPLICA IDENTITY (DB preduslov)

Da bi `postgres_changes` subscription primao evente, moraju biti ispunjena **oba** uslova:

| Uslov | Komanda | Kada je potrebno |
|-------|---------|-----------------|
| Tabela u `supabase_realtime` publikaciji | `ALTER PUBLICATION supabase_realtime ADD TABLE tabela;` | Svaka nova tabela koja se koristi u realtime subscription |
| `REPLICA IDENTITY FULL` | `ALTER TABLE tabela REPLICA IDENTITY FULL;` | Tabele na kojima staff (ne-owner) vrši UPDATE — bez ovoga filter u subscription može propustiti UPDATE evente |

Tabele koje su potvrđeno konfigurisane:

| Tabela | Publikacija | REPLICA IDENTITY | Migracija |
|--------|-------------|------------------|-----------|
| `orders` | ✅ | ✅ (pretpostavka — orders rade) | staro |
| `waiter_requests` | ✅ | ✅ | staro |
| `housekeeping_tasks` | ✅ | ✅ FULL | `20260603000003` + `20260604000001` |
| `maintenance_requests` | ✅ | ✅ FULL | `20260603000003` + `20260604000001` |
| `hotel_reservations` | ❓ | ❓ | nije provjereno |
| `spa_appointments` | ❓ | ❓ | nije provjereno |
| `rooms` | ❓ | ❓ | nije provjereno |
| `guest_requests` | ❓ | ❓ | nije provjereno |

**Pravilo:** Svaka nova tabela koja se koristi u `postgres_changes` subscription mora imati migraciju koja je eksplicitno dodaje u publikaciju i postavlja REPLICA IDENTITY FULL.

#### 7.5 Staff portal — useKitchenCounts inicijalizacija

`useKitchenCounts` u staff portalu (`StaffPortal.jsx`) **mora** dobijati `null` dok korisnik nije autentifikovan. Razlog: Supabase realtime kanal kreiran pre-login (anonimnom sesijom) ne rekonektor se automatski s novim auth tokenom — ostaje u broken stanju i ne prima evente.

```js
// ✅ Ispravno — null pre-login, pravi ID tek kad je mode === 'portal'
const { counts, refresh: refreshCounts } = useKitchenCounts(
  mode === 'portal' ? restaurant?.id : null
)
```

Ovo je jedini kontekst gdje se `useKitchenCounts` poziva u neautentifikovanom kontekstu. U admin layoutu nema ovog problema jer se admin layout renderuje samo za autentifikovane korisnike.

---

### 8. Kritične funkcionalnosti — ne narušavati

Sljedeće funkcionalnosti su stabilne i testovane end-to-end. Svaka izmjena mora biti pažljivo izolirana:

| Oblast | Kritični dijelovi | Zašto je osjetljivo |
|--------|------------------|---------------------|
| **Rezervacije** | Provjera preklapanja datuma, overbooking prevencija, room status pri check-in/out | Finansijska i operativna šteta pri greški |
| **Folio sistem** | Automatsko kreiranje folija pri check-in, folio items iz narudžbi/spa, zaključavanje folija | Računovodstvena ispravnost |
| **Digitalni meni** | `order` flow, narudžba na sobu, košarica u sessionStorage | Direktno vidljivo gostima |
| **Booking engine** | `get_available_rooms()`, `create_booking_direct()`, PayPal webhook | Plaćanje i dostupnost |
| **Guest trigger** | `trg_hotel_reservation_auto_guest` — auto-kreiranje/linkovanje gosta | Integritet baze gostiju |
| **RLS politike** | Na svim tabelama — svaka izmjena šeme može pokvariti RLS | Sigurnost i multi-tenancy |

> **Pravilo:** Izmjena koja dira kritičnu oblast mora biti praćena ručnim testom end-to-end scenarija, ne samo compile checkom.

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
| `mice` | Konferencije, sale, eventi, BEO, korporativni klijenti | ⬜ Faza M |
| `marketing_auto` | Post-stay email, birthday trigger, re-engagement kampanje | ⬜ Faza 8.6 |
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
| `spa_wellness` | Booking spa tretmana, kapaciteta, terapeuti, folio integracija | ✅ Implementiran (admin UI, booking, analitika) |
| `night_audit` | Nocni audit (EOD), split folio, doručak kontrola | ⬜ Faza N |
| `pms_pro` | Room service, minibar, grupne rezervacije, waitlista | ⬜ Faza P |

---

## 💳 Arhitektura plaćanja (Payment provider abstrakcija)

> **Status:** Dizajn usvojen 2026-06-04. Implementacija = **Faza PAY** (vidi niže).
> **Razlog:** rest.by.me je namijenjen svjetskom tržištu, a online plaćanja se razlikuju po zemljama. U Crnoj Gori **ne postoje ni Stripe ni PayPal kao realne gostinske opcije** — koristi se Monri (preko Payten/banke) ili e-commerce gateway lokalne banke. Zato platni sloj mora biti **provajder-agnostičan**, a admin (tenant) bira i konfiguriše koji mehanizam koristi.

### Princip 0 — dvije odvojene platne površine (NE miješati)

| Površina | Ko je merchant | Gdje ide novac | Provajder bira |
|----------|----------------|----------------|----------------|
| **SaaS pretplata / addoni** | **mi (rest.by.me)** | nama | mi (1–2 provajdera, npr. Stripe + PayPal) |
| **Gostinska plaćanja** (booking depozit, folio, narudžba) | **tenant (hotel/restoran)** | tenantu na njegov merchant nalog | **admin tenanta** (Stripe / Monri / ...) |

> ⚠️ Ove dvije površine imaju različite zahtjeve i **ne smiju dijeliti istu konfiguraciju**. "Admin bira provajdera" važi **samo** za gostinska plaćanja. SaaS naplatu kontrolišemo mi (postojeća Faza 1 / 1d).

### Princip 1 — hosted-redirect kao najmanji zajednički djelilac

Stripe ume embedded (PaymentIntent + client secret), ali Monri i bankovni gateway-i rade primarno preko **redirecta na hostovanu stranicu** provajdera. Da apstrakcija pokrije oba, ugovor se gradi oko:

```
createCheckoutSession() → { redirectUrl }  → gost plati na strani provajdera
                                            → webhook/return callback → normalizovan status
```

Bonus: redirect drži karticu izvan našeg koda → **drastično smanjen PCI scope** (ostajemo u SAQ-A).

### Princip 2 — normalizovan status enum (nikad provajder-specifičnost u app sloju)

```
pending | requires_action | authorized | paid | failed | refunded | partially_refunded | cancelled
```

Svaki provajder mapira SVOJE statuse na ovaj enum. Ostatak aplikacije (BookingPage, Folio, GuestApp) **nikad ne vidi** `payment_intent.succeeded` ili Monri `approval_code` — vidi samo normalizovan status.

### Princip 3 — "tenant donosi svoj merchant nalog"

Lokalni gateway-i (Monri, banke) **nemaju marketplace/Connect model** — svaki tenant koristi svoj merchant nalog kod svoje banke. Stripe ima Connect, ali da bi model bio univerzalan, baza je: **tenant konfiguriše vlastite kredencijale**. Stripe Connect je opciona nadogradnja samo za Stripe rutu (kasnije).

### Interfejs provajdera (ugovor)

```ts
// supabase/functions/_shared/payments/types.ts
interface PaymentProvider {
  id: 'stripe' | 'monri' | 'paypal'
  createCheckoutSession(ctx: SessionCtx): Promise<{ redirectUrl?: string; clientSecret?: string; providerRef: string }>
  verifyAndParseWebhook(rawBody: string, headers: Headers): NormalizedEvent  // verifikuj potpis/digest OVDJE
  getStatus(providerRef: string): Promise<NormalizedStatus>
  refund(providerRef: string, amountMinor?: number): Promise<RefundResult>
}
// registry.ts → getProvider(tenantConfig) vraća odgovarajuću implementaciju
```

### DB shema (uz dev standarde: `restaurant_id` + RLS na svakoj tabeli)

```sql
-- migracija: YYYYMMDDHHMMSS_payment_provider_configs.sql
create table tenant_payment_configs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  provider text not null,                 -- 'stripe' | 'monri' | 'paypal'
  mode text not null default 'test',      -- 'test' | 'live'
  is_active boolean not null default false,
  is_default boolean not null default false,
  -- kredencijali NIKAD u plain tekstu → Supabase Vault (vault.secrets), ovdje samo referenca:
  credentials_secret_id uuid,             -- FK na vault secret
  public_config jsonb default '{}',       -- ne-tajni dio (npr. Monri merchant authenticity_token, brand)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))

-- migracija: YYYYMMDDHHMMSS_payment_transactions.sql
create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  provider text not null,
  provider_ref text not null,             -- ID transakcije kod provajdera
  idempotency_key text not null,          -- spriječi duple naplate (unique per restaurant_id)
  source_type text not null,              -- 'booking' | 'folio' | 'order' | 'spa'
  source_id uuid,                         -- FK na hotel_reservations / folios / orders ...
  amount_minor bigint not null,           -- u centima
  currency text not null default 'EUR',
  status text not null default 'pending', -- normalizovan enum
  raw_payload jsonb,                      -- sirovi webhook/callback za audit
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (restaurant_id, idempotency_key)
);
-- RLS obavezan; FK constraints obavezni (dev standard 1 i 3)
```

### Edge Functions (Supabase / Deno)

```
supabase/functions/
  payments-create-session/    # router → getProvider(config).createCheckoutSession()
  payments-webhook/           # ?provider=stripe|monri → verifyAndParseWebhook() → update payment_transactions + source
  payments-refund/            # admin/cancellation → getProvider().refund()
  _shared/payments/
    types.ts  registry.ts  stripe.ts  monri.ts  status-map.ts
```

---

## 🔄 Faza PAY — Multi-provider plaćanja (Stripe + Monri)

> **Preduslov:** Faza 1 (billing infra ✅), `room_availability` + `create_booking_direct` ✅. Supabase Vault omogućen za enkripciju kredencijala.
> **Prioritet:** 🔴 Visok — blokira realnu produkciju gostinskih plaćanja u CG.
> **Zašto sada:** Postojeći stubovi (Faza 3d "Stripe payment za booking", Faza 1d "Stripe addon flow") su pisani Stripe-only. Prije nego se zacementira Stripe-specifičan kod, uvodimo apstrakciju da Monri (CG/region) i ostali uđu bez refaktora.
> **Strategija sekvence:** Ne graditi sve provajdere odjednom. Apstrakcija za N provajdera, ali implementiraj **2** (Stripe za svijet, Monri za CG/region). Ostale (PayPal, MONEI, dodatne banke) — **na zahtjev** kad stvarni klijent traži.

### Koraci (CC-spremni — jedan korak = jedan commit/zadatak za Claude Code)

| # | Zadatak | Deliverable | DoD (Definition of Done) |
|---|---------|-------------|---------------------------|
| **PAY-1** | Apstraktni sloj + tipovi | `_shared/payments/{types,registry,status-map}.ts` | `getProvider()` vraća stub provajder; status-map pokriva sve enum vrijednosti |
| **PAY-2** | DB migracije | `tenant_payment_configs` + `payment_transactions` (+ RLS + FK) | Migracije primijenjene; RLS testiran (tenant A ne vidi tenant B) |
| **PAY-3** | Vault integracija | helper za upis/čitanje kredencijala iz `vault.secrets` | Kredencijali se NE vide u `select` na configs tabeli |
| **PAY-4** | Admin UI — provajder config | `src/modules/billing/pages/PaymentSettings` | Dropdown provajdera + forma za kredencijale + test/live toggle + "Postavi kao default" |
| **PAY-5** | `payments-create-session` Edge Fn | router koji bira provajdera po `tenant_payment_configs` | Vraća `redirectUrl`; piše `pending` red u `payment_transactions` sa `idempotency_key` |
| **PAY-6** | **Stripe** provajder | `stripe.ts` — Checkout Session (hosted, paralelno sa Monri redirect modelom) | Test plaćanje prolazi end-to-end na Stripe test mode |
| **PAY-7** | `payments-webhook` (Stripe) | verifikacija potpisa + mapiranje na enum + update `source` | Duplikat webhook ne pravi duplu rezervaciju (idempotencija) |
| **PAY-8** | **Monri** provajder | `monri.ts` — RedirectForm + digest (potpis) + return/callback handler | Test plaćanje prolazi na Monri test okruženju; digest verifikovan na callbacku |
| **PAY-9** | `payments-webhook` (Monri) | parsiranje Monri transaction callbacka → enum | Status se ispravno mapira; `raw_payload` sačuvan za audit |
| **PAY-10** | Integracija BookingPage | zamijeniti Stripe-only stub pozivom `payments-create-session` | Gost vidi opciju plaćanja samo ako tenant ima `is_active` config; i18n preko `t()` (javna stranica!) |
| **PAY-11** | Folio / GuestApp naplata | isti session flow za folio settlement | "Plati karticu" na folio radi kroz apstrakciju |
| **PAY-12** | Refund / cancellation | `payments-refund` + vezivanje na rate plan cancellation policy | Pun i djelimičan refund rade na Stripe i Monri |
| **PAY-13** | SaaS billing migracija (opc.) | Faza 1d addon purchase rutirati kroz isti sloj (provider = naš Stripe/PayPal nalog) | Addon kupovina radi; SaaS i gostinska površina ostaju odvojene konfiguracije |

### Monri specifičnosti (CG/region)

- Model: **RedirectForm** — server gradi potpisani zahtjev (digest, tipično SHA-512 nad merchant ključem + parametrima narudžbe), gost se prebaci na Monri hostovanu stranicu, Monri vraća na success/cancel URL i šalje transaction callback. *Tačna polja i algoritam digesta uzeti iz aktuelne Monri/Payten integracijske dokumentacije — ne hardkodirati pretpostavke.*
- Merchant nalog: tenant ga otvara kod svoje banke (CKB, Hipotekarna, NLB, Erste...) ili direktno preko Payten/Monri; mjesečna naknada reda ~25€ ako se ne dostigne promet.
- Test okruženje: koristiti Monri test merchant prije produkcije.

### Stripe specifičnosti

- Za **paritet sa Monri redirect modelom** koristiti **Checkout Session** (hosted) → `redirectUrl`. Time apstrakcija ostaje jednostavna.
- `PaymentIntent` (embedded) ostaviti kao kasniju opciju ako se želi in-page UX — interfejs to već dozvoljava preko `clientSecret`.
- Webhook: verifikacija potpisa obavezna; `payment_intent.succeeded` / `checkout.session.completed` → `paid`.

### Sigurnosni invarianti (obavezno)

- **Idempotencija** na svakoj naplati (`idempotency_key` unique per `restaurant_id`) — spriječava duple rezervacije/naplate pri retry-u webhooka.
- **Potpis/digest se verifikuje u Edge Function** prije ikakvog upisa — nikad vjerovati sirovom callbacku.
- **Kredencijali samo u Vaultu** — nikad u `public_config`, nikad u frontendu, nikad u logovima.
- **`source` update i `payment_transactions` update u istoj transakciji** (PostgreSQL funkcija) — bez polovičnih stanja.

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

## ⬜ Faza 0.1 — Tehnički dug cleanup

> **Preduslov:** Nijedan — cross-cutting refaktor koji se ne tiče funkcionalnosti.
> **Prioritet:** Raditi postepeno, po jedan item između funkcionalnih faza — ne sve odjednom.
> **Zašto sada:** Svaka nova faza produbljuje ove dugove. Plan mora biti definisan prije nego nastave faze 2+.

---

### B1 — SPA modul: CSS cross-import (🟡 Visok prioritet)

**Problem:** Svih 9 stranica `src/modules/spa/pages/` uvozi stilove iz `../../hotel/pages/Hotel.module.css`. Spa modul ovisi o hotel modulu na CSS nivou — promjena Hotel.module.css može neočekivano pokvariti spa UI.

**Rješenje:**
- Kreirati `src/modules/spa/pages/Spa.module.css` koji sadrži spa-specifične stilove
- Za zajedničke patterne koristiti `src/components/shared/` CSS
- Ažurirati svih 9 fajlova: `TherapistsPage`, `SpaSettingsPage`, `SpaRoomsPage`, `SpaDashboard`, `SpaCalendarPage`, `PackagesPage`, `AppointmentsPage`, `SpaAnalyticsPage`, `ServicesPage`

**Trajanje:** 2–3 sata

**Definition of Done:**
- [ ] `Spa.module.css` kreiran sa svim potrebnim klasama
- [ ] Nijedan spa fajl ne uvozi iz `hotel/pages/Hotel.module.css`
- [ ] UI spa modula vizuelno identičan prije i poslije (test u light i dark modu)

---

### B2 — GuestProfilePage: hardcoded boje → CSS klase (🟡 Visok prioritet)

**Problem:** `src/modules/guests/pages/GuestProfilePage.jsx` ima 19+ mjesta sa hardcoded hex bojama u `STATUS_STYLES`, `VISIT_STATUS`, `HOTEL_STATUS`, `SPA_STATUS` objektima i inline `style={{}}` props-ima. Dark mode radi loše na ovoj stranici.

**Rješenje:**
- Hardcoded boje iz STATUS objekta prebaciti u CSS klase u `GuestProfilePage.module.css`
- Koristiti `data-status` atribute za stilizovanje umjesto inline objekata
- Pattern koji se već koristi na `ReservationsPage` (Hotel.module.css `STATUS_BADGE`)

**Trajanje:** 1–2 sata

**Definition of Done:**
- [ ] Nema inline `style={{ background: '#...', color: '#...' }}` za status badge-ove
- [ ] Dark mode na `/admin/guests/:id` vizuelno ispravan
- [ ] `STATUS_STYLES`, `VISIT_STATUS`, `HOTEL_STATUS`, `SPA_STATUS` konvertovani u CSS klase

---

### B3 — `select('*')` audit u kritičnim hookovima (🔵 Srednji prioritet)

**Problem:** 41 fajl koristi `.select('*')`. U hookovima koji se pozivaju pri svakom renderu ili realtime updateu, ovo je nepotreban bandwidth overhead.

**Rješenje — prioritizovati hookove:**
- `src/modules/hotel/hooks/useRooms.js` — specificirati kolone (status, floor, notes, room_type_id...)
- `src/layouts/GuestMenu.jsx` (linija 158) — `restaurants` select
- `src/modules/guests/pages/GuestProfilePage.jsx` — `guests` select

**Trajanje:** 2–3 sata

**Definition of Done:**
- [ ] Hookovi koji se pozivaju pri svakom mount/realtime updateu nemaju `select('*')`
- [ ] Sporadični admin query-ji mogu zadržati `select('*')` ako je kompleksnost visoka

---

### B4 — `restaurants` → `tenants`: definisanje plana migracije (🔵 Dokumentacija)

**Problem:** `restaurants` tabela služi kao primarni tenant identifikator za hotele koji nemaju restoran — konceptualno netačno. Svaka nova tabela s `restaurant_id` produbljuje ovaj dug.

**Ovo NIJE implementacijski task** — implementacija ide u Fazu 9+ kad se dodaje `multi_property`. Cilj ove stavke je **definisati šta migracija podrazumijeva** da bi budući development bio svjestan opsega.

**Plan migracije (za buduću referencu):**
1. Nova tabela `tenants` (neutralan naziv) — kopija strukture `restaurants`, bez F&B-specifičnih polja
2. Dodati `tenant_id UUID REFERENCES tenants(id)` na sve tabele (uz zadržavanje `restaurant_id` za backwards compat)
3. RLS politike prebaciti na `tenant_id`
4. `restaurant_id` postaje alias — zadržati do potpune migracije
5. Finalno brisanje `restaurant_id` kolona u Fazi 10+

**Pravilo do tada:** Svaki novi modul koristi `restaurant_id` konzistentno — ne uvodi novi naming konvenciju. Migracija se radi odjednom, ne postepeno po modulu.

**Definition of Done:**
- [x] Ovaj plan dokumentovan (✅ ovdje)
- [x] Svi novi moduli svjesni da `restaurant_id` = tenant identifikator do daljnjeg
- [x] Nijedan novi modul ne uvodi `property_id` ili `tenant_id` do formalnog odlučivanja

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
- ✅ `RatePlansPage` — upravljanje cjenovnim planovima (v2: paket/sezonski, room_type_id, multiplikator; v3: ograničavanje na specifične sobe putem `rate_plan_rooms`)
- ✅ `BookingSettings` — podešavanja booking engina
- ✅ `HousekeepingPage` — housekeeping dashboard
- ✅ `RevenueManagementPage` — ADR, RevPAR, trendovi

### Integracije:
- ✅ Check-in automatski kreira folio
- ✅ Check-out automatski zatvara folio i postavlja sobu na "cleaning"
- ✅ WaiterDashboard — "Naplati na sobu" dodaje narudžbu na folio
- ✅ FrontDeskPage — blacklist provjera pri check-inu (upozorenje ako gost na crnoj listi)
- ✅ FrontDeskPage — 👤 link na guest profil uz svako ime gosta

---

## ✅ Faza 3 — Booking Engine (DJELIMIČNO ZAVRŠENA)

### Što je urađeno:
- ✅ `BookingPage` (`/:slug/book`) — kompletna javna booking stranica
  - Odabir datuma, tip sobe, podaci gosta, plaćanje
  - i18n (MNE/EN)
  - PayPal plaćanje (online) + Pay on Arrival opcija
- ✅ `send-booking-email` Edge Function (Resend)
  - Tipovi: confirmed, cancelled, checkin, checkout
  - HTML email sa brandingom hotela
  - Link na Guest App + kod gosta u emailu
- ✅ `RatePlansPage` + `BookingSettings` admin UI

### Što je urađeno (Booking Engine v2 — 2026-06-01):
- ✅ `room_availability` tabela + trigeri za ažuriranje pri rezervacijama
- ✅ `get_available_rooms()` RPC (BIGINT fix, base_price, has_packages flag)
- ✅ `rate_plans` v2 — dva tipa: **Package** (fiksna cijena po tipu sobe) i **Seasonal** (hotel-wide multiplikator)
  - `room_type_id` FK, `plan_type`, `multiplier`, `applies_from/until`, `payment_type`
  - Validacija preklapanja sezonskih planova (frontend, toast upozorenje)
- ✅ `get_room_packages()` RPC — paketi za odabranu sobu sa sezonskim multiplikatorom
- ✅ `BookingPage` — inline package picker (soba → paket → gost → plaćanje)
  - `has_packages` flag: sobe bez paketa idu direktno na guest info
- ✅ **Pay on Arrival** — `payment_type: 'on_arrival'` na paketu → skip PayPal → `create_booking_direct` RPC
  - Rezervacija se kreira direktno, `payment_status = 'pending'`, plaćanje na recepciji
  - Tamno dugme "Rezerviši — plati na recepciji" umjesto PayPal-a

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
- ✅ **Pay on Arrival email fix** — `send-booking-email` poziva se iz `BookingPage.jsx` nakon `create_booking_direct` RPC
- ✅ **Booking mod (immediate / manual)** — admin bira u BookingSettings:
  - `restaurants.booking_mode` TEXT DEFAULT `immediate`
  - `create_booking_direct` RPC prima `p_status` (confirmed | inquiry); availability se smanjuje samo za confirmed
  - `send-booking-email` novi `received` tip — narandžasta, "čeka odobrenje hotela"
  - BookingSettings card UI za odabir moda
  - `booking-order-capture` Edge Function poštuje `booking_mode`
  - `ReservationForm` šalje email potvrde gostu kad admin promijeni inquiry → confirmed
- ⬜ Resend domen verifikacija (trenutno `onboarding@resend.dev`) — **preduslov za produkciju emailova**

---

## ✅ Faza 4 — Housekeeping modul (DJELIMIČNO ZAVRŠENA)

- ✅ `housekeeping_tasks` tabela sa RLS
- ✅ `HousekeepingPage` admin UI — taskovi, statusi, dodjela
- ✅ `useHousekeeping` hook — realtime subscription za taskove i maintenance
- ✅ Bug fix: maintenance bez datumskog filtera (badge 2 / prazna stranica nekonzistentnost)
- ✅ Bug fix: housekeeping badge ostaje do `verified` kao maintenance (konzistentno sa `rooms.status = available`)
- ✅ `HousekeepingView` (staff portal) — zadaci čišćenja s real-time updateom (ref pattern)
- ✅ `MaintenanceView` (staff portal) — zahtjevi za održavanje s real-time updateom (ref pattern)
- ✅ Realtime fix: `housekeeping_tasks` + `maintenance_requests` u `supabase_realtime` publikaciji (`20260604000001`)
- ✅ Realtime fix: `REPLICA IDENTITY FULL` na obje tabele (`20260603000003`)
- ✅ Realtime fix: `useHousekeeping` ref pattern — subscription stabilan bez gubitka eventa
- ✅ Badge fix: `useKitchenCounts` prima `null` pre-login — kanal se kreira tek s autentifikovanom sesijom
- ✅ Housekeeping, Reservations, Revenue, FrontDesk stranice mobile responsive (Jun 2026)
- ⬜ Mobile-optimizovani prikaz za sobarice u Staff portalu (staff portal je funkcionalan ali nije dizajniran za uski ekran)

---

## ✅ Faza 5 — Revenue Management (DJELIMIČNO ZAVRŠENA)

- ✅ Revenue metrics materialized view + pg funkcija
- ✅ `RevenueManagementPage` — ADR, RevPAR, Occupancy Rate, grafovi
- ⬜ Price suggestion algoritam (prijedlog cijene na osnovu popunjenosti)
- ⬜ Export analitike u PDF/Excel

---

## ✅ Faza 3e — Guest CRM (ZAVRŠENA — 2026-06-01)

### Motivacija

Hotel treba da zna ko su mu gosti — historijat boravaka, spa tretmani, preferencije, VIP status. Ova faza uspostavlja jedinstven profil gosta koji objedinjuje restoran, hotel i spa aktivnosti.

### Baza podataka:
- ✅ `guests` tabela — proširena sa: `name`, `nationality`, `document_number`, `vip_status`, `last_visit_at`
- ✅ `guests` RLS politike — vlasnik i osoblje
- ✅ `rate_plans.payment_type` TEXT (online | on_arrival)
- ✅ `hotel_reservations.package_name` TEXT
- ✅ `create_booking_direct()` RPC — kreira rezervaciju direktno (pay on arrival), dekrement availability
- ✅ Trigger `trg_hotel_reservation_auto_guest` (BEFORE INSERT na `hotel_reservations`):
  - Traži gosta po emailu (`lower(email)` match)
  - Ako ne postoji → kreira novog (split `guest_name` → `first_name`/`last_name`)
  - Linkuje `hotel_reservations.guest_id` automatski
  - Radi za SVE rezervacije: PayPal online, Pay on Arrival, i ručne

### Admin UI:
- ✅ `HotelGuestsPage` (`/admin/hotel/guests`) — hotel-specifična lista gostiju
  - Kartični prikaz, search po imenu/emailu
  - VIP badge, broj hotelskih boravaka, zadnji boravak
  - Inline edit: ime, telefon, nacionalnost, datum рођења, broj dokumenta, napomene, VIP status
- ✅ `HotelDashboard` — dodati "Gosti 👤" quick link

### Unified Guest Profile (`/admin/guests/:id`):
- ✅ **Hotel tab** — svi hotelski boravci: datumi, tip sobe, paket, status, iznos; noći automatski računate
- ✅ **Spa tab** — svi spa tretmani: datum, tretman, terapeut, cijena, status
- ✅ **Stats row** proširen: rest. posjete + hotel boravaka + spa tretmana + ukupno potrošeno (restoran + hotel)
- ✅ **Edit forma** — dodano: `Nacionalnost` i `Broj dokumenta (pasoš/LK)`
- ✅ Tabs: Posjete (N) · Hotel (N) · Spa (N) · Napomene · Nalog

### Kako gosti teku u sistem:
```
Online booking (PayPal)  → booking-order-capture Edge Function → hotel_reservation INSERT → TRIGGER → guest kreiran/nađen
Pay on arrival           → create_booking_direct RPC           → hotel_reservation INSERT → TRIGGER → guest kreiran/nađen
Ručna rezervacija        → ReservationForm                     → hotel_reservation INSERT → TRIGGER → guest kreiran/nađen
```

---

## ✅ Guest Profile Pro + WaiterMapView Mobile (Jun 2026)

Proširenja urađena organički uz Fazu 3e — nisu bila u originalnom planu ali su postala neophodna.

### Guest Profile proširenja (`/admin/guests/:id`)

- ✅ **Sve tab** — unified activity feed koji miješa restoran posjete, hotel boravke i spa tretmane u jedan kronološki timeline sa ikonama i statusima
- ✅ **Pill navigacija** — refaktovana na standardne `pillBar/pillBtn` klase iz `nav.module.css`
- ✅ **DateNav filtriranje** — `filterFrom`, `filterTo`, `search` na svim tabovima (visits, hotel, spa, sve)
- ✅ **Restoran narudžbe** — u Visits tabu prikazane i ručne posjete i narudžbe iz `orders` tabele gdje je `guest_id` vezan; automatski se vezuju kad gost plati na sobu
- ✅ **Sortabilni headeri + responsive tabela gostiju** — `/admin/hotel/guests` i `/admin/guests` imaju `SortableHead` i column-hiding na mobilnom

### WaiterMapView Mobile (`/admin/tables/view`)

- ✅ **Card grid prikaz** — na mobilnom (<640px) stolovi se prikazuju kao grid kartica umjesto mape (jer pinch-zoom na mapi nije upotrebljiv na telefonu)
- ✅ **Bottom sheet** — detalji stola (narudžba, zahtjevi) slide-up iz dna ekrana
- ✅ **Calling bar** — fiksna traka na vrhu s popisom stolova koji aktivno zovu konobara; pulse animacija na svakom pozivu

---

## ✅ Hotel Rezervacije UI refaktor + DateNav sistem (Jun 2026)

Kompletna obnova UI-ja hotel rezervacija i unifikacija date filtera kroz cijelu platformu.

### Hotel Rezervacije — nova arhitektura (`/admin/hotel/reservations`)

- ✅ **Lista + Kalendar u jednoj stranici** — toggle Lista/Kalendar u headeru; Lista koristi DateNav, Kalendar ima vlastitu navigaciju
- ✅ **Kalendar granularnost** — Dan / Sedmica / Miesec / Period (date range) sa odgovarajućim navigacijom (← Nazad / Danas / Naprijed →)
- ✅ **ReservationForm** — auto-dodjela sobe (prvi slobodan u tipu), filter zauzetih soba po datumu (query sa preklapanjem check_in/check_out), isključene sobe na `maintenance` i `blocked`
- ✅ **Status filter "Upit"** — `inquiry` dodan u horizontalni filter bar (bio prisutan u `STATUS_LABELS` ali nije bio u `STATUS_FILTERS`)
- ✅ **Status badge boje** — novi `STATUS_BADGE` objekt s jasnim bojama (inquiry=indigo, confirmed=zelena, checked_in=plava, checked_out=siva, cancelled=crvena, no_show=narandžasta)
- ✅ **Badge dark mode** — CSS klase u `Hotel.module.css` umjesto inline stilova; `:global([data-theme*="-dark"])` override za svaki status

### DateNav sistem — unifikacija filtera

- ✅ **`showMonth` prop** — dugme "Miesec" + `<input type="month">` u DateNav; postavljanje from/to na prvi/zadnji dan odabranog mjeseca
- ✅ **`allowAll` prop** — dugme "Sve" koje briše date filter (from=null, to=null); hook-ovi (`useHousekeeping`, `useSpaAppointments`) ažurirani da rade s null datumima
- ✅ **`onSearch` default** — dodan default `() => {}` da spriječi crash kad se DateNav koristi bez search-a
- ✅ **Propagacija na 8 stranica** — FrontDesk, Housekeeping, Kitchen/Bar, SpaDashboard, Appointments, MovementsLog, HR Reports (DateNav zamijenio period picker), Tables Reservations (DateNav zamijenio custom input)

### Razni UX fiksovi (uz commit 36f3944)

- ✅ **AdminLayout sidebar** — "Sajt restorana" link ispravljen na `/admin/menu/landing`; dodata ruta u `App.jsx`
- ✅ **AnalyticsPage** — horizontalni meni koristio vlastite CSS klase; zamijenjen standardnim `nav.pillBar/pillBtn/pillBtnActive`
- ✅ **HRReportsPage** — custom period picker (6 dugmadi: this_week/last_month/...) zamijenjen DateNavom; inicijalizovan na tekući mjesec
- ✅ **StaffPage** — `create-staff-user` 400 greška: dodan proper error parsing iz `FunctionsHttpError.context.json()`
- ✅ **Housekeeping** — defaultni filter za zadatke = `pending` (bio `all`), za održavanje = `open` (bio `all`); "Svi" premješten na kraj liste

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

## ✅ Faza Y.1 — Upload slika u Supabase Storage (ZAVRŠENA)

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

## ✅ Faza Y.3 — Visual Page Editor (Hotel + Restoran) (ZAVRŠENA)

> **Preduslov:** Faza Y.1 završena (block editori i ImageUpload rade).
> **Trajanje:** 8–10 dana
> **Važi za:** Oba editora — `HotelLandingEditor` + `RestaurantLandingEditor`
> **Odluka usvojena:** 2026-06-01

Trenutni block editor radi ispravno ali administrator nema vizuelni osjećaj kako stranica izgleda dok uređuje. Cilj ove faze je **uvesti live preview, drag & drop reorder, layout varijante po bloku i nove vrste blokova** — bez prelaška na kompleksni canvas editor koji bi bio preskup za maintain.

### Arhitektura editora (poslije Y.3)

```
┌─────────────────────────────────────────────────────────┐
│  HotelLandingEditor / RestaurantLandingEditor           │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │  PANEL LIJEVO    │  │  PANEL DESNO — Live Preview  │ │
│  │  (40% širine)    │  │  (60% širine)                │ │
│  │                  │  │                              │ │
│  │  [⠿] Hero ──────│─→│  iframe: /:slug/hotel        │ │
│  │       forma...   │  │         ?preview=true        │ │
│  │  [⠿] O hotelu   │  │                              │ │
│  │       forma...   │  │  [📱] [💻] toggle           │ │
│  │  [⠿] Galerija   │  │                              │ │
│  │  ...             │  │  ← ažurira se u realnom     │ │
│  │                  │  │    vremenu postMessage-om    │ │
│  └──────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

### Y.3.A — Live Preview (iframe split-screen)

**Princip rada:**
1. Editor otvara iframe koji prikazuje `/[slug]/hotel?preview=true` (ili `/[slug]/home?preview=true`)
2. Svaki put kad se blok promijeni, editor šalje poruku u iframe putem `postMessage` (debounce 300ms)
3. Landing stranica u preview modu prima poruku i ažurira prikaz bez DB poziva
4. Admin vidi promjenu u roku od ~300ms

**Kod — editor strana (parent):**
```jsx
const iframeRef = useRef()
const sendPreview = useMemo(
  () => debounce((blocks) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'PREVIEW_UPDATE', blocks },
      window.location.origin  // isti origin — Vercel domen
    )
  }, 300),
  []
)
useEffect(() => sendPreview(blocks), [blocks, sendPreview])
```

**Kod — landing stranica (iframe child):**
```jsx
const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true'

useEffect(() => {
  if (!isPreview) return
  const handler = (e) => {
    if (e.origin !== window.location.origin) return  // sigurnosna provjera
    if (e.data?.type === 'PREVIEW_UPDATE')
      setLandingBlocks(e.data.blocks.filter(b => b.enabled))
  }
  window.addEventListener('message', handler)
  return () => window.removeEventListener('message', handler)
}, [isPreview])
```

**Preview mod skriva:** scroll-bar, header admina, "Powered by" footer u punom viewu — prikazuje samo čistu stranicu.

**Device toggle:**
```jsx
const DEVICE_WIDTHS = { mobile: '375px', tablet: '768px', desktop: '100%' }
// iframe wrapper dobija: style={{ width: DEVICE_WIDTHS[device], margin: '0 auto' }}
```

---

### Y.3.B — Drag & Drop Reorder

**Paket:** `@dnd-kit/core` + `@dnd-kit/sortable` (nema heavy dependencija, accessibility-friendly)

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Implementacija:**
```jsx
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

// U editoru:
const handleDragEnd = ({ active, over }) => {
  if (!over || active.id === over.id) return
  setBlocks(prev => {
    const oldIdx = prev.findIndex(b => b.type === active.id)
    const newIdx = prev.findIndex(b => b.type === over.id)
    return arrayMove(prev, oldIdx, newIdx)
  })
}

// Svaki blok postaje SortableItem sa drag handleom (⠿)
// ↑↓ dugmad se uklanjaju
```

**`BlockSortable.jsx`** — nova dijeljenja komponenta:
```
src/components/shared/BlockSortable.jsx
  Props: id, children
  Interna: useSortable(id) → dragHandle div + transform/transition CSS
  Vizuelno: ⠿ ikona, cursor grab, shadow pri dragovanju
```

---

### Y.3.C — Layout varijante po bloku

Svaki blok dobija opciono `layout` polje unutar `data` JSONB-a. Nema DB migracija — `data` je slobodan JSONB.

U editoru: **`BlockLayoutPicker.jsx`** — set radio-dugmadi sa mini thumbnail prikazom.

**Hotel blokovi — varijante:**

| Blok | Varijante | Default |
|------|-----------|---------|
| `hero` | `fullscreen` · `compact` · `split` | `fullscreen` |
| `about` | `image-right` · `image-left` · `text-only` | `image-right` |
| `gallery` | `grid-2` · `grid-3` · `masonry` | `grid-3` |
| `amenities` | `icons-row` · `list` · `cards` | `icons-row` |
| `contact` | `card` · `minimal` · `two-column` | `card` |
| `rooms` | (auto, bez varijanti) | — |
| `location` | `card-only` · `card-with-map` | `card-with-map` |

**Restoran blokovi — varijante:**

| Blok | Varijante | Default |
|------|-----------|---------|
| `hero` | `fullscreen` · `compact` · `split` | `fullscreen` |
| `story` | `image-right` · `image-left` · `text-only` · `image-above` | `image-right` |
| `gallery` | `grid-2` · `grid-3` · `masonry` | `grid-3` |
| `menu_preview` | `grid` · `list` · `cards` | `grid` |
| `hours_location` | `card-only` · `card-with-map` | `card-with-map` |
| `reservation_cta` | `banner` · `card` · `minimal` | `banner` |

**Layout varijante u CSS-u:**
```css
/* Primjer — about blok */
.aboutWrap[data-layout="image-right"]  { flex-direction: row; }
.aboutWrap[data-layout="image-left"]   { flex-direction: row-reverse; }
.aboutWrap[data-layout="text-only"]    { /* sakrij img */ }

/* Primjer — hero blok */
.hero[data-layout="fullscreen"]  { min-height: 100vh; }
.hero[data-layout="compact"]     { min-height: 50vh; }
.hero[data-layout="split"]       { display: grid; grid-template-columns: 1fr 1fr; }
```

---

### Y.3.D — Novi blokovi

**Zajednički za Hotel i Restoran:**

#### `reviews` — Recenzije gostiju
```
Admin unos: do 6 recenzija
  - Ime gosta (text)
  - Ocjena (1–5 zvjezdica, select)
  - Tekst recenzije (textarea)
  - Datum ili "2025" (text, opcionalno)

Javni prikaz: horizontalni scroll kartice (mobile) / 3-kolone grid (desktop)
Layout varijante: cards / list / featured (jedna istaknuta + ostale manje)
```

Nema integracije sa vanjskim review platformama — ručni unos je namjerno jednostavniji i bez dependencija.

#### `video` — Video embed
```
Admin unos:
  - YouTube ili Vimeo URL (text input)
  - Naslov iznad videa (opcionalno)
  - Automatska konverzija URL → embed URL:
    youtube.com/watch?v=ID  →  youtube.com/embed/ID
    youtu.be/ID             →  youtube.com/embed/ID
    vimeo.com/ID            →  player.vimeo.com/video/ID

Javni prikaz: responsive iframe (16:9, max-width: 800px, centrirano)
```

#### `cta_banner` — Promotivni strip
```
Admin unos:
  - Naslov (text)
  - Podnaslov / opis (text, opcionalno)
  - Tekst dugmeta (text)
  - Link dugmeta (url — može biti eksterni ili /slug/book)
  - Pozadinska boja (color picker — samo za ovaj blok)

Javni prikaz: puni-width strip sa akcentnom bojom, naslov + dugme
Layout varijante: centered / left-aligned / with-image (+ ImageUpload)
```

**Samo Hotel:**

#### `faq` — Česta pitanja
```
Admin unos: do 10 Q&A parova
  - Pitanje (text)
  - Odgovor (textarea)

Javni prikaz: accordion (HTML <details>/<summary>), nema JS potreban)
Layout varijante: default / two-column
```

**Samo Restoran:**

#### `specials` — Specijaliteti
```
Admin unos: do 3 stavke
  - Naziv jela (text)
  - Opis (text, kratki)
  - Cijena (text, npr. "12€")
  - Slika (ImageUpload)

Javni prikaz: 3 kartice u redu, slika + ime + cijena
Layout varijante: cards / list / featured
```

---

### Y.3.E — Shared komponente (refaktor)

Trenutno `RestaurantLandingEditor` importuje CSS iz hotel modula (`HotelLandingEditor.module.css`) — ovo je tehnički dug koji se rješava u ovoj fazi.

```
src/components/shared/
  BlockSortable.jsx       — DnD sortable wrapper (drag handle, transform, transition)
  LandingPreview.jsx      — iframe panel + 📱/💻 device toggle
  BlockLayoutPicker.jsx   — Radio thumbnails za layout varijante
  BlockFieldRenderer.jsx  — Extrahovana logika renderovanja polja (image, textarea, url, ...)
  LandingEditor.module.css — Zajednički CSS koji importuju oba editora (zamjena hotel-specific CSS-a)
```

Oba editora (`HotelLandingEditor`, `RestaurantLandingEditor`) ostaju odvojeni (svaki ima vlastiti `BLOCK_DEFS`), ali koriste iste shared komponente. Ovo smanjuje duplikaciju i olakšava buduće izmjene.

---

### Definition of Done — Faza Y.3 ✅ ZAVRŠENA

**A — Live Preview:**
- [x] Editor se dijeli na lijevu (forme, 40%) i desnu (iframe, 60%) panel na desktopima
- [x] Na mobilnom prikazu editora: preview se skriva, prikazuje se samo forma
- [x] iframe prikazuje `/[slug]/hotel?preview=true` (ili `/home`) — isti origin
- [x] Promjene blokova se reflektuju u iframe-u u realnom vremenu (postMessage, debounce 300ms)
- [x] Device toggle: 📱 Mobile (375px) / 📓 Tablet (768px) / 🖥 Desktop (full)
- [x] Preview mod landing stranice ne prikazuje admin elemente
- [x] "Vidi sajt" link otvara stranicu u novom tabu bez `?preview`
- [x] *(extra)* Collapse/expand blokova — svi blokovi startuju kolapsovani
- [x] *(extra)* Preview panel: toggle aktivacija, resizable divider, full-height iframe
- [x] *(extra)* PREVIEW_HEIGHT postMessage — iframe visina = puna visina landing stranice

**B — Drag & Drop:**
- [x] `@dnd-kit` instaliran i konfigurisan
- [x] Hotel editor: drag & drop reorder blokova radi
- [x] Restoran editor: drag & drop reorder blokova radi
- [x] Drag handle (⠿) vidljiv na svakom bloku, cursor grab
- [x] ↑↓ dugmad uklonjena
- [x] `BlockSortable.jsx` shared komponenta kreirana

**C — Layout varijante:**
- [x] `BlockLayoutPicker.jsx` komponenta kreirana (radio + mini thumbnail prikaz, 15 tipova)
- [x] Hotel — hero: 3 varijante renderuju se ispravno
- [x] Hotel — about: 3 varijante (image-right, image-left, text-only)
- [x] Hotel — gallery: 3 varijante (2-kolone, 3-kolone, masonry)
- [x] Hotel — amenities: 3 varijante (icons-row, list, cards)
- [x] Restoran — story: 4 varijante
- [x] Restoran — gallery: 3 varijante
- [x] Restoran — reservation_cta: 3 varijante (banner, card, minimal)
- [x] Layout se čuva u `data.layout` unutar postojećeg JSONB-a

**D — Novi blokovi:**
- [x] `reviews` — Hotel: admin unos + javni prikaz sa zvjezdicama
- [x] `reviews` — Restoran: admin unos + javni prikaz
- [x] `video` — Hotel: URL → auto-convert → embed iframe
- [x] `video` — Restoran: isti
- [x] `cta_banner` — Hotel: naslov + dugme + link
- [x] `cta_banner` — Restoran: isti
- [x] `faq` — Hotel: accordion Q&A
- [x] `specials` — Restoran: 3 stavke sa slikom i cijenom

**E — Shared komponente:**
- [x] `LandingEditor.module.css` kreiran i importuje se u oba editora
- [x] `LandingPreview.jsx` kreirana i koristi se u oba editora
- [x] `BlockFieldRenderer.jsx` extrahovana, eliminiše duplikaciju u oba editora

---

## ✅ Sistemske popravke i poboljšanja — Jun 2026

> Urađeno organički tokom razvoja — stabilizacija, realtime infrastruktura, staff portal proširenja.

### Bugfixevi

- ✅ **GuestMenu.jsx — memory leak** — waiter Realtime channel bez cleanup; dodan `useRef` + `removeChannel` pri unmount
- ✅ **GuestProfilePage + GuestsPage** — svi `guests` upiti dobili `.eq('restaurant_id', restaurant.id)` filter
- ✅ **WaiterView — kitchen/bar trigger** — `updateOrderStatus` sada ispravno postavlja `kitchen_status`/`bar_status = 'preparing'` i fetchuje `category_id` za razlikovanje bar/kuhinja stavki
- ✅ **WaiterView — poruke odbijanja** — usklađene sa admin orders (restaurant.rejection_messages umjesto hardcoded)
- ✅ **Waiter/Ordering visibility** — eksplicitna admin postavka ima prednost nad QR restrikcijom (fix: poziv konobara vidljiv bez QR ako admin postavi `waiter_visibility = 'all'`)
- ✅ **Housekeeping badge** — maintenance zahtjevi bez datumskog filtera (badge 2 / prazna stranica bug)
- ✅ **Housekeeping badge workflow** — badge ostaje do `verified` za oba tipa (zadaci i održavanje), konzistentno sa sobom koja postaje `available` tek pri `verified`

### Realtime infrastruktura (AdminBadgeContext + belt-and-suspenders)

Problem: Supabase `postgres_changes` sa filterom ne isporučuje UPDATE evente pouzdano za ne-owner korisnike (REPLICA IDENTITY DEFAULT).

Rješenje: dva sloja — vlastiti `kc-channel` subscription + piggyback na view component subscriptione.

- ✅ **`useKitchenCounts` shared hook** — izvučen iz AdminLayout u `src/hooks/useKitchenCounts.js`, vraća `{ counts, refresh }`
- ✅ **`AdminBadgeContext`** — exportovan iz AdminLayout, proslijeđen kao Provider u oba `{children}` mjesta
- ✅ **Admin pages** — `WaiterDashboard`, `KitchenDashboard`, `FrontDeskPage`, `RoomsPage`, `HousekeepingPage` konzumiraju context i pozivaju `refreshCounts` uz vlastiti realtime
- ✅ **`useRooms` hook** — dodan realtime subscription za `rooms` tabelu + `onRefresh` callback
- ✅ **`useHousekeeping` hook** — `onRefresh` callback, `updateTaskStatus` poziva refresh direktno (UPDATE eventi ne stižu pouzdano)
- ✅ **Staff portal badges** — `useKitchenCounts(restaurant?.id)` uvijek aktivan (ne čeka `mergedTabs`); view komponente (WaiterView, KitchenView, BarView) primaju `onRefresh` prop
- ✅ **Permission-based tab detekcija** — `tabsFromPermissions()` umjesto samo `detectPortalType()` name-detection; `staff_roles` query dohvata i `permissions` kolonu

### Staff portal proširenja (Jun 2026 — narudžbe)

- ✅ **Station statusi na narudžbi** — `WaiterView` prikazuje iste poruke kao admin/orders: `🧑‍🍳 Kuhinja priprema`, `🍷 Bar priprema`, `🧑‍🍳 Kuhinja gotova`, `🍷 Bar gotov` — inline u kartici narudžbe umjesto samo "Gotovo"
- ✅ **"Naplati na sobu" u staff portalu** — `WaiterView` identičan flow kao `WaiterDashboard`: panel za unos broja sobe, provjera open folija, INSERT u `folio_items`, update `folios.total_amount`, vidljiv samo kad je `hotel_core` addon aktivan (`hotelEnabled` prop iz StaffPortal koji čita subscription)
- ✅ **Subscription fetch u StaffPortal** — pri učitavanju restorana paralelno se dohvata i `subscriptions` red; `hasAddon(subscription, 'hotel_core')` proslijeđen kao `hotelEnabled` u WaiterView

### Housekeeping realtime fiksevi (Jun 2026)

Tri uzastopna buga pronađena i riješena pri testiranju admin ↔ staff portal realtime:

**Bug 1 — Tabele nisu bile u Supabase realtime publikaciji**
- Uzrok: `housekeeping_tasks` i `maintenance_requests` nisu bile u `supabase_realtime` PostgreSQL publikaciji — nijedan klijent nije primao postgres_changes evente, bez obzira na kod
- Fix: migracija `20260604000001_realtime_housekeeping.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE housekeeping_tasks; ... maintenance_requests;`
- Efekat: admin ↔ staff portal realtime počeo raditi u oba smjera

**Bug 2 — Nestabilni subscription dependency array (ref pattern)**
- Uzrok: `useHousekeeping`, `HousekeepingView`, `MaintenanceView` su imali `[restaurantId, load, onRefresh]` kao deps za subscription effect — svaka promjena funkcijske reference rušila kanal i eventualno gubila evente
- Fix: ref pattern u sva tri fajla — subscription ovisi samo o `restaurantId`; `load` i `onRefresh` se drže u `useRef`-ovima

**Bug 3 — useKitchenCounts inicijaliziran pre-login (broken kanal)**
- Uzrok: `useKitchenCounts(restaurant?.id)` pozivao se čim se restoran učita, PRIJE logina. Supabase WebSocket kanal kreiran s anonimnom sesijom **ne rekonektor se automatski** s novim JWT-om nakon logina — ostaje u neispravnom stanju i ne prima INSERT/UPDATE evente
- Manifestacija: badgevi na staff portalu prikazivali 0 za housekeeping/maintenance, čak i kad postoje taskovi; promjene iz admin panela (npr. `RoomsPage` → "pošalji na čišćenje") nisu se odražavale na staff portalu bez refresha
- Fix: `useKitchenCounts(mode === 'portal' ? restaurant?.id : null)` — kanal se kreira tek kad staff član bude autentifikovan

### Permissions i bar stanica

- ✅ **`view_kitchen_orders` + `view_bar_orders`** — nove granularne permisije u `PERMISSIONS.menu`
- ✅ **ROLE_TEMPLATES** — `kuhinja` dobija `view_kitchen_orders`, `sank` dobija `view_bar_orders`
- ✅ **AdminLayout** — `/admin/kitchen` i `/admin/bar` sidebar linkovi koriste granularne permisije
- ✅ **`detectPortalType`** — `šank/sank/barman/bartender/barista` odvojen u vlastiti `bar` tip (bio u `waiter`)
- ✅ **`BarView.jsx`** — nova staff portal komponenta: filtrira `bar_status = 'preparing'`, prikazuje samo barske stavke, ljubičasti top border
- ✅ **`KitchenView.jsx`** — ispravka: filter `kitchen_status = 'preparing'` umjesto `status IN (received, preparing)`; `markReady` postavlja `kitchen_status = 'ready'` i provjerava oba statusa → `status = 'ready'`

### Mobile responsive — admin hotel stranice (Jun 2026)

- ✅ **FrontDeskPage** (/admin/hotel/frontdesk) — kartice na mobilnom za sve tri sekcije: Check-in, Check-out, Zahtjevi gostiju
- ✅ **ReservationsPage** (/admin/hotel/reservations) — lista rezervacija kao kartice na mobilnom; kalendar ostaje horizontalno skrolabilan
- ✅ **HousekeepingPage** (/admin/hotel/housekeeping) — zadaci čišćenja i održavanja kao kartice na mobilnom
- ✅ **RevenueManagementPage** (/admin/hotel/revenue) — prijedlozi cijena kao kartice na mobilnom; KPI i grafovi već su bili responzivni
- Pattern: desktop tabela skrivena na < 640px, mobilne kartice vidljive — isti pristup kao WaiterMapView

### Admin dashboard poboljšanja (Jun 2026)

- ✅ **2 nova KPI-a**: Popunjenost % (checked_in / ukupno soba × 100, real-time) i Slobodne sobe (rooms.status = available) — prikazuju se samo kad je hotel_core aktivan
- ✅ **KPI grid 2×2 na mobilnom** — umjesto jednog ispod drugog
- ✅ **Modul kartice 2 kolone na mobilnom** — uklonjen 1-kolona override na < 440px
- ✅ **Sistem kartice konzistentnost** — adminOnly moduli (Postavke) sada imaju isti stil kao "Role i permisije" i "Super admin panel" (cardSys klasa, bez "Aktivan" badge-a)

### Landing page i editor fiksevi (Jun 2026)

- ✅ **Lazy loading fix** — uklonjen `loading="lazy"` sa gallery slika i Google Maps iframea u oba landing fajla (hotel i restoran); eliminisan browser `[Intervention]` koji je zamjenjivao slike placeholderima u preview iframeu
- ✅ **Landing editor mobile preview** — na mobilnom (< 1100px) preview toggle dugme se zamjenjuje "Vidi sajt" linkom koji otvara sajt u novom tabu; primijenjeno na oba editora (HotelLandingEditor i RestaurantLandingEditor)

---

## ✅ Bug registar — Realtime konzistentnost (RIJEŠENO 2026-06-04)

> Pronađeno pri testiranju housekeeping realtime (Jun 2026). Svi bugovi su iste klase: **stari subscription pattern ili nepotvrđena DB konfiguracija**. Ne blokiraju produkciju ali su tehnički dug koji treba riješiti sustavno.

---

### B-RT-1 — Staff portal views: stari subscription pattern (🟡 Srednji prioritet)

**Fajlovi:** `BarView.jsx`, `KitchenView.jsx`, `WaiterView.jsx`, `SpaView.jsx`, `ReceptionView.jsx`

**Problem:** Svi koriste stari pattern s `[restaurantId, load, onRefresh]` u subscription useEffect dependency arrayu:
```js
}, [restaurantId, load, onRefresh]) // ❌ onRefresh može promijeniti referencu
```

**Rizik:** Ako `onRefresh` (= `refreshCounts` iz `useKitchenCounts`) promijeni referencu, kanal se gaši i ponovo otvara. Za kratko vrijeme eventi se gube. U praksi `refreshCounts` je `useCallback` s `[restaurantId]` deps i rijetko se mijenja — bug je latentni, ne stalni.

**Fix:** Primijeniti ref pattern iz §7.2 na svih 5 fajlova. Trajanje: ~30 min.

```
Definition of Done:
- [x] BarView.jsx — ref pattern ✅
- [x] KitchenView.jsx — ref pattern ✅
- [x] WaiterView.jsx — ref pattern ✅
- [x] SpaView.jsx — ref pattern ✅
- [x] ReceptionView.jsx — ref pattern ✅
```

---

### B-RT-2 — useRooms hook: stari subscription pattern (🟡 Srednji prioritet)

**Fajl:** `src/modules/hotel/hooks/useRooms.js`

**Problem:** Subscription dependency array `[restaurantId, load, onRefresh]` — isti problem kao B-RT-1.

**Napomena:** `useRooms` se koristi u admin kontekstu (authenticated owner) pa je rizik manji nego za staff portal. Ali konzistentnost nalaže fix.

```
Definition of Done:
- [x] useRooms.js — ref pattern za subscription effect ✅
```

---

### B-RT-3 — WaiterMapView: channel bez restaurantId (🔵 Nizak prioritet)

**Fajl:** `src/modules/tables/pages/WaiterMapView.jsx`

**Problem:** Channel name je hardcoded `'waiter-map'` bez `restaurantId`:
```js
const channel = supabase.channel('waiter-map') // ❌ nije multi-tenant safe
```

**Rizik:** Ako isti browser ima dva taba sa različitim tenantima otvorenim, ili ako se komponenta instancira dva puta, Supabase bi mogao imati konflikt sa istoimenim kanalom.

**Fix:** Promijeniti u `supabase.channel(\`waiter-map-${restaurant.id}\`)`.

```
Definition of Done:
- [x] WaiterMapView.jsx — channel name uključuje restaurantId ✅
```

---

### B-RT-4 — Nepotvrđena DB konfiguracija za ostale realtime tabele (🔴 Visok prioritet — provjeriti)

**Problem:** Sljedeće tabele se koriste u `postgres_changes` subscriptionima ali nije potvrđeno jesu li u `supabase_realtime` publikaciji i imaju li REPLICA IDENTITY FULL:

| Tabela | Gdje se koristi | Status |
|--------|----------------|--------|
| `hotel_reservations` | `ReceptionView`, `useReservationCounts`, `FrontDeskPage` | ❓ nepotvrđeno |
| `spa_appointments` | `SpaView`, `SpaDashboard` | ❓ nepotvrđeno |
| `rooms` | `useRooms`, `RoomsPage` | ❓ nepotvrđeno |
| `guest_requests` | `FrontDeskPage`, `GuestAppPage` | ❓ nepotvrđeno |

**Ako ove tabele NISU u publikaciji:** realtime u ReceptionView, SpaView i sličnim ne funkcioniše (korisnici moraju refreshovati stranicu da vide promjene) — isti simptom koji smo vidjeli kod housekeepinga.

**Akcija:** Pokrenuti SQL upit na Supabase dashboardu:
```sql
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

Ako neka tabela nedostaje, kreirati migraciju:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE hotel_reservations;
ALTER TABLE hotel_reservations REPLICA IDENTITY FULL;
-- ponavljati za svaku tabelu koja nedostaje
```

```
Definition of Done:
- [x] Provjeriti koje tabele su u supabase_realtime publikaciji ✅
- [x] Migracija 20260604000002 — hotel_reservations, rooms, spa_appointments, guest_requests ✅
- [ ] Testirati realtime u ReceptionView (check-in/out u realnom vremenu)
- [ ] Testirati realtime u SpaView (termini u realnom vremenu)
```

---

### B-RT-5 — spa_appointments nije testiran za realtime (🟡 Srednji prioritet)

**Fajl:** `src/pages/StaffPortal/views/SpaView.jsx`

**Problem:** `SpaView` subscribuje na `spa_appointments` ali:
1. Nije poznato je li tabela u `supabase_realtime` publikaciji (vidi B-RT-4)
2. `SpaView` koristi stari subscription pattern (vidi B-RT-1)

**Rizik:** Terapeut na staff portalu ne vidi nove termine dok ne refreshuje stranicu.

---

## ⬜ Faza N — Nocni audit + Split folio + Doručak kontrola

> **Preduslov:** `hotel_core` aktivan.
> **Trajanje:** 5–7 dana
> **Addon:** `night_audit` (ili uključiti u `hotel_core`)
> **Izvor:** Hotel IS Funkcionalna Specifikacija — Modul 1 (PMS) + Modul 3 (Finansije)

### Motivacija

Svaki hotel mora obaviti nocni audit svaki dan — bez njega financijski izvještaji su netačni, room charge stavke za narednu noć se ne dodaju na folio, a statusi soba se ne resetuju. Trenutno ne postoji ni dugme ni automatizacija za ovaj proces.

### Nocni audit (Night Audit)

Automatski EOD (End-of-Day) proces — pokreće se jednim klikom ili automatski u ponoć:

- Prenosi dnevne troškove soba (room charge) na sve otvorene folije
- Provjerava otvorene folije za check-out goste i signalizira ih
- Generira dnevni financijski izvještaj: prihodi po kategoriji (soba/spa/F&B/ostalo), popunjenost, ADR
- Resetuje housekeeping statuse (checked_out sobe → `cleaning`)
- Opciono: datum lock prethodnog dana (prethodni unosi se ne mogu brisati)

### Split folio

Jedan gost, više folija po rezervaciji (ključno za poslovne goste):

- Admin kreira sekundarni folio uz postojeći (npr. `Osobni troškovi` + `Firma d.o.o.`)
- Svaka folio stavka se može dodijeliti na specifičan folio
- Oba folija mogu imati različite načine plaćanja (kartica + gotovina, firma + gost)
- Folio print generira zasebne izvještaje po foliju

### Doručak kontrola

Evidencija konzumiranja uključenih doručaka po sobi (sprječava zloupotrebe):

- Sobe s uključenim doručkom imaju flag `breakfast_included` (iz `rate_plans`)
- Recepcioner ili konobar potvrđuje doručak po sobi (scan sobe ili ručni unos)
- Dnevni pregled: koliko soba ima uključen doručak, koliko iskorišteno
- Neiskorišteni doručci vidljivi u F&B analitici

### Definition of Done

- [ ] Nocni audit — dugme u admin panelu + pg_cron automatski u ponoć
- [ ] Nocni audit — room charge stavke dodaju se na sve otvorene folije
- [ ] Nocni audit — dnevni financijski izvještaj (screen prikaz + CSV export)
- [ ] Split folio — kreiranje sekundarnog folija uz rezervaciju
- [ ] Split folio — dodjela stavki na specifičan folio
- [ ] Split folio — zasebni print za svaki folio
- [ ] `breakfast_included` flag na `rate_plans`
- [ ] Doručak kontrola — dnevna evidencija konzumiranja po sobi
- [ ] Doručak kontrola — dnevni izvještaj (planirano vs. iskorišteno)

---

## ⬜ Faza P — PMS proširenja (Room service, Minibar, Grupne rezervacije)

> **Preduslov:** `hotel_core` + `booking_engine` aktivni.
> **Trajanje:** 10–14 dana
> **Addon:** `pms_pro`
> **Izvor:** Hotel IS Funkcionalna Specifikacija — Modul 1 (PMS) + Modul 2 (F&B)

### Room service

Gost naručuje hranu/piće direktno iz sobe:

- Guest App tab "Room service" — lista jela iz F&B menija (ili poseban room service meni)
- Narudžba ide u kuhinjski/bar dashboard kao poseban tip (`source: room_service`)
- Status praćenja: primljeno → u pripremi → isporučeno
- Naplata: automatski na folio gosta, ili gotovina pri isporuci
- Admin konfiguriše radno vrijeme room servicea i minimalni iznos narudžbe

### Minibar

Evidencija utroška minibar stavki po sobi:

- Admin definira sadržaj minibar po tipu sobe (stavke, količine, cijene)
- Pri check-out: recepcioner unosi šta je gost konzumirao (ili gost samo prijavi)
- Minibar stavke automatski idu na folio pri check-out
- Izvještaj: prosjek utroška po sobi, najpopularnije stavke

### Grupne rezervacije

Za hotele koji primaju grupe (vjenčanja, sportski timovi, korporativni incentivi):

- Grupna rezervacija — blokiranje N soba određenog tipa za period
- Rooming lista — dodjela konkretnih gostiju sobama unutar grupe
- Pickup tracking — koliko od blokiranog je rezervisano/potvrđeno
- Group master folio — jedinstven račun za cijelu grupu (plaća organizator)
- Waitlista — pri otkazivanju, automatski email prvom na listi

### Definition of Done

- [ ] Room service tab u Guest App s listom stavki
- [ ] Room service narudžbe vidljive u Kitchen/Bar dashboardu (`source: room_service`)
- [ ] Room service stavke automatski na folio gosta
- [ ] Minibar definicija po tipu sobe (admin)
- [ ] Minibar — unos utroška pri check-out s kalkulacijom iznosa
- [ ] Minibar stavke automatski na folio
- [ ] Grupna rezervacija — kreiranje s brojem blokira soba
- [ ] Rooming lista — dodjela gostiju sobama unutar grupe
- [ ] Pickup tracking na admin UI (N blokirana, N potvrđena)
- [ ] Group master folio — sve stavke grupe na jedan folio
- [ ] `waitlist` tabela + automatski email pri oslobađanju sobe

---

## ⬜ GDPR Compliance UI

> **Preduslov:** Nijedan — cross-cutting feature.
> **Trajanje:** 3–4 dana
> **Prioritet:** 🔴 Visok — zakonska obaveza (GDPR / Zakon o zaštiti ličnih podataka)
> **Izvor:** Hotel IS Funkcionalna Specifikacija — Modul 14 (GDPR)

### Funkcionalni zahtjevi

**Pravo na brisanje (Right to be Forgotten)**
- Admin može pokrenuti "Anonimizacija gosta" iz GuestProfilePage
- Akcija zamjenjuje ime/email/tel/dokument placeholderima (`Anonymized`, `deleted@gdpr.local`, `—`)
- Poslovni zapisi ostaju netaknuti (iznosi, folio, datumi) — samo lični podaci se brišu
- Audit log bilježi: ko je, kada i koji `guest_id` anonimizirao

**Export podataka (Right to Portability)**
- Admin ili gost može zatražiti download profila u JSON formatu
- Export uključuje: osnovni profil, historiju boravaka, spa tretmane, loyalty bodove, privole

**Privola management**
- `guests` tabela dobija kolone: `gdpr_consent_at`, `gdpr_consent_version`, `marketing_opt_in`
- Eksplicitni checkbox na BookingPage i Guest App registraciji
- Admin pregled: kada i na koji tekst privole je gost pristao

**Data retention podsjetnik**
- Admin konfiguriše period čuvanja (default: 3 godine od zadnjeg kontakta)
- Periodični izvještaj gostiju čije podatke treba provjeriti ili obrisati

### Definition of Done

- [ ] "Anonimizacija gosta" dugme u GuestProfilePage + potvrda
- [ ] Anonimizacija čuva poslovne zapise, briše lične podatke
- [ ] Audit log anonimizacije (`staff_id`, `timestamp`, `guest_id`)
- [ ] Export profila gosta u JSON (download link)
- [ ] `gdpr_consent_at` + `marketing_opt_in` kolone u `guests` tabeli
- [ ] Checkbox privole na BookingPage (online booking)
- [ ] Checkbox privole na Guest App
- [ ] Admin pregled privola po gostu u GuestProfilePage
- [ ] Data retention konfiguracija + izvještaj "gosti za provjeru"

---

## ⬜ Inventory Pro v2 — Dobavljači, Narudžbenice, Inventura

> **Preduslov:** `inventory_pro` addon aktivan.
> **Trajanje:** 7–10 dana
> **Addon:** Proširenje postojećeg `inventory_pro`
> **Izvor:** Hotel IS Funkcionalna Specifikacija — Modul 9 (Nabavka i zalihe)

### Registar dobavljača

- Naziv, kontakt osoba, email, telefon, kategorija (F&B / Spa / Housekeeping / Tehničko)
- Ugovorena cijena i uvjeti plaćanja (rokovi, popusti)
- Ocjena dobavljača (admin rating 1–5)
- Historija narudžbi i prosječno vrijeme isporuke
- Nova tabela: `suppliers` (restaurant_id, name, contact, category, lead_days, rating)

### Narudžbenica (Purchase Order)

- Admin kreira PO s dobavljačem i stavkama iz `inventory_items`
- Approval workflow: `draft` → `approved` → `sent` → `received`
- Primka robe: evidentiranje primljene količine vs. naručene — razlike se bilježe
- Auto-draft PO: kada `inventory_items.quantity` padne ispod `min_quantity`, sistem generiše draft PO
- Nova tabela: `purchase_orders` + `purchase_order_items`

### Inventura

- Admin pokreće inventuru za odjel i datum
- Unos stvarnog stanja po stavci; sistem prikazuje razliku vs. evidentiranog
- Generisanje izvještaja razlika s vrijednosnim iskazom (razlika × nabavna cijena)
- Inventura zaključuje period: prethodni unosi se više ne mogu mijenjati
- Nova tabela: `stock_takes` + `stock_take_items`

### Definition of Done

- [ ] `suppliers` tabela + CRUD u `/admin/inventory`
- [ ] Dobavljači vezani za `inventory_items` (svaka stavka ima preferirani dobavljač)
- [ ] `purchase_orders` tabela + kreiranje PO s approval workflowom
- [ ] Primka robe — unos stvarno primljene količine, ažuriranje stanja
- [ ] Auto-draft PO pri dostizanju minimalnog nivoa
- [ ] `stock_takes` tabela + UI za unos stvarnog stanja
- [ ] Izvještaj razlika inventure s vrijednosnim iskazom
- [ ] Period lock po inventuri

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

## ⬜ Faza M — MICE addon (Konferencije i eventi)

> **Preduslov:** `hotel_core` aktivan. F&B modul preporučen.
> **Trajanje:** 12–16 dana
> **Addon ID:** `mice` (~149€/mj hotel-specifični addon)
> **Izvor:** Hotel IS Funkcionalna Specifikacija — Modul 5 (MICE)

### Motivacija

Hoteli koji imaju konferencijsku salu propuštaju značajan prihod jer ne mogu efikasno upravljati rezervacijama sala i billingom po eventu. Bez ovog modula eventi se bilježe ručno (Excel), bez integracije s foliom, F&B-om ili korporativnim klijentima.

### Baza podataka

```sql
CREATE TABLE conference_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity_theatre INT, capacity_classroom INT,
  capacity_banquet INT, capacity_cocktail INT, capacity_u_shape INT,
  area_m2 NUMERIC,
  price_per_hour NUMERIC, price_per_day NUMERIC,
  equipment JSONB DEFAULT '[]',  -- ['projector','screen','microphone','AC','wifi']
  floor INT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE corporate_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT, contact_email TEXT, contact_phone TEXT,
  vat_number TEXT, address TEXT,
  contract_discount NUMERIC DEFAULT 0,  -- % popusta na standardnu tarifu
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  corporate_client_id UUID REFERENCES corporate_clients(id),
  name TEXT NOT NULL,
  event_type TEXT,  -- 'conference' | 'seminar' | 'wedding' | 'incentive' | 'other'
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  attendees_count INT,
  status TEXT DEFAULT 'inquiry',  -- inquiry | confirmed | completed | cancelled
  total_amount NUMERIC DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0, deposit_paid BOOLEAN DEFAULT false,
  notes TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE event_room_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  conference_room_id UUID REFERENCES conference_rooms(id),
  date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
  setup TEXT,  -- 'theatre' | 'banquet' | 'u_shape' | 'cocktail'
  price NUMERIC, notes TEXT
);

CREATE TABLE event_beo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  content JSONB DEFAULT '{}',  -- raspored, osoblje, hrana, oprema
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Admin UI (`/admin/hotel/mice/...`)

| Ruta | Stranica |
|------|---------|
| `/admin/hotel/mice` | MICE Dashboard — eventi danas/sedmica, prihod, kapacitet |
| `/admin/hotel/mice/calendar` | Vizualni kalendar zauzetosti svih sala |
| `/admin/hotel/mice/events` | Lista i upravljanje eventima |
| `/admin/hotel/mice/events/new` | Kreiranje eventa s BEO |
| `/admin/hotel/mice/rooms` | Upravljanje salama |
| `/admin/hotel/mice/clients` | Korporativni klijenti |

### Ključne funkcionalnosti

- Vizualni kalendar sala — zauzetost u realnom vremenu, bez vremenskog preklopa
- BEO editor — detaljan nalog za event (raspored dana, hrana, osoblje, oprema)
- Ponuda (PDF) — generisanje iz sistema s cijenama i uvjetima
- Korporativni klijenti — firma s ugovorenom cijenom i historijom dogadjaja
- Depoziti i plaćanje — praćenje uplata, ostatak duga
- F&B integracija — katering za kafe-pauze i obroke automatski na event billing
- Folio integracija — event charges na folio korporativnog klijenta ili direktna naplata

### Definition of Done

- [ ] `conference_rooms`, `events`, `event_room_bookings`, `event_beo`, `corporate_clients` tabele sa RLS
- [ ] MICE Dashboard (eventi danas/sedmica, prihod, kapacitet %)
- [ ] Vizualni kalendar zauzetosti sala
- [ ] Event CRUD s lifecycle: inquiry → confirmed → completed → cancelled
- [ ] Bez vremenskog preklopa — sala ne može biti rezervisana dva puta
- [ ] BEO editor — print-ready prikaz
- [ ] Korporativni klijenti CRUD s ugovorenom cijenom
- [ ] PDF ponuda generisana iz sistema
- [ ] Depoziti — praćenje uplata i ostatka
- [ ] F&B integracija — katering stavke na event billing
- [ ] Folio integracija — naplata korporativnog klijenta

---

## ⬜ Faza 8.6 — Marketing automation addon (`marketing_auto`)

> **Preduslov:** `hotel_core` aktivan. Resend API konfigurisan.
> **Trajanje:** 5–8 dana
> **Addon ID:** `marketing_auto`
> **Izvor:** Hotel IS Funkcionalna Specifikacija — Modul 4 (Prodaja i marketing)

### Motivacija

Imamo Resend infrastrukturu i transakcijske emailove (booking potvrda, check-in/out). Sljedeći korak je automatizacija post-stay komunikacije i targeted ponuda bez ručnog rada — nula manualnog rada za visok engagement.

### Email triggeri

| Trigger | Timing | Sadržaj |
|---------|--------|---------|
| Pre-arrival | 2 dana prije check-in | Info o hotelu, parking, spa, room service |
| Post-stay | 24h nakon check-out | Zahvalnica + link za Google/TripAdvisor recenziju |
| Birthday | X dana prije rodjendana | Personalizovana ponuda za boravak (ako imamo datum) |
| Re-engagement | 6+ mj bez boravka | "Nedostajete nam" s aktuelnom ponudom |
| Spa reminder | 2 dana boravka bez spa termina | Info o spa + link za booking |

### Admin konfigurator (`/admin/marketing`)

- Toggle aktivnih kampanja per tip
- Per-kampanja: timing (dani), email template, ciljni segment (svi / loyalty / VIP)
- Statistike: sent / opened / clicked per kampanja (Resend webhook)

### Edge Functions

- `marketing-scheduler` — pg_cron svakih sat, skenira triggere iz `hotel_reservations` i `guests`
- `send-marketing-email` — šalje konkretan email sa templateom i unsubscribe linkovima

### Nova tabela

```sql
CREATE TABLE marketing_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  guest_id UUID REFERENCES guests(id),
  campaign_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  reservation_id UUID REFERENCES hotel_reservations(id)
);

CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  campaign_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  timing_days INT DEFAULT 1,  -- X dana prije/poslije triggera
  segment TEXT DEFAULT 'all'  -- 'all' | 'loyalty' | 'vip'
);
```

### Definition of Done

- [ ] `marketing_emails` i `marketing_campaigns` tabele sa RLS
- [ ] `marketing-scheduler` Edge Function + pg_cron hourly
- [ ] Pre-arrival email (2 dana prije check-in)
- [ ] Post-stay email (24h nakon check-out) s linkom za recenziju
- [ ] Birthday email (ako `guests.date_of_birth` postoji)
- [ ] Re-engagement email (6+ mj bez rezervacije)
- [ ] Admin UI `/admin/marketing` — toggle kampanja, statistike
- [ ] Resend webhook → ažuriranje `opened_at` / `clicked_at`
- [ ] Gost može unsubscribeovati (`marketing_opt_in = false` u `guests`)

---

## ⬜ Faza Z — Unified Staff Portal (`/:slug/staff`)

> **Preduslov:** Nijedan — ova faza refaktoriše postojeće portale i ne zahtijeva novi addon.
> **Trajanje:** 3–4 dana
> **Arhitekturalna odluka usvojena:** 2026-05-31

### Motivacija

Trenutno postoje **dva odvojena portala** za osoblje (`/:slug/osoblje` za HR, `/:slug/housekeeping` za sobarice), dok konobar i kuhinja koriste admin panel. Ovo je nekonzistentno i teško za maintain.

**Princip:** Jedan URL za svo operativno osoblje → `/:slug/staff`. Sadržaj se filtrira po roli.

### Arhitektura

```
/:slug/staff
  │
  ├── Login (email + lozinka, isti Supabase Auth)
  │
  └── Dashboard po roli:
        konobar      → Narudžbe, waiter requests, stolovi
        kuhinja      → Kitchen display (real-time narudžbe)
        sobarica     → Housekeeping zadaci (današnji)
        recepcija    → Check-in/out brze akcije, današnje rezervacije
        spa_terapeut → Dnevni termini, raspored
        menadžer     → Summary KPIs (skraćeni admin pogled)
```

### Što se mijenja

| Staro | Novo |
|-------|------|
| `/:slug/osoblje` (HR portal) | Deprecated → redirect na `/:slug/staff` |
| `/:slug/housekeeping` (sobarice) | Deprecated → redirect na `/:slug/staff` |
| Konobar/kuhinja u adminu | Dostupni i kroz `/:slug/staff` za odgovarajuće role |
| Recepcija samo admin | Brzi prikaz u `/:slug/staff` za reception rolu |
| Spa terapeut nema portal | Novi tab u `/:slug/staff` |

### Gost portal — odluka

**Nije jedan unified portal.** Gosti imaju fundamentalno različite user journey-e:
- **Restoran gost**: `/:slug` ostaje (QR scan → meni → narudžba, bez login-a)
- **Hotel gost**: `/:slug/guest` se **proširuje** da uključi spa booking tab (Faza 8 dopuna)
- **Vanjski spa gost**: `/:slug/spa` ostaje javna booking stranica (bez login-a)

Razlog: Restoran gost skenira QR za 10 sekundi — login ekran bi ga odbio. Hotel gost već ima authenticated iskustvo s rezervacijskim kodom.

### Definition of Done

- [x] `/:slug/staff` — login stranica (email + lozinka)
- [x] Role-based routing nakon logina (čita `staff.role_id → roles.name`)
- [x] Konobar view — lista narudžbi, puni status lanac, waiter requests + quick responses
- [x] Kuhinja view — real-time kitchen display
- [x] Sobarica view — housekeeping zadaci po datumu
- [x] Recepcija view — check-in/out za danas, status soba
- [x] Spa terapeut view — dnevni termini iz spa_appointments
- [x] Redirect: `/osoblje` i `/housekeeping` → `/staff`
- [x] Admin: "Staff portal" link u sidebaru s ažuriranim URL-om i opisom
- [x] `staff_roles` junction tabela — više rola po zaposleniku (Opcija A)
- [x] `StaffProfilePage` — multi-role checkbox UI u employment tabu
- [x] `permissions.js` — hotel/spa permisije + 5 novih predložaka rola
- [x] Role UI — horizontalni tabovi po modulu + Odaberi sve / Obriši sve

### Proširenja Staff portala — Jun 2026

- [x] **Pill navigacija** — bottom nav zamijenjen pill tabovima ispod headera (flex-wrap, prelazi u novi red po potrebi)
- [x] **Badge counti realtime** — `useKitchenCounts` shared hook + `AdminBadgeContext` + belt-and-suspenders piggyback na view subscriptione
- [x] **Permission-based tab detekcija** — tabovi se određuju prema stvarnim permisijama role iz baze (ne samo naziv); menadžer vidi sve operativne tabove
- [x] **Bar stanica** — `BarView` komponenta, `view_bar_orders` / `view_kitchen_orders` granularne permisije, `sank` odvojen od `waiter` u detectPortalType
- [x] **WaiterView usklađivanje** — iste poruke odbijanja kao admin, kitchen/bar trigger ispravljen, `order.note` prikaz, `category_id` u query
- [x] **ReceptionView realtime** — subscription za `hotel_reservations` i `rooms` promjene (check-in/out vidljiv bez refresha)
- [x] **Hotel admin realtime** — `FrontDeskPage`, `RoomsPage`, `HousekeepingPage` + `useRooms`/`useHousekeeping` onRefresh callback

---

## ✅ Faza Z.1 — Staff Portal: Platforma za zaposlene (Faza 1 ZAVRŠENA)

> **Preduslov:** Faza Z završena (`/:slug/staff` portal radi, role-based tabovi postoje).
> **Ne zahtijeva DB migracije** — sve potrebne tabele već postoje (`attendance_entries`, `staff_absences`, `work_schedules`, `staff`).
> **Faza 1:** ✅ Kompletna | **Faza 2 (profil tab + oglasna ploča):** ⬜ nije urađena

### Motivacija

Faza Z je uspostavila unified portal za zaposlene — login, role detection, operativni tabovi (housekeeping, waiter, kuhinja, recepcija, spa) i HR tabovi (raspored, dolasci, zarada, odsustva). Međutim, portal je **pasivan** — zaposlenik vidi podatke ali ne može pokrenuti nijednu radnju bez admina:

- Nema centralnog pregleda (portal odmah pada na operativni tab)
- Clock in/out jedino admin može uraditi kroz `/admin/hr/attendance`
- Zaposlenik ne može tražiti slobodan dan — forma ne postoji
- Admin nema UI za odobravanje/odbijanje zahtjeva za odsustvo

---

### Faza 1 — Kritično (visok prioritet)

#### A) Home tab — centralni dashboard

Novi tab `home` (uvijek prvi, uvijek vidljiv za sve role) prikazuje:

- Ime zaposlenika + današnji datum
- **Tekuća smjena danas** (iz `work_schedules` za danas) — prominentno u kartici
- **Clock in/out dugme** (veliko, u bojama brenda):
  - Ako nema aktivnog `attendance_entry` za danas → `Prijavi dolazak`
  - Ako ima `clock_in` bez `clock_out` → `Prijavi odlazak` + live timer (format: `2h 34min`)
- **Mini stanje godišnjeg** — `X od Y dana iskorišteno` (iz `staff_absences` + `staff.vacation_days_total`)
- **Pending zahtjevi** — broj odsustva na čekanju (badge ako > 0)

#### B) Clock in/out logika

```
Klik "Prijavi dolazak":
  → INSERT attendance_entries { staff_id, restaurant_id, date: TODAY, clock_in: NOW() }
  → Dugme postaje "Prijavi odlazak", timer počinje

Klik "Prijavi odlazak":
  → UPDATE attendance_entries SET clock_out = NOW(), hours_worked = razlika
  → Dugme se vraća na "Prijavi dolazak"

Live timer:
  → setInterval svake sekunde, prikazuje elapsed time od clock_in
  → Vidljiv samo dok je zaposlenik "na poslu" (clock_in bez clock_out)
```

#### C) Zahtjev za odsustvo iz portala

U `HrView` — tab `absences` — dodati dugme **+ Zatraži odsustvo** koje otvara formu:

- **Tip** — select: Godišnji odmor / Bolovanje / Lični razlog / Ostalo
- **Datum od** — date input
- **Datum do** — date input (min = datum od)
- **Napomena** — textarea (opciono)
- **Pošalji zahtjev** → INSERT u `staff_absences` sa `approved = false`

Postojeća lista odsustva ostaje ispod forme (sa "Na čekanju" / "Odobreno" badge-ovima).

#### D) Admin odobravanje odsustva

Dvije tačke u admin panelu:

1. **`StaffProfilePage`** — tab "Odsustva":
   - Dodati `Odobri` / `Odbij` dugmad pored svakog pending zahtjeva
   - Klik → UPDATE `staff_absences SET approved = true/false`
   - Ako odobren godišnji → automatski ažurirati `staff.vacation_days_used`

2. **`StaffPage`** (`/admin/hr/staff`) — lista zaposlenih:
   - Dodati badge **"N zahtjeva"** (narandžast) pored zaposlenika koji ima pending odsustva
   - Brzi uvid bez otvaranja profila

---

### Faza 2 — Poboljšanja (srednji prioritet)

#### E) Profil zaposlenika u portalu

Novi tab `profile` u portalu (posljednji u navigaciji):

- Pregled: ime, email, rola, datum zaposlenja
- Editable: telefon, adresa, emergency kontakt (ime + telefon)
- Promjena lozinke — Supabase `updateUser({ password })`

#### F) Oglasna ploča (Bilten)

Admin objavljuje kratke poruke/obavijesti vidljive svim zaposlenicima u Home tabu.

**Nova tabela:**
```sql
CREATE TABLE staff_announcements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  expires_at    TIMESTAMPTZ  -- null = ne istječe
);
```

- Admin kreira obavijest iz `/admin/hr/staff` (inline forma ili modal)
- Poruka se prikazuje u Home tabu portala (kartica iznad smjene)
- Istekle poruke (`expires_at < now()`) se ne prikazuju

---

### Što se mijenja u kodu

| Fajl | Izmjena |
|------|---------|
| `StaffPortal.jsx` | Dodati `home` kao prvi tab za sve role u `PORTAL_TABS` |
| `views/HomeView.jsx` | **Novi fajl** — Home dashboard sa smjenom, clock in/out, godišnjim |
| `views/HrView.jsx` | Dodati formu za zahtjev odsustva u `absences` tab |
| `StaffProfilePage.jsx` | Odobri/Odbij dugmad u Odsustva tabu, auto-update `vacation_days_used` |
| `StaffPage.jsx` | Badge broja pending zahtjeva pored zaposlenika |

> Tabele su sve već tu — `attendance_entries`, `staff_absences`, `work_schedules`. Faza 2 (F — Oglasna ploča) jedina zahtijeva novu tabelu `staff_announcements`.

---

### Definition of Done — Faza Z.1

**Faza 1:** ✅ KOMPLETNA
- [x] `home` tab (uvijek prvi) dodan u `PORTAL_TABS` za sve role
- [x] `HomeView.jsx` — tekuća smjena danas prikazana prominentno
- [x] Clock in/out dugme radi (INSERT/UPDATE `attendance_entries`)
- [x] Live timer aktivan dok je zaposlenik "na poslu" (svake sekunde)
- [x] Mini godišnji pregled (iskorišteno/preostalo)
- [x] Pending odsustva badge u Home tabu
- [x] Forma za zahtjev odsustva u portalu (Odsustva tab)
- [x] INSERT u `staff_absences` sa `approved = null` po submittu
- [x] Odobri/Odbij dugmad u `StaffProfilePage` → tab Odsustva
- [x] Auto-update `vacation_days_used` pri odobravanju godišnjeg
- [x] Badge br. pending zahtjeva na listi zaposlenih u adminu

**Faza 2:** ✅ KOMPLETNA
- [x] `profile` tab u portalu — pregled + edit (telefon, adresa, emergency)
- [x] Promjena lozinke iz portala
- [x] `staff_announcements` tabela sa RLS
- [x] Admin forma za kreiranje obavijesti (`/admin/hr/staff` — sekcija ispod liste)
- [x] Obavijesti prikazane u Home tabu portala (samo aktivne, neistekle)

### Bonus — Reorganizacija navigacije (2026-06-04)
- [x] Bottom nav bar: 🏠 Početna · ⚡ Posao · 👤 Ja
- [x] "Posao" se ne prikazuje ako rola nema operativnih tabova
- [x] Sub-pills ispod headera za aktivnu sekciju (samo kad > 1 tab)
- [x] Ukupni badge na "Posao" sekciji

---

## ⬜ Faza Z.2 — HR Pro proširenja (Obuke, Performanse, Dokumenti)

> **Preduslov:** Faza Z + Z.1 završene, `hr_pro` addon aktivan.
> **Trajanje:** 5–7 dana
> **Addon:** Proširenje `hr_pro`
> **Izvor:** Hotel IS Funkcionalna Specifikacija — Modul 7 (HR)

### Plan obuke

- Admin definira godišnji plan edukacije po zaposleniku ili poziciji
- Svaka obuka: naziv, institucija, datum, trajanje, status, upload potvrde
- Praćenje realizacije: planirano vs. obavljeno
- Tabela `staff_trainings` (staff_id, naziv, institucija, datum, status, potvrda_url)

### Performanse / Evaluacija

- Godišnja ili polugodišnja evaluacija zaposlenika (manager → zaposlenik)
- Manager unosi: period, ciljevi, ocjena (1–5), komentar
- Zaposlenik vidi vlastite evaluacije u Staff portalu (Profil tab)
- Historija svih evaluacija po zaposleniku u `StaffProfilePage`
- Tabela `staff_evaluations` (staff_id, period, ocjena, ciljevi, komentar, created_by)

### Dokumenti zaposlenika

- Admin uploaduje ugovor, certifikate, licence u Supabase Storage
- Upload u `StaffProfilePage` → novi tab "Dokumenti"
- Zaposlenik vidi vlastite dokumente u Staff portalu (Profil tab)
- Tabela `staff_documents` (staff_id, naziv, tip, file_url, uploaded_at, uploaded_by)

### Definition of Done

- [ ] `staff_trainings` tabela + CRUD u StaffProfilePage
- [ ] Plan obuke — godišnji pregled sa statusima i upload potvrde
- [ ] `staff_evaluations` tabela + forma za managera (ocjena, ciljevi, komentar)
- [ ] Evaluacije vidljive zaposleniku u Staff portalu Profil tabu
- [ ] `staff_documents` tabela + upload u Supabase Storage (`staff-docs` bucket)
- [ ] Dokumenti vidljivi zaposleniku u Staff portalu Profil tabu

---

## ✅ Faza R — Bar kao posebna stanica (Restoran enhancement) (ZAVRŠENA)

> **Datum:** 2026-05-31 – 2026-06-01
> **Motivacija:** Restoran može imati šank (bar) kao zasebnu stanicu pored kuhinje — osoblje bara treba odvojen real-time prikaz i workflow, a konobar treba vidjeti status oba duela.

### DB izmjene:
- ✅ `categories.is_bar` kolona (BOOLEAN, default false) — kategorizuje stavke menija kao barske
- ✅ `orders.kitchen_status` + `orders.bar_status` — odvojeni statusi po stanici (pending/preparing/ready/served)

### KitchenDashboard (`/admin/kuhinja`):
- ✅ Bar tab odvojen od Kuhinje — svaki tab prikazuje samo narudžbe relevantne za svoju stanicu
- ✅ Real-time badge za Bar u sidebaru (samo aktivne narudžbe, served/closed isključeni iz broja)
- ✅ CSS varijable umjesto hardcodovanih boja (dark mode kompatibilnost)

### WaiterDashboard & Staff portal:
- ✅ `markReady` — odvojen SELECT nakon UPDATE za pouzdano čitanje station statusa
- ✅ Badge Narudžbe/Kuhinja/Bar prate workflow ispravno (served/closed isključeni)
- ✅ Zahtjevi badge = nerazriješeni `waiter_requests` (ranije pogrešno brojao narudžbe)
- ✅ Hardcoded boje zamijenjene CSS varijablama (WaiterDashboard, LanguageSwitcher, sbRestTitle)

### Ostalo:
- ✅ `ChunkErrorBoundary` — auto reload pri stale chunk grešci nakon Vercel deploya
- ✅ Dark mode — bijeli tekst na svim obojanim površinama (zamjena `var(--c-surface)` → `white`)

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
| ~~RESEND_API_KEY regeneracija~~ | ✅ Riješeno | Novi API key generisan i ažuriran u Supabase Edge Function secrets | Odmah |
| PAYPAL_WEBHOOK_ID env var | 🟡 Srednji | Dodati `PAYPAL_WEBHOOK_ID` u Supabase Edge Function secrets (PayPal Dashboard → Webhooks → ID) | 1 |
| ~~SITE_URL env var u Supabase~~ | ✅ Riješeno | `SITE_URL` postavljen u Supabase Edge Function secrets (2026-06-02) | Odmah |
| Supabase Vault za payment kredencijale | 🔴 Visok | Omogućiti Vault; `tenant_payment_configs.credentials_secret_id` referenca umjesto plain kredencijala | PAY |
| Stripe addon purchase flow | 🟡 Srednji | "Aktiviraj modul" dugme treba kreirati Stripe Checkout Session i redirectovati korisnika; webhook ažurira subscription.addons | 1 dopuna |
| ~~`room_availability` + `get_available_rooms()`~~ | ✅ Riješeno | Tabela + trigeri + RPC implementirani, BookingPage integrisan, pay on arrival dodan | 3d/3e |
| Housekeeping auto-trigger | 🟡 Srednji | DB trigger `create_checkout_cleaning_task()` koji kreira task i mijenja status sobe na 'cleaning' pri check-outu | 4 |
| Folio PDF server-side | 🟢 Nizak | `FolioPrint` postoji kao print-friendly stranica, ali nema server-side PDF generisanja; razmotriti `@react-pdf/renderer` ili Puppeteer Edge Function | 2 dopuna |
| ~~Upload slika u editoru~~ | ✅ Riješeno | `ImageUpload` komponenta implementirana, oba editora ažurirana | Y.1 |
| ~~spa/housekeeping FK constraints~~ | ✅ Riješeno | Tabele kreirane ručno bez FK-ova uzrokovale 400 greške; migracije 000004–000008 dodaju sve FK-ove | fix |
| ~~PlatformContext 406 loop~~ | ✅ Riješeno | `.single()` → `.maybeSingle()` + filtriranje TOKEN_REFRESHED eventa | fix |
| ~~Zastarjeli portali /osoblje i /housekeeping~~ | ✅ Riješeno | Redirect na `/:slug/staff` implementiran sa `StaffPortalRedirect` komponentom | Z |
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
| Y.3 | Live preview (iframe split-screen, postMessage, debounce) — Hotel | ⬜ | |
| Y.3 | Live preview — Restoran | ⬜ | |
| Y.3 | Device toggle (📱/💻/🖥) u editoru | ⬜ | |
| Y.3 | BlockSortable.jsx — DnD wrapper (dnd-kit) | ⬜ | |
| Y.3 | Drag & drop reorder — Hotel editor | ⬜ | |
| Y.3 | Drag & drop reorder — Restoran editor | ⬜ | |
| Y.3 | BlockLayoutPicker.jsx — layout radio thumbnails | ⬜ | |
| Y.3 | Layout varijante — hero, about/story, gallery, amenities, CTA (Hotel) | ⬜ | |
| Y.3 | Layout varijante — hero, story, gallery, menu_preview, reservation_cta (Restoran) | ⬜ | |
| Y.3 | Novi blok: reviews — Hotel (admin + javni prikaz) | ⬜ | |
| Y.3 | Novi blok: reviews — Restoran | ⬜ | |
| Y.3 | Novi blok: video embed — Hotel + Restoran | ⬜ | |
| Y.3 | Novi blok: cta_banner — Hotel + Restoran | ⬜ | |
| Y.3 | Novi blok: faq (accordion) — Hotel | ⬜ | |
| Y.3 | Novi blok: specials (3 stavke) — Restoran | ⬜ | |
| Y.3 | LandingEditor.module.css — zajednički CSS, eliminacija hotel-importa iz restoran editora | ⬜ | |
| Y.3 | BlockFieldRenderer.jsx — extrahovana logika polja | ⬜ | |
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
| 8.5 | Email podsjetnik X sati prije (pg_cron) | ✅ | 2026-05-31 |
| fix | spa_therapists FK constraints + anon RLS politike | ✅ | 2026-05-31 |
| fix | spa_visibility toggle u opštim postavkama (addon guard) | ✅ | 2026-05-31 |
| fix | spa sidebar — duplikat Termini/Kalendar uklonjen | ✅ | 2026-05-31 |
| fix | spa 400 greška — role→role:roles(name) u svim spa hookovima | ✅ | 2026-05-31 |
| fix | hotel CTA redesign — full-width primary, card secondary row | ✅ | 2026-05-31 |
| fix | admin header responsive — tablet 960px, mobile kompresija | ✅ | 2026-05-31 |
| fix | housekeeping FK constraints + trigger obnova (migration) | ✅ | 2026-05-31 |
| fix | PlatformContext 406 greška — single→maybeSingle svuda | ✅ | 2026-05-31 |
| fix | PlatformContext loop — loadProfile samo na SIGNED_IN | ✅ | 2026-05-31 |
| arch | Unified Staff Portal arhitektura usvojena (Faza Z) | ✅ | 2026-05-31 |
| Z | /:slug/staff — login + role detection + bottom nav shell | ✅ | 2026-05-31 |
| Z | Konobar view — puni status lanac + quick responses + odbijanje | ✅ | 2026-05-31 |
| Z | Kuhinja view — real-time kitchen display | ✅ | 2026-05-31 |
| Z | Sobarica view — housekeeping zadaci | ✅ | 2026-05-31 |
| Z | Recepcija view — check-in/out + status soba | ✅ | 2026-05-31 |
| Z | Spa terapeut view — dnevni termini | ✅ | 2026-05-31 |
| Z | Redirect /osoblje i /housekeeping → /staff (apsolutan path) | ✅ | 2026-05-31 |
| Z | staff_roles junction tabela + multi-role portal support | ✅ | 2026-05-31 |
| Z | permissions.js — hotel/spa permisije + 5 novih predložaka | ✅ | 2026-05-31 |
| Z | Role UI — horizontalni tabovi + Odaberi/Obriši sve po modulu | ✅ | 2026-05-31 |
| 8d | Guest App spa tab — katalog, termini, folio booking | ✅ | 2026-05-31 |
| 8.5 | send-spa-reminder Edge Function + pg_cron svakih 15 min | ✅ | 2026-05-31 |
| billing | Novi plan model — Starter/Restoran/Hotel/Hotel Pro | ✅ | 2026-05-31 |
| billing | Monthly/Annual toggle sa 20% popustom (annual default) | ✅ | 2026-05-31 |
| billing | planUtils.js — PLAN_INCLUDES mapa, hasAddon backward compat | ✅ | 2026-05-31 |
| billing | BillingPage redesign — 4 plan kartice, responsive grid | ✅ | 2026-05-31 |
| billing | SuperAdminPanel — novi planovi u dropdown + PlanBadge update | ✅ | 2026-05-31 |
| rebrand | SmartMeni → rest.by.me + novi Landing page + Kuhinja u sidebaru | ✅ | 2026-05-31 |
| R | categories.is_bar + orders.kitchen_status / bar_status (DB migracija) | ✅ | 2026-05-31 |
| R | Bar tab u KitchenDashboard + is_bar na kategorijama (admin UI) | ✅ | 2026-05-31 |
| R | Bar kao poseban sidebar tab + realtime badge (served/closed isključeni) | ✅ | 2026-05-31 |
| R | Kuhinja/Bar workflow fix + završene narudžbe filter po modu | ✅ | 2026-05-31 |
| R | Narudžbe — uklonjen 'Označi kao gotovo', prikazuje se status stanica | ✅ | 2026-05-31 |
| fix | ChunkErrorBoundary — auto reload pri stale chunk grešci nakon deploya | ✅ | 2026-05-31 |
| fix | markReady — odvojen SELECT/UPDATE za pouzdano čitanje station statusa | ✅ | 2026-06-01 |
| fix | Badge Kuhinja/Bar — isključi served/closed iz count querija | ✅ | 2026-06-01 |
| fix | Dark mode — bijeli tekst na obojanim površinama (bijela umjesto --c-surface) | ✅ | 2026-06-01 |
| fix | Hardcoded boje — WaiterDashboard, LanguageSwitcher, sbRestTitle | ✅ | 2026-06-01 |
| fix | KitchenDashboard — CSS varijable umjesto hardcodovanih boja | ✅ | 2026-06-01 |
| Y.3 | Live preview (iframe split-screen, postMessage, debounce) — Hotel + Restoran | ✅ | 2026-06-01 |
| Y.3 | Device toggle (📱/📓/🖥) u editoru | ✅ | 2026-06-01 |
| Y.3 | BlockSortable.jsx — DnD wrapper (dnd-kit) | ✅ | 2026-06-01 |
| Y.3 | Drag & drop reorder — Hotel + Restoran editor | ✅ | 2026-06-01 |
| Y.3 | Collapse/expand blokova — svi blokovi startuju kolasirani | ✅ | 2026-06-01 |
| Y.3 | BlockLayoutPicker.jsx — layout radio thumbnails (15 tipova blokova) | ✅ | 2026-06-01 |
| Y.3 | Layout varijante — hero/about/story/gallery/amenities/contact/CTA | ✅ | 2026-06-01 |
| Y.3 | Novi blok: reviews — Hotel + Restoran (zvjezdice, admin unos) | ✅ | 2026-06-01 |
| Y.3 | Novi blok: video embed — Hotel + Restoran (YouTube/Vimeo auto-convert) | ✅ | 2026-06-01 |
| Y.3 | Novi blok: cta_banner — Hotel + Restoran | ✅ | 2026-06-01 |
| Y.3 | Novi blok: faq accordion — Hotel | ✅ | 2026-06-01 |
| Y.3 | Novi blok: specials (3 stavke sa slikom) — Restoran | ✅ | 2026-06-01 |
| Y.3 | LandingEditor.module.css — zajednički CSS, eliminacija hotel-importa iz restoran editora | ✅ | 2026-06-01 |
| Y.3 | Preview panel: toggle aktivacija, resizable divider, full-height iframe | ✅ | 2026-06-01 |
| Y.3 | PREVIEW_HEIGHT postMessage — iframe visina = puna visina landing stranice | ✅ | 2026-06-01 |
| fix | AdminLayout sidebar — jedan page scroll, bez zasebnog sidebar scrollera | ✅ | 2026-06-01 |
| ux | ControlPanel redesign — vertikale (Restoran/Hotel/Upravljanje/Sistem), KPI row (live), quick actions sa badge-ovima | ✅ | 2026-06-01 |
| ux | AdminMenuSettings — 4 taba: Opšte / Vidljivost / Poruke / Predlošci | ✅ | 2026-06-01 |
| ux | Vidljivost kontrole premještene iz GeneralSettings → AdminMenuSettings tab | ✅ | 2026-06-01 |
| ux | GeneralSettings — ostaju samo osnovni podaci objekta (naziv/lokacija/telefon/opis) | ✅ | 2026-06-01 |
| ux | Settings sidebar: ukloniti Predlošci + Sajt restorana; "Opšte postavke" → "Osnovni podaci" | ✅ | 2026-06-01 |
| ux | Menu sidebar: dodati Sajt restorana + Predlošci prelazi u tab Postavki menija | ✅ | 2026-06-01 |
| perf | PlatformContext — login waterfall eliminisan (user_profiles + restaurants + staff paralelno, staff path + sub paralelno) | ✅ | 2026-06-01 |
| perf | AdminLayout — lazy import, main bundle smanjen (bio 483kB, Suspense omata i layout i children) | ✅ | 2026-06-01 |
| perf | useKitchenCounts — 5 DB queries + 3 realtime kanala aktivni samo kad je aktivan menu/hotel modul | ✅ | 2026-06-01 |
| perf | subscriptions.select('*') → select('plan, addons, addon_trials') | ✅ | 2026-06-01 |
| perf | storageImg.js utility — Supabase Storage image transformacije (width/quality params) | ✅ | 2026-06-01 |
| fix | FrontDeskPage — period navigacija (Juče/Danas/Sutra/Period) za check-in i check-out tabove | ✅ | 2026-06-01 |
| fix | useReservations — checkInDate (eq) i checkOutDate (lte) filteri; popravka existing check-in query za multi-night rezervacije | ✅ | 2026-06-01 |
| fix | HousekeepingPage — verifikacija čišćenja (verified) ažurira rooms.status = 'available' | ✅ | 2026-06-01 |
| fix | HousekeepingPage — Verifikovano filter chip + split stats (done/verified zasebno) + prijevod Verifikuj/Verifikovano | ✅ | 2026-06-01 |
| fix | RestaurantLandingEditor/HotelLandingEditor — preview iframe scrollbar eliminisan (overflow:hidden na body u preview modu, inicijalna visina 1500px) | ✅ | 2026-06-01 |
| feat | Maintenance 4-step workflow: open → in_progress → done → verified (mirror čišćenje) | ✅ | 2026-06-01 |
| feat | Maintenance kreiranje s room_id → rooms.status = 'maintenance' automatski (soba blokirana za booking) | ✅ | 2026-06-01 |
| feat | Maintenance verifikacija → rooms.status = 'available' automatski (soba oslobođena) | ✅ | 2026-06-01 |
| feat | Maintenance stats sub-row + filter chipovi (Otvoreno/U toku/Završeno/Verifikovano) + MaintStatusBadge | ✅ | 2026-06-01 |
| N | Nocni audit — dugme + pg_cron scheduler + room charge na folije | ⬜ | |
| N | Nocni audit — dnevni financijski izvještaj (screen + CSV) | ⬜ | |
| N | Split folio — kreiranje sekundarnog folija, dodjela stavki, zasebni print | ⬜ | |
| N | Doručak kontrola — breakfast_included flag, dnevna evidencija, izvještaj | ⬜ | |
| P | Room service — Guest App tab, Kitchen/Bar dashboard, folio | ⬜ | |
| P | Minibar — definicija po sobi, unos utroška, folio pri check-out | ⬜ | |
| P | Grupne rezervacije — blokiranje, rooming lista, pickup, group master folio | ⬜ | |
| P | Waitlista — zapis + email pri oslobađanju | ⬜ | |
| GDPR | Anonimizacija gosta (Right to be Forgotten) + audit log | ⬜ | |
| GDPR | Export profila gosta u JSON | ⬜ | |
| GDPR | gdpr_consent_at + marketing_opt_in kolone + checkbox na BookingPage | ⬜ | |
| GDPR | Data retention konfiguracija + izvještaj gostiju za provjeru | ⬜ | |
| inv2 | suppliers tabela + CRUD + veza na inventory_items | ⬜ | |
| inv2 | purchase_orders — kreiranje, approval workflow, primka robe | ⬜ | |
| inv2 | Auto-draft PO pri dostizanju min. nivoa zalihe | ⬜ | |
| inv2 | stock_takes — inventura, stvarno stanje, izvještaj razlika, period lock | ⬜ | |
| M | conference_rooms + events + event_room_bookings + corporate_clients tabele | ⬜ | |
| M | MICE Dashboard (eventi, prihod, kapacitet %) | ⬜ | |
| M | Vizualni kalendar zauzetosti sala + bez preklopa | ⬜ | |
| M | Event CRUD s BEO editorom + PDF ponuda | ⬜ | |
| M | Korporativni klijenti CRUD s ugovorenom cijenom | ⬜ | |
| M | Depoziti + F&B integracija + folio integracija | ⬜ | |
| 8.6 | marketing_emails + marketing_campaigns tabele | ⬜ | |
| 8.6 | marketing-scheduler Edge Function + pg_cron hourly | ⬜ | |
| 8.6 | Pre-arrival, post-stay, birthday, re-engagement, spa reminder emailovi | ⬜ | |
| 8.6 | Admin UI /admin/marketing — toggle kampanja, statistike | ⬜ | |
| Z.2 | staff_trainings tabela + CRUD + upload potvrde | ⬜ | |
| Z.2 | staff_evaluations tabela + forma managera + prikaz u portalu | ⬜ | |
| Z.2 | staff_documents tabela + upload + prikaz u portalu | ⬜ | |
| Z.1 | Home tab (uvijek prvi) + HomeView.jsx — smjena, clock, godišnji | ✅ | 2026-06-04 |
| Z.1 | Clock in/out dugme u portalu (INSERT/UPDATE attendance_entries) | ✅ | 2026-06-04 |
| Z.1 | Live timer dok je zaposlenik na poslu (svake sekunde) | ✅ | 2026-06-04 |
| Z.1 | Forma za zahtjev odsustva iz portala (staff_absences, approved=null) | ✅ | 2026-06-04 |
| Z.1 | Admin: Odobri/Odbij odsustva u StaffProfilePage + auto vacation_days_used | ✅ | 2026-06-04 |
| Z.1 | Admin: badge br. pending zahtjeva na StaffPage listi | ✅ | 2026-06-04 |
| Z.1 | Profil tab u portalu — edit telefon/adresa/emergency + promjena lozinke | ✅ | 2026-06-04 |
| Z.1 | staff_announcements tabela + admin forma + prikaz u Home tabu | ✅ | 2026-06-04 |
| Z.1 | Bottom nav reorganizacija: Početna / Posao / Ja + sub-pills | ✅ | 2026-06-04 |
| fix | HR Reports responsive — mobilne kartice umjesto tabele (<640px) | ✅ | 2026-06-04 |
| fix | Raspored responsive — gridScrollWrap + touch scroll + kompaktne kolone | ✅ | 2026-06-04 |
| 9 | portfolios + brands + property_groups tabele | ⬜ | |
| 9 | portfolio_kpis materialized view + cron | ⬜ | |
| 9 | Portfolio dashboard UI | ⬜ | |
| 9 | detect-portfolio-alerts Edge Function | ⬜ | |
| 9 | Komparativna analitika + valutna konverzija | ⬜ | |
| 10 | brand_templates + template_assignments tabele | ⬜ | |
| 10 | Primjena šablona na objekte + notifikacije | ⬜ | |
| 10 | Regional manager RBAC + RLS proširenje | ⬜ | |
| 3d | get_available_rooms() — INT→BIGINT fix za p_adults | ✅ | 2026-06-01 |
| 3d | get_available_rooms() — price_per_night ambiguous column fix | ✅ | 2026-06-01 |
| 3d | get_available_rooms() — koristiti base_price iz room_types (rate_plans join bio broken) | ✅ | 2026-06-01 |
| 3d | rate_plans v2 — room_type_id FK, plan_type, multiplier, applies_from/until | ✅ | 2026-06-01 |
| 3d | rate_plans — price_per_night DROP NOT NULL (seasonal planovi nemaju cijenu) | ✅ | 2026-06-01 |
| 3d | get_available_rooms() v2 — has_packages flag, seasonal multiplier, pkg_summary CTE | ✅ | 2026-06-01 |
| 3d | get_room_packages() RPC — paketi za sobu sa sezonskim multiplikatorom, payment_type | ✅ | 2026-06-01 |
| 3d | BookingPage — inline package picker (step 1: soba, step 1.5: paket, step 2: gost) | ✅ | 2026-06-01 |
| 3d | RatePlansPage v2 — Package vs Seasonal toggle, room_type_id selector, multiplier UI | ✅ | 2026-06-01 |
| 3d | RatePlansPage — validacija preklapanja sezonskih multiplikatora (toast ⚠️) | ✅ | 2026-06-01 |
| 3e | rate_plans.payment_type (online \| on_arrival) | ✅ | 2026-06-01 |
| 3e | create_booking_direct() RPC — direktna rezervacija, dekrement availability | ✅ | 2026-06-01 |
| 3e | BookingPage — pay on arrival flow (skip PayPal, dark button, direktan confirm) | ✅ | 2026-06-01 |
| 3e | guests tabela — name, nationality, document_number, vip_status, last_visit_at | ✅ | 2026-06-01 |
| 3e | guests RLS politike (owner + staff) | ✅ | 2026-06-01 |
| 3e | hotel_reservations.package_name kolona | ✅ | 2026-06-01 |
| 3e | Trigger trg_hotel_reservation_auto_guest — auto-kreira/linkuje gosta na INSERT | ✅ | 2026-06-01 |
| 3e | HotelGuestsPage (/admin/hotel/guests) — kartični prikaz, search, inline edit | ✅ | 2026-06-01 |
| 3e | useGuests hook — search po imenu/emailu, hotel_reservations eager load | ✅ | 2026-06-01 |
| 3e | GuestProfilePage — Hotel tab (boravci: datumi, soba, paket, status, iznos) | ✅ | 2026-06-01 |
| 3e | GuestProfilePage — Spa tab (tretmani: datum, usluga, terapeut, cijena, status) | ✅ | 2026-06-01 |
| 3e | GuestProfilePage — Stats: rest. posjete, hotel boravaka, spa tretmana, ukupno | ✅ | 2026-06-01 |
| 3e | GuestProfilePage — Edit forma: nationality + document_number polja | ✅ | 2026-06-01 |
| 3e | FrontDeskPage — blacklist provjera pri check-inu (window.confirm upozorenje) | ✅ | 2026-06-01 |
| 3e | FrontDeskPage — 👤 profil link uz ime gosta (check-in + check-out) | ✅ | 2026-06-01 |
| fix | ControlPanel — orders.total_amount → orders.total (ispravno ime kolone) | ✅ | 2026-06-01 |
| fix | guests trigger — first_name NOT NULL; split guest_name → first_name/last_name | ✅ | 2026-06-01 |
| fix | guests.last_name DROP NOT NULL | ✅ | 2026-06-01 |
| fix | RoomTypesPage textarea — dodati .input klasu za usklađen stil | ✅ | 2026-06-01 |
| fix | RatePlansPage — toast prikazuje error.message umjesto generic poruke | ✅ | 2026-06-01 |
| fix | RatePlansPage — PAID_PLANS deklarisan prije filtered (bio ReferenceError za 'Plaćeni' filter) | ✅ | 2026-06-02 |
| feat | rate_plan_rooms junction tabela — plan se može ograničiti na specifične sobe (many-to-many) | ✅ | 2026-06-02 |
| feat | get_room_packages() — provjerava dostupnost specificnih soba; plan se ne nudi ako su sve vezane sobe zauzete | ✅ | 2026-06-02 |
| feat | get_room_packages() — vraća payment_type (fix: online vs on_arrival nije radio jer polje nije bilo u return type-u) | ✅ | 2026-06-02 |
| feat | RatePlansPage — room checkbox selector: odabir specificnih soba iz tipa; prikaz linkedovanih soba na kartici | ✅ | 2026-06-02 |
| ux | SuperAdminPanel — responsive tabela (<640px): sakrij Plan/Status/Registrovan, prikaži inline; overflow bug fix | ✅ | 2026-06-02 |
| ux | SuperAdminPanel — sortabilni headeri: Restoran, Plan, Status, Registrovan (useSortable + SortableHead) | ✅ | 2026-06-02 |
| ux | StaffPage (/admin/hr/staff) — responsive tabela (<640px): column-hiding umjesto block-dump; Rola+Na poslu inline | ✅ | 2026-06-02 |
| ux | StaffPage — sortabilni headeri: Zaposlenik, Rola, Status | ✅ | 2026-06-02 |
| ux | InventoryPage — sortabilni headeri na CSS grid layout (Naziv, Kategorija, Količina, Minimum, Cijena/jed.) | ✅ | 2026-06-02 |
| ux | TableMapEditor mobile — jedinstven vertikalni scroler (panel stolova nema vlastiti scroll) | ✅ | 2026-06-02 |
| ux | TableMapEditor mobile — sakrij globus emoji (štedi prostor) | ✅ | 2026-06-02 |
| ux | TableMapEditor mobile — double-tap edit mode: jedan tap = select, dva tapa = drag/resize mode | ✅ | 2026-06-02 |
| ux | TableMapEditor mobile — touch drag po cijelom canvasu sa auto-scroll kad je prst blizu ivice | ✅ | 2026-06-02 |
| ux | TableMapEditor mobile — touch resize handle (28px, narandžast, touchable) | ✅ | 2026-06-02 |
| fix | TableMapEditor — canvasSpacer (1200×800px) aktivan samo na mobilnom; desktop nema horizontalni scroll | ✅ | 2026-06-02 |
| ux | WaiterMapView mobile — card grid + bottom sheet + calling bar + pulse animacija | ✅ | 2026-06-02 |
| ux | GuestProfilePage — Sve tab (unified activity feed: posjete+narudžbe+hotel+spa) | ✅ | 2026-06-02 |
| ux | GuestProfilePage — pill nav + DateNav filtriranje (filterFrom/To/search) na svim tabovima | ✅ | 2026-06-02 |
| ux | GuestProfilePage — restoran narudžbe: ručne posjete + orders iz sistema gdje je guest_id vezan | ✅ | 2026-06-02 |
| ux | GuestPage (/admin/hotel/guests) — sortabilni headeri + responsive column-hiding | ✅ | 2026-06-02 |
| ux | Hotel Rezervacije — kompletni refaktor: Lista + Kalendar u jednoj stranici (toggle u headeru) | ✅ | 2026-06-02 |
| ux | Hotel Kalendar — Dan/Sedmica/Miesec/Period granularnost + Nazad/Danas/Naprijed navigacija | ✅ | 2026-06-02 |
| fix | ReservationForm — auto-dodjela sobe (prvi slobodan u tipu) + filter zauzetih po datumu | ✅ | 2026-06-02 |
| fix | ReservationForm — null→'' za sve select/input/textarea polja (React value warning) | ✅ | 2026-06-02 |
| feat | DateNav — showMonth prop (Miesec dugme + month input) + allowAll prop (Sve dugme) | ✅ | 2026-06-02 |
| feat | DateNav — onSearch default () => {} (sprječava crash bez search prop-a) | ✅ | 2026-06-02 |
| feat | DateNav propagacija — showMonth+allowAll na: FrontDesk, Housekeeping, Kitchen/Bar, SpaDashboard, Appointments, MovementsLog | ✅ | 2026-06-02 |
| feat | TablesReservationsPage — DateNav zamijenio custom date input + "Svi datumi" dugme | ✅ | 2026-06-02 |
| feat | HRReportsPage — DateNav zamijenio period picker (this_week/last_month/...); default tekući mjesec | ✅ | 2026-06-02 |
| feat | useHousekeeping + useSpaAppointments — null-safe datumi (allowAll ne crasha) | ✅ | 2026-06-02 |
| feat | Hotel Rezervacije — "Upit" (inquiry) dodan u STATUS_FILTERS filter bar | ✅ | 2026-06-02 |
| feat | Hotel Rezervacije — STATUS_BADGE: jasne boje po statusu (indigo/zelena/plava/siva/crvena/narandžasta) | ✅ | 2026-06-02 |
| feat | Hotel Rezervacije — badge dark mode: CSS klase u Hotel.module.css sa :global([data-theme*="-dark"]) | ✅ | 2026-06-02 |
| fix | AdminLayout sidebar — "Sajt restorana" path ispravljen na /admin/menu/landing | ✅ | 2026-06-02 |
| fix | App.jsx — dodata ruta /admin/menu/landing → RestaurantLandingEditor | ✅ | 2026-06-02 |
| fix | AnalyticsPage — horizontalni meni (periodi + sekcije) koristi nav.pillBar/pillBtn/pillBtnActive | ✅ | 2026-06-02 |
| fix | StaffPage — create-staff-user 400 greška: proper parsing iz FunctionsHttpError.context.json() | ✅ | 2026-06-02 |
| fix | HousekeepingPage — defaultni filter: zadaci=pending, održavanje=open; "Svi" na kraju | ✅ | 2026-06-02 |

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
│              ✅ Faza 8.5 — Spa & Wellness modul (ZAVRŠENA)
│                            DB shema, FK fix, admin UI, booking, analitika, paketi,
│                            spa_visibility, email podsjetnik (pg_cron)
│
│              ✅ Faza Z — Unified Staff Portal (ZAVRŠENA)
│                            /:slug/staff, 5 role viewova, staff_roles junction,
│                            permissions hotel/spa, role UI tabovi
│
│              ✅ Faza Z.1 — Staff Portal: Platforma za zaposlene (KOMPLETNA)
│                            Faza 1: Home tab, clock in/out, zahtjevi za odsustvo,
│                            admin Odobri/Odbij, badge pending zahtjeva
│                            Faza 2: Profil tab (kontakt+lozinka), staff_announcements
│                            tabela+admin forma+prikaz u portalu
│                            Bonus: Bottom nav (Početna/Posao/Ja), sub-pills
│
│              ✅ Faza 8 dopuna — Guest App spa tab (ZAVRŠENA)
│                            Katalog, termini, folio booking direktno iz /:slug/guest
│
├── Jun        ✅ Rebrand SmartMeni → rest.by.me (Landing, logotip, domen)
│              ✅ Faza R — Bar modul (is_bar, kitchen_status/bar_status, Bar tab)
│              ✅ Dark mode & CSS varijable fiksovi (KitchenDashboard, WaiterDashboard)
│
│              ✅ Faza Y.3 — Visual Page Editor (hotel + restoran) (ZAVRŠENA)
│                            Live preview iframe, device toggle, DnD reorder,
│                            layout varijante, novi blokovi (reviews/video/cta/faq/specials),
│                            shared komponente (LandingEditor.module.css)
│
│              ✅ Performance optimizacije
│                            PlatformContext Promise.all (eliminisan login waterfall),
│                            AdminLayout lazy import, useKitchenCounts conditional,
│                            subscription select sužen, storageImg utility
│
│              ✅ Housekeeping & Maintenance workflow fiksovi
│                            Verifikacija čišćenja → soba 'available' automatski
│                            Maintenance 4-step workflow (open→in_progress→done→verified)
│                            Prijava popravke → soba 'maintenance', verifikacija → 'available'
│                            FrontDesk period navigacija (Juče/Danas/Sutra/Period)
│                            Preview scroll fix (RestaurantLandingEditor)
│
│              ✅ Faza 3d/3e — Booking Engine v2 + Guest CRM
│                            Rate Plans v2 (Package/Seasonal, room_type_id, multiplikator)
│                            BookingPage: inline package picker, soba→paket→gost→plaćanje
│                            Pay on Arrival: create_booking_direct RPC, skip PayPal
│                            guests tabela proširena (nationality, doc, vip_status)
│                            Auto-create guest trigger na hotel_reservations
│                            HotelGuestsPage + unified GuestProfilePage (Hotel + Spa tabovi)
│                            FrontDesk: blacklist warning + 👤 guest profile link
│
│              ✅ Rate Plan Rooms — plan vezan za specifične sobe
│                            rate_plan_rooms junction tabela, UI u RatePlansPage,
│                            get_room_packages() provjerava datumsku dostupnost sobe,
│                            payment_type bug fix (online vs on_arrival)
│
│              ✅ UX / Responsive poboljšanja
│                            SuperAdminPanel: responsive + sortabilni headeri + overflow fix
│                            StaffPage: column-hiding responsive + sortabilni headeri
│                            InventoryPage: sortabilni headeri (CSS grid)
│                            TableMapEditor mobile: double-tap edit mode, touch drag,
│                            auto-scroll, canvas spacer samo na mobilnom
│
│              ✅ Hotel Rezervacije UI refaktor + DateNav sistem
│                            Nova lista+kalendar arhitektura (Dan/Sedmica/Miesec/Period),
│                            ReservationForm auto-dodjela sobe, status badge boje + dark mode,
│                            DateNav showMonth+allowAll propagiran na 8 stranica,
│                            sidebar fix, analytics pill nav, HR reports DateNav
│
│              ✅ Guest Profile Pro + WaiterMapView Mobile
│                            Sve tab (unified activity feed), DateNav filtriranje,
│                            restoran narudžbe u profilu, responsive + sortabilni headeri,
│                            WaiterMapView: card grid + bottom sheet + calling bar
│
│              ✅ RESEND_API_KEY regenerisan (2026-06-04)
│              ✅ SITE_URL env var postavljen (2026-06-02)
│              ✅ Faza Z.1 kompletna — profil, obavijesti, bottom nav (2026-06-04)
│              ✅ HR Reports + Raspored responsive (2026-06-04)
│
│              ← OVDJE SMO (2026-06-04)
│
├── Jun–Jul    🔴 Faza PAY — Multi-provider plaćanja (Stripe + Monri)
│                            Provider abstrakcija, per-tenant config, hosted-redirect,
│                            normalizovan webhook; Stripe (svijet) + Monri (CG/region)
│              🔄 Faza 3d — booking plaćanje kroz Faza PAY apstrakciju
│                            Checkout session, webhook, email potvrda
│
│              ⬜ Faza N  — Nocni audit + Split folio + Doručak kontrola
│                            EOD automatizacija, room charge na folije, split billing
│
│              ⬜ GDPR    — Compliance UI (anonimizacija, export, privole)
│
├── Jul        🔄 Faza 1d — addon purchase kroz Faza PAY apstrakciju (naš Stripe/PayPal nalog)
│
│              ⬜ Faza P  — PMS proširenja (Room service, Minibar, Grupne rezervacije)
│
│              ⬜ Inventory Pro v2 — Dobavljači, PO, Inventura
│
├── Sep+       ⬜ Faza M  — MICE addon (Sale, eventi, BEO, korporativni klijenti)
│
│              ⬜ Faza 8.6 — Marketing automation addon
│                            Pre-arrival, post-stay, birthday, re-engagement emailovi
│
│              ⬜ Faza 6  — Channel Manager (Beds24 integracija)
│
2027
│
├── Q1         ⬜ Faza 7  — Mobilna aplikacija (React Native / Expo)
│                            V1: Konobar, Kuhinja (Unified Staff Portal pokriva web verziju)
│
├── Q2         ⬜ Faza 8  — Loyalty program + Guest App addon
│
├── Q3–Q4      ⬜ Faza 9  — Portfolio Owner Dashboard
│                            portfolios tabele, KPI aggregacija, alert sistem
│
└── Q4         ⬜ Faza 10 — Brand & Regional Management
                             brand šabloni, RBAC hijerarhija pristupa

2028
│
│              ⬜ Faza Z.2 — HR Pro proširenja (Obuke, Performanse, Dokumenti)
│
└── TBD        ⬜ Faza Y.2 — Custom domain podrška (Vercel API, po potražnji)
```

---

*Roadmap ažuriran: 2026-06-04 (v4.9 — Faza Z.1 kompletna: profil tab, staff_announcements, bottom nav reorganizacija (Početna/Posao/Ja); HR Reports + Raspored responsive; v4.8 — Faza Z.1 Faza 1 završena; v4.7 — Arhitektura plaćanja, Faza PAY PAY-1…PAY-13) | Branch: main | Deployment: Vercel auto-deploy*
