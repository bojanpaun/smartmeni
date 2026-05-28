# HospitalityOS — Master Razvojni Roadmap

> **Verzija:** 1.0 — Master (spoj SmartMeni plana + Hotel roadmapa)
> **Datum:** Maj 2026
> **Stack:** React 18 + Vite + Supabase + PostgreSQL + React Native (Expo)
> **Tim:** 2 developera, produkt-fokus, monetizacija u drugoj fazi
> **Obuhvat:** Od stabilizacije postojeće aplikacije do pune hospitality platforme sa portfolio upravljanjem

---

## Kako koristiti ovaj dokument

Ovaj master roadmap pokriva **cijeli razvojni put** — od tekućih popravki SmartMeni aplikacije do izgradnje pune hotelske SaaS platforme sa mobilnom aplikacijom i portfolio upravljanjem za vlasnike više objekata.

Svaka faza ima:
- Jasan preduslov i procjenu trajanja
- Konkretne CLI komande za terminal
- Definiciju završenosti (Definition of Done)
- Checkbox stavke za dnevnik napretka

```
ETAPA A: Stabilizacija SmartMenija    (Faze 1–4)     ← Radimo sada
ETAPA B: Hotelska platforma           (Faze 5–12)    ← Nakon stabilizacije
ETAPA C: Portfolio & mobilna app      (Faze 13–15)   ← Dugoročno
```

---

# SmartMeni → HospitalityOS — Produkt roadmap

> **Verzija:** 1.1 *(dopunjeno — Portfolio Owner & Multi-Property)*  
> **Datum:** Maj 2026  
> **Kontekst:** Evolucija SmartMeni SaaS platforme prema punom hospitality management sistemu  
> **Tim:** 2+ developera, produkt-fokus, monetizacija u drugoj fazi  
> **Pretpostavka:** Postojeći SmartMeni plan je završen i aplikacija je stabilna

---

## Vizija proizvoda

SmartMeni počinje kao restoran SaaS. Krajnji cilj je **jedinstvena platforma** koja pokreće cijelo ugostiteljstvo — od restorana do hotela, hostelova, apartmana i resort kompleksa — sa jednim login-om, jednom bazom gostiju, i modulima koji se naplaćuju po potrebi.

Svaki hotel / restoran je **tenant** na platformi. Vlasnik se pretplaćuje na **osnovu + addons**. Tim jedne nekretnine vidi samo svoje podatke. Superadmin vidi sve.

### Portfolio Owner profil

Kljucni tip korisnika koji zahtijeva posebnu arhitekturu je **vlasnik portfelja** — osoba ili kompanija koja posjeduje vise ugostiteljeskih objekata na razlicitim lokacijama i/ili drzavama, s mjesovidnim brandovima.

Ovaj profil zahtijeva:
- **Jedan nalog** koji agregira sve objekte bez obzira na brand ili lokaciju
- **Portfolio dashboard** — komandna tabla sa KPI-evima svih objekata u realnom vremenu
- **Drill-down** — mogucnost prelaska iz portfolio pregleda u detaljan prikaz bilo kojeg objekta jednim klikom
- **Komparativna analitika** — poredenje performansi izmedju objekata, regija i brandova
- **Hijerarhija pristupa** — vlasnik vidi sve, regionalni menadzder vidi svoju grupu, menadzder objekta vidi samo vlastiti objekat
- **Konsolidovani finansijski izvjestaji** — prihodi, troskovi i marze agregirani na nivou portfelja, branda ili regije
- **Centralizovano upravljanje** — sabloni menija, HR politike, cjenovni okviri koji se primjenjuju na vise objekata odjednom

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

### Addon moduli — godišnja pretplata po modulu

| Modul | Opis | Ciljni segment |
|-------|------|----------------|
| `inventory_pro` | Puno upravljanje zalihama, recepti, FIFO | Restorani, hoteli |
| `hr_pro` | Payroll, prisustvo, napredni rasporedi | Hoteli, veći restorani |
| `analytics_pro` | Napredni izvještaji, export, prognoza | Svi |
| `hotel_core` | Sobe, rezervacije, front desk, folio | Hoteli |
| `booking_engine` | Online booking sa vlastite web stranice | Hoteli |
| `channel_manager` | Sync sa Booking.com, Airbnb, Expedia | Hoteli (premium) |
| `housekeeping` | Housekeeping dashboard, taskovi, maintenance | Hoteli |
| `revenue_mgmt` | Dinamičke cijene, yield management, RevPAR | Hoteli (premium) |
| `spa_wellness` | Booking spa tretmana, kapaciteta | Resorts, wellness hoteli |
| `loyalty` | Loyalty program, bodovi, nagrade | Hoteli, lanci |
| `guest_app` | White-label PWA/app za goste hotela | Hoteli |
| `multi_property` | Upravljanje više nekretnina jednim nalogom | Lanci, investitori |
| `portfolio_owner` | Portfolio dashboard, komparativna analitika, konsolidovani izvjestaji | Vlasnici portfelja |
| `brand_mgmt` | Upravljanje vise brandova, centralizovani sabloni menija i HR politika | Lanci, mjesoviti portfelji |
| `regional_mgmt` | Hijerarhija pristupa: vlasnik → regionalni menadzder → menadzder objekta | Portfelji sa 5+ objekata |

### Cjenovni principi
- Osnova: fiksna niska cijena (npr. 29–49€/mj) — barrier to entry nizak
- Svaki addon: 99–299€/godišnje zavisno od kompleksnosti
- `channel_manager` i `revenue_mgmt`: premium tier (500–999€/god) zbog kompleksnosti integracija
- `multi_property`: per-property pricing sa volume discountom
- **Trial 14 dana** na svakom novom addontu (već implementirano za base plan)

---

---

## Pregled svih faza

| Faza | Naziv | Etapa | Prioritet | Procjena |
|------|-------|-------|-----------|----------|
| 1 | Sigurnost i stabilnost | A | 🔴 Kritično | 1–2 dana |
| 2 | Robusnost koda | A | 🟡 Visok | 3–5 dana |
| 3 | Performanse i UX | A | 🟢 Srednji | 3–4 dana |
| 3.5 | Optimizacija | A | 🟢 Srednji | 2–3 dana |
| 4 | Post-launch | A | 🔵 Nice to have | Po potrebi |
| 5 | Billing infrastruktura | B | 🔴 Kritično za B | 6–8 sedmica |
| 6 | Hotel Core modul | B | 🟡 Visok | 10–14 sedmica |
| 7 | Booking Engine | B | 🟡 Visok | 6–8 sedmica |
| 8 | Housekeeping modul | B | 🟢 Srednji | 3–4 sedmice |
| 9 | Revenue Management | B | 🟢 Srednji | 6–8 sedmica |
| 10 | Channel Manager | B | 🔵 Premium | 12–16 sedmica |
| 11 | Loyalty + Guest App | B | 🔵 Nice to have | 8–10 sedmica |
| 12 | Mobilna aplikacija | B | 🟡 Visok | 16–24 sedmice |
| 13 | Portfolio Owner modul | C | 🟡 Visok | 8–10 sedmica |
| 14 | Brand & Regional Mgmt | C | 🟢 Srednji | 6–8 sedmica |

---

## ═══ ETAPA A — Stabilizacija SmartMenija ═══

> **Cilj:** Siguran, stabilan, performantan restoran SaaS spreman za prve plaćajuće korisnike.
> Sve faze u Etapi A se rade unutar postojeće SmartMeni aplikacije, CLI-first workflow.

---

## Faza 1 — Sigurnost i stabilnost

### 1.1 `.env` i git historija audit

**Problem:** `.env` fajl sa Supabase keyevima bio je vidljiv u ZIP arhivi. Ako je ikad commitovan u git, key je izložen u historiji.

**Koraci:**

```bash
# 1. Provjeri da li je .env u git historiji
cd smartmeni
git log --all --full-history -- .env

# 2. Provjeri sadržaj .gitignore
cat .gitignore | grep env

# 3. Ako .env nije u .gitignore, dodaj ga
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.*.local" >> .gitignore

# 4. Ako je .env bio commitovan — ukloni ga iz historije
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 5. Force push (pazi ako imaš remote)
git push origin --force --all
```

**Nakon toga:**
- Idi na [Supabase Dashboard → Settings → API](https://supabase.com/dashboard)
- Klikni **"Regenerate"** na `anon` keyu
- Ažuriraj `.env` sa novim keyem
- Napravi `.env.example` bez pravih vrijednosti:

```bash
# Napravi template za ostale developere
cat > .env.example << 'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_publishable_anon_key_here
EOF
git add .env.example
git commit -m "chore: add .env.example template"
```

**Definition of Done:**
- [ ] `.env` je u `.gitignore`
- [ ] `.env.example` postoji u repozitoriju
- [ ] Supabase anon key je regenerisan
- [ ] `service_role_key` se ne pojavljuje ni u jednom `.jsx` / `.js` fajlu

---

### 1.2 Sortiranje i konsolidacija migracija

**Problem:** 18 SQL fajlova bez numerisanog redosljeda. Svaki novi developer (ili novi deployment) ne zna kojim redosljedom ih pokrenuti.

**Koraci:**

```bash
# 1. Pregledaj sve migracije
ls -1 smartmeni/migration*.sql smartmeni/1_migration*.sql 2>/dev/null | sort

# 2. Napravi migrations/ direktorijum
mkdir -p smartmeni/migrations

# 3. Ručno preimeniraj fajlove po logičnom redosljdu
# (Redosljed ispod je ispravan — od osnove prema zavisnostima)
cd smartmeni

mv migration_add_logo.sql              migrations/001_add_logo.sql
mv migration_add_template.sql          migrations/002_add_template.sql
mv migration_add_onboarding.sql        migrations/003_add_onboarding.sql
mv migration_add_billing.sql           migrations/004_add_billing.sql
mv migration_restaurant_settings.sql   migrations/005_restaurant_settings.sql
mv migration_restaurant_columns.sql    migrations/006_restaurant_columns.sql
mv migration_tables_map.sql            migrations/007_tables_map.sql
mv migration_reservations.sql          migrations/008_reservations.sql
mv migration_inventory.sql             migrations/009_inventory.sql
mv migration_staff_auto_link.sql       migrations/010_staff_auto_link.sql
mv migration_user_profiles.sql         migrations/011_user_profiles.sql
mv migration_staff_profile.sql         migrations/012_staff_profile.sql
mv migration_staff_wages.sql           migrations/013_staff_wages.sql
mv migration_staff_wages_1.sql         migrations/014_staff_wages_fix.sql
mv migration_attendance_entries.sql    migrations/015_attendance_entries.sql
mv migration_multiple_shifts.sql       migrations/016_multiple_shifts.sql
mv migration_guests_module.sql         migrations/017_guests_module.sql
mv migration_guest_registration.sql    migrations/018_guest_registration.sql
mv migration_orders_rls.sql            migrations/019_orders_rls.sql
mv migration_order_tracker.sql         migrations/020_order_tracker.sql
mv migration_waiter_toggle.sql         migrations/021_waiter_toggle.sql
mv migration_waiter_messages.sql       migrations/022_waiter_messages.sql
mv migration_messages_config.sql       migrations/023_messages_config.sql
mv migration_menu_visibility.sql       migrations/024_menu_visibility.sql
mv migration_qr_session.sql            migrations/025_qr_session.sql
mv migration_auto_suspend.sql          migrations/026_auto_suspend.sql
mv migration_cron_email.sql            migrations/027_cron_email.sql
mv 1_migration_add_complimentary.sql   migrations/028_add_complimentary.sql
mv migration_orders_rls.sql            migrations/029_orders_rls_update.sql 2>/dev/null || true
```

```bash
# 4. Napravi MASTER_MIGRATION.sql koji ih sve poziva u redu
cat > migrations/MASTER_MIGRATION.sql << 'EOF'
-- ============================================================
-- SmartMeni — Master migracija
-- Pokrenuti jednom na čistoj Supabase instanci
-- Redosljed je bitan — ne mijenjati bez razloga
-- ============================================================

\i 001_add_logo.sql
\i 002_add_template.sql
\i 003_add_onboarding.sql
\i 004_add_billing.sql
\i 005_restaurant_settings.sql
\i 006_restaurant_columns.sql
\i 007_tables_map.sql
\i 008_reservations.sql
\i 009_inventory.sql
\i 010_staff_auto_link.sql
\i 011_user_profiles.sql
\i 012_staff_profile.sql
\i 013_staff_wages.sql
\i 014_staff_wages_fix.sql
\i 015_attendance_entries.sql
\i 016_multiple_shifts.sql
\i 017_guests_module.sql
\i 018_guest_registration.sql
\i 019_orders_rls.sql
\i 020_order_tracker.sql
\i 021_waiter_toggle.sql
\i 022_waiter_messages.sql
\i 023_messages_config.sql
\i 024_menu_visibility.sql
\i 025_qr_session.sql
\i 026_auto_suspend.sql
\i 027_cron_email.sql
\i 028_add_complimentary.sql
EOF

git add migrations/
git commit -m "chore: organize migrations into numbered sequence"
```

**Definition of Done:**
- [ ] Svi migration fajlovi su u `migrations/` sa numerisanim prefiksom
- [ ] `MASTER_MIGRATION.sql` postoji i pokriva sve fajlove
- [ ] Originalni fajlovi u rootu su obrisani

---

### 1.3 RLS audit — svaka tabela

**Problem:** Multi-tenant SaaS sistem gdje jedan loš RLS policy = curenje podataka svih restorana.

**Kako provjeriti u terminalu:**

```bash
# Instaliraj Supabase CLI ako ga nemaš
npm install -g supabase

# Prijavi se
supabase login

# Povuci trenutne politike (ako imaš linked projekat)
supabase db dump --schema public > db_schema_dump.sql
grep -A 10 "POLICY" db_schema_dump.sql
```

**Tabele koje MORAJU imati RLS — checklist:**

Za svaku tabelu ispod, otvori Supabase Dashboard → Table Editor → klikni tabelu → kartica "Policies" i provjeri sljedeće:

```
✅ restaurants
   SELECT: user_id = auth.uid() OR staff member of restaurant
   INSERT: auth.uid() IS NOT NULL
   UPDATE: user_id = auth.uid()
   DELETE: user_id = auth.uid()

✅ orders
   SELECT: restaurant_id IN (moji restorani) OR guest_token match
   INSERT: anonimni korisnici MOGU (za guest ordering)
   UPDATE: osoblje restorana MOŽE (status promjena)

✅ guests  
   SELECT: restaurant_id IN (moji restorani)
   INSERT: anonimni MOGU (registracija) + provjeri guest_registration_enabled
   UPDATE: sam gost ili osoblje restorana

✅ staff
   SELECT: restaurant_id IN (moji restorani)
   INSERT: vlasnik restorana
   UPDATE: vlasnik restorana ili sam zaposlenik (vlastiti profil)

✅ inventory_items
   SELECT: restaurant_id IN (moji restorani)
   INSERT/UPDATE/DELETE: osoblje sa edit_inventory permisijom

✅ reservations
   SELECT: restaurant_id IN (moji restorani) OR javna forma
   INSERT: anonimni MOGU za online rezervaciju
```

**SQL template za provjeru (pokreni u Supabase SQL Editor):**

```sql
-- Provjeri koje tabele imaju RLS omogućen
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Provjeri sve postojeće politike
SELECT 
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

**Definition of Done:**
- [ ] Sve tabele imaju `rowsecurity = true`
- [ ] Svaka tabela ima minimum SELECT policy sa `restaurant_id` filtrom
- [ ] `orders` INSERT dozvoljava anonimne korisnike
- [ ] Nijedna tabela ne vraća podatke drugog restorana pri testiranju sa različitim auth tokenima

---

## Faza 2 — Robusnost koda

### 2.1 Globalni error handling pattern

**Problem:** Supabase pozivi bez konzistentnog error handlinga = tihe greške, prazni ekrani.

**Napravi utility fajl:**

```bash
# Napravi fajl
touch src/lib/handleError.js
```

Sadržaj `src/lib/handleError.js`:

```js
/**
 * Centralni error handler za Supabase pozive.
 * Koristiti u svim komponentama umjesto ad-hoc console.error.
 */

export function handleSupabaseError(error, context = '') {
  if (!error) return;
  
  const message = error.message || 'Nepoznata greška';
  const code = error.code || '';
  
  // Log sa kontekstom za debugging
  console.error(`[SmartMeni Error] ${context}:`, { message, code, error });
  
  // User-friendly poruke za česte greške
  if (code === 'PGRST116') return 'Stavka nije pronađena.';
  if (code === '23505') return 'Ovaj zapis već postoji.';
  if (code === '42501') return 'Nemate dozvolu za ovu akciju.';
  if (message.includes('JWT')) return 'Sesija je istekla. Prijavite se ponovo.';
  if (message.includes('network')) return 'Greška mreže. Provjerite internet vezu.';
  
  return message;
}

/**
 * Wrapper za Supabase query sa automatskim error handlingom.
 * 
 * Primjer korišćenja:
 *   const { data, error, userMessage } = await safeQuery(
 *     supabase.from('orders').select('*'),
 *     'učitavanje narudžbi'
 *   );
 */
export async function safeQuery(queryPromise, context = '') {
  try {
    const result = await queryPromise;
    const userMessage = result.error 
      ? handleSupabaseError(result.error, context) 
      : null;
    return { ...result, userMessage };
  } catch (err) {
    handleSupabaseError(err, context);
    return { data: null, error: err, userMessage: 'Greška pri komunikaciji sa serverom.' };
  }
}
```

**Kako koristiti u komponentama:**

```jsx
// Prije (bez error handlinga)
const { data } = await supabase.from('orders').select('*')
setOrders(data)

// Poslije
import { safeQuery } from '../../../lib/handleError'

const { data, userMessage } = await safeQuery(
  supabase.from('orders').select('*').eq('restaurant_id', restaurant.id),
  'učitavanje narudžbi'
);
if (userMessage) { setError(userMessage); return; }
setOrders(data ?? []);
```

**Definition of Done:**
- [ ] `src/lib/handleError.js` postoji
- [ ] Svi Supabase pozivi u kritičnim modulima (orders, guests, staff) koriste `safeQuery`
- [ ] Nijedan modul ne prikazuje `undefined` ili `null` korisniku pri grešci

---

### 2.2 Toast notifikacije

**Instalacija:**

```bash
cd smartmeni
npm install react-hot-toast
```

**Dodaj u `main.jsx`:**

```jsx
import { Toaster } from 'react-hot-toast'

root.render(
  <BrowserRouter>
    <App />
    <Toaster 
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
        },
        success: { iconTheme: { primary: '#1D9E75', secondary: '#fff' } },
        error: { duration: 5000 },
      }}
    />
  </BrowserRouter>
)
```

**Primjeri korišćenja:**

```jsx
import toast from 'react-hot-toast'

// Nakon uspješne akcije
toast.success('Narudžba kreirana!')

// Nakon greške
toast.error('Greška pri čuvanju. Pokušajte ponovo.')

// Loading state
const toastId = toast.loading('Čuvanje...')
// ... operacija ...
toast.success('Sačuvano!', { id: toastId })
```

**Definition of Done:**
- [ ] `react-hot-toast` instaliran
- [ ] `<Toaster />` dodan u `main.jsx`
- [ ] Svaka destruktivna akcija (brisanje, kreiranje, ažuriranje) prikazuje toast

---

### 2.3 Loading spinner komponent

```bash
mkdir -p src/components/shared
touch src/components/shared/LoadingSpinner.jsx
touch src/components/shared/LoadingSpinner.module.css
```

Sadržaj `LoadingSpinner.jsx`:

```jsx
import styles from './LoadingSpinner.module.css'

export default function LoadingSpinner({ text = 'Učitavanje...', fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className={styles.fullScreen}>
        <div className={styles.spinner} />
        <p className={styles.text}>{text}</p>
      </div>
    )
  }
  return (
    <div className={styles.inline}>
      <div className={styles.spinner} />
      {text && <span className={styles.text}>{text}</span>}
    </div>
  )
}
```

Sadržaj `LoadingSpinner.module.css`:

```css
.fullScreen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 12px;
}

.inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  justify-content: center;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e5e7eb;
  border-top-color: #1D9E75;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.text {
  font-size: 14px;
  color: #6b7280;
  font-family: 'DM Sans', sans-serif;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Definition of Done:**
- [ ] `LoadingSpinner` komponent postoji u `shared/`
- [ ] Svi moduli koriste isti komponent umjesto ad-hoc loading rješenja
- [ ] `PlatformContext` loading state koristi `LoadingSpinner fullScreen`

---

### 2.4 Custom hook `useSupabaseQuery`

```bash
touch src/hooks/useSupabaseQuery.js
```

Sadržaj:

```js
import { useState, useEffect, useCallback } from 'react'
import { safeQuery } from '../lib/handleError'

/**
 * Hook za Supabase upite sa automatskim loading/error stanjem.
 *
 * Primjer:
 *   const { data: orders, loading, error, refetch } = useSupabaseQuery(
 *     () => supabase.from('orders').select('*').eq('restaurant_id', id),
 *     [id],  // dependencies — refetch kad se id promijeni
 *     'učitavanje narudžbi'
 *   );
 */
export function useSupabaseQuery(queryFn, deps = [], context = '') {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: result, userMessage } = await safeQuery(queryFn(), context)
    if (userMessage) {
      setError(userMessage)
    } else {
      setData(result ?? [])
    }
    setLoading(false)
  }, deps) // eslint-disable-line

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}
```

**Definition of Done:**
- [ ] Hook postoji u `src/hooks/`
- [ ] Korišten u minimum 3 modula kao zamjena za repetitivni fetch kod

---

## Faza 3 — Performanse i UX

### 3.1 Code splitting po rutama

**Problem:** Svi moduli su u jednom bundle-u (~690KB minified). Konobar učitava HR i inventory kod koji mu ne treba.

**Izmjena u `App.jsx`:**

```bash
# Backup originalnog App.jsx
cp src/App.jsx src/App.jsx.backup
```

```jsx
// Na vrhu App.jsx — zamijeni statične importe sa lazy
import { lazy, Suspense } from 'react'
import LoadingSpinner from './components/shared/LoadingSpinner'

// Statično ostavljamo samo kritične rute
import Landing from './platform/Landing'
import Login from './platform/auth/Login'
import Register from './platform/auth/Register'
import GuestMenu from './layouts/GuestMenu'

// Sve admin rute — lazy load
const AdminMenu = lazy(() => import('./modules/menu/pages/AdminMenu'))
const WaiterDashboard = lazy(() => import('./modules/menu/pages/WaiterDashboard'))
const KitchenDashboard = lazy(() => import('./modules/menu/pages/KitchenDashboard'))
const InventoryPage = lazy(() => import('./modules/inventory/pages/InventoryPage'))
const MovementsLog = lazy(() => import('./modules/inventory/pages/MovementsLog'))
const IngredientsEditor = lazy(() => import('./modules/inventory/pages/IngredientsEditor'))
const InventoryAnalytics = lazy(() => import('./modules/inventory/pages/InventoryAnalytics'))
const StaffPage = lazy(() => import('./modules/hr/pages/StaffPage'))
const SchedulePage = lazy(() => import('./modules/hr/pages/SchedulePage'))
const AttendancePage = lazy(() => import('./modules/hr/pages/AttendancePage'))
const PayrollPage = lazy(() => import('./modules/hr/pages/PayrollPage'))
const HRReportsPage = lazy(() => import('./modules/hr/pages/HRReportsPage'))
const AnalyticsPage = lazy(() => import('./modules/analytics/pages/AnalyticsPage'))
const GuestsPage = lazy(() => import('./modules/guests/pages/GuestsPage'))
const BillingPage = lazy(() => import('./modules/menu/pages/BillingPage'))
const SuperAdminPanel = lazy(() => import('./platform/superadmin/SuperAdminPanel'))
// ... ostali lazy importi

// Wrapper za admin rute sa Suspense
function AdminRoute({ children }) {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingSpinner text="Učitavanje modula..." />}>
          {children}
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  )
}
```

**Provjeri rezultat:**

```bash
npm run build
# Pogledaj output — trebalo bi biti mnogo više manjih chunk fajlova
# umjesto jednog velikog index-*.js
```

**Definition of Done:**
- [ ] `npm run build` generira više chunk fajlova (jedan po modulu)
- [ ] Ukupni initial bundle je ispod 200KB (bez vendor libs)
- [ ] Lazy loading radi — moduli se učitavaju pri prvoj posjeti rute

---

### 3.2 Realtime cleanup audit

**Problem:** Supabase Realtime subscriptions koje se ne unsubscribuju = memory leakovi.

```bash
# Pronađi sve fajlove koji koriste supabase.channel ili .on(
grep -r "supabase.channel\|\.on(" src/ --include="*.jsx" -l
```

Za svaki pronađeni fajl, provjeri da li `useEffect` ima return cleanup:

```jsx
// ❌ Bez cleanupa — memory leak
useEffect(() => {
  const channel = supabase
    .channel('orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleChange)
    .subscribe()
}, [])

// ✅ Sa cleanupom — ispravno
useEffect(() => {
  const channel = supabase
    .channel('orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, handleChange)
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

**Definition of Done:**
- [ ] Svaki `supabase.channel()` poziv ima odgovarajući `supabase.removeChannel()` u cleanup funkciji

---

### 3.3 Forma validacija

**Instaliraj validator:**

```bash
npm install react-hook-form
```

**Primjer primjene na formi rezervacije:**

```jsx
import { useForm } from 'react-hook-form'

export default function OnlineReservationForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  const onSubmit = async (data) => {
    // data je već validiran
    const { userMessage } = await safeQuery(
      supabase.from('reservations').insert(data),
      'kreiranje rezervacije'
    )
    if (userMessage) { toast.error(userMessage); return; }
    toast.success('Rezervacija je uspješno kreirana!')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input 
        {...register('guest_name', { required: 'Ime je obavezno', minLength: { value: 2, message: 'Ime mora imati najmanje 2 znaka' } })}
        placeholder="Vaše ime"
      />
      {errors.guest_name && <span className={styles.error}>{errors.guest_name.message}</span>}
      
      <input 
        {...register('guest_phone', { pattern: { value: /^[0-9+\s()-]{8,15}$/, message: 'Unesite ispravan broj telefona' } })}
        placeholder="Broj telefona"
      />
      {errors.guest_phone && <span className={styles.error}>{errors.guest_phone.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Slanje...' : 'Potvrdi rezervaciju'}
      </button>
    </form>
  )
}
```

**Prioritet forme za validaciju (opadajući):**
1. `OnlineReservationForm` — javna, anonimni korisnici
2. `Register` i `Login` — auth forme
3. `GuestRegisterPage` — javna registracija
4. `StaffPage` — dodavanje osoblja

**Definition of Done:**
- [ ] `react-hook-form` instaliran
- [ ] Minimum 4 javne forme koriste `react-hook-form`
- [ ] Svako polje prikazuje inline grešku ispod inputa
- [ ] Submit button je disabled dok forma nije validna

---

### 3.4 Onboarding flow end-to-end test

Prođi cijeli flow od nule i zabilježi sve probleme:

```bash
# Pokreni dev server
npm run dev

# Otvori novi incognito prozor i prođi ovim redosljedom:
```

**Checklist toka:**

```
Registracija
  [ ] /registracija — forma se prikazuje ispravno
  [ ] Submit bez podataka — validacija radi
  [ ] Email koji već postoji — prikazuje grešku
  [ ] Uspješna registracija — redirect na onboarding

Onboarding
  [ ] OnboardingWizard se prikazuje novom korisniku
  [ ] Svaki korak je jasan (ime restorana, slug, kategorija)
  [ ] Slug koji već postoji — prikazuje grešku
  [ ] Završetak — redirect na /admin

Admin dashboard
  [ ] ControlPanel se učitava bez grešaka u konzoli
  [ ] Trial banner je vidljiv
  [ ] Navigacija do svih modula radi

Digitalni meni
  [ ] /admin/menu — lista kategorija i stavki
  [ ] Dodavanje kategorije — radi
  [ ] Dodavanje stavke — radi
  [ ] /:slug — guest meni prikazuje dodane stavke

QR kod
  [ ] /admin/menu/qr — QR kod se generiše
  [ ] Skeniranje QR koda otvara /:slug

Narudžba (kao gost)
  [ ] Dodavanje u korpu — radi
  [ ] Slanje narudžbe — radi
  [ ] Order tracker — prikazuje status
  [ ] Waiter dashboard — nova narudžba se pojavljuje u realtimu
```

**Definition of Done:**
- [ ] Cijeli flow je prođen bez grešaka u browser konzoli
- [ ] Svi pronađeni bugovi su zabilježeni kao TODO komentari ili GitHub issues

---

## Faza 3.5 — Optimizacija

### 3.5.1 Memoizacija komponenti — React.memo, useMemo, useCallback

**Problem:** Waiter i kitchen dashboard primaju Realtime podatke koji triggeruju re-render cijelog stabla komponenti. Bez memoizacije, svaka nova narudžba re-renderuje listu, filter, header i sidebar odjednom.

**Gdje primijeniti (opadajući prioritet):**

```bash
# Pronađi komponente koje renderuju liste narudžbi
grep -rn "orders\.map\|items\.map\|staff\.map" src/ --include="*.jsx" -l
```

**Pattern za liste koje se često ažuriraju:**

```jsx
// WaiterDashboard.jsx — primjer optimizacije

import { memo, useMemo, useCallback } from 'react'

// 1. Memoizuj stavku liste — ne re-renderuje ako se props nisu promijenili
const OrderCard = memo(function OrderCard({ order, onStatusChange }) {
  return (
    <div>
      <h3>{order.table_number}</h3>
      <button onClick={() => onStatusChange(order.id, 'ready')}>Gotovo</button>
    </div>
  )
})

// 2. U parent komponenti — stabilan callback koji ne mijenja referencu
export default function WaiterDashboard() {
  const [orders, setOrders] = useState([])

  // useCallback — ista referenca funkcije između rendera
  const handleStatusChange = useCallback(async (orderId, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
  }, []) // prazne deps — funkcija se ne mijenja

  // useMemo — skupo filtriranje se ne ponavlja pri svakom renderu
  const pendingOrders = useMemo(
    () => orders.filter(o => o.status === 'pending'),
    [orders] // recalculate samo kad se orders promijeni
  )

  const readyOrders = useMemo(
    () => orders.filter(o => o.status === 'ready'),
    [orders]
  )

  return (
    <>
      {pendingOrders.map(order => (
        <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
      ))}
    </>
  )
}
```

**Gdje NE koristiti memoizaciju:**
- Komponente koje se rijetko renderuju (settings stranice, onboarding)
- Primitive vrijednosti (strings, numbers) — `useMemo` za `const x = a + b` je overhead, ne optimizacija
- Kratke liste ispod 20 stavki sa jednostavnim renderom

**Definition of Done:**
- [ ] `WaiterDashboard` i `KitchenDashboard` koriste `memo` za card komponente
- [ ] Filter/sort logika u listama je u `useMemo`
- [ ] Event handleri koji se prosljeđuju child komponentama su u `useCallback`

---

### 3.5.2 Debouncing na search inputima

**Problem:** Svaki pritisak tipke na search/filter polju triggeru Supabase query. Na sporijoj konekciji to znači deseci nepotrebnih HTTP poziva.

```bash
# Pronađi search inpute u projektu
grep -rn "onChange\|setSearch\|setFilter" src/ --include="*.jsx" -l
```

**Napravi `useDebounce` hook:**

```bash
touch src/hooks/useDebounce.js
```

```js
// src/hooks/useDebounce.js
import { useState, useEffect } from 'react'

/**
 * Odgađa ažuriranje vrijednosti za `delay` milisekundi.
 * Koristiti za search inpute — query se šalje tek kad korisnik
 * prestane tipkati.
 *
 * Primjer:
 *   const debouncedSearch = useDebounce(searchTerm, 400)
 *   useEffect(() => { fetchResults(debouncedSearch) }, [debouncedSearch])
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

**Primjer primjene u GuestsPage ili InventoryPage:**

```jsx
import { useDebounce } from '../../../hooks/useDebounce'

export default function GuestsPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 400)

  // Ovaj effect se okida tek 400ms nakon što korisnik prestane tipkati
  useEffect(() => {
    if (!restaurant) return
    const query = supabase
      .from('guests')
      .select('*')
      .eq('restaurant_id', restaurant.id)

    if (debouncedSearch) {
      query.ilike('first_name', `%${debouncedSearch}%`)
    }

    query.then(({ data }) => setGuests(data ?? []))
  }, [debouncedSearch, restaurant])

  return (
    <input
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="Pretraži goste..."
    />
  )
}
```

**Definition of Done:**
- [ ] `useDebounce` hook postoji u `src/hooks/`
- [ ] Svi search inputi koji triggeruju DB query koriste debounce od 400ms
- [ ] Provjera u Network tabu DevTools-a — query se šalje jednom, ne pri svakom pritisku tipke

---

### 3.5.3 Optimizacija DB upita — indeksi i SELECT kolonama

**Problem:** `select('*')` učitava sve kolone uključujući large text polja. Na tabelama sa mnogo redova (orders, guests, inventory_movements) to je nepotrebno.

**Korak 1 — Dodaj indekse na najčešće filtrirane kolone:**

```sql
-- Pokreni u Supabase SQL Editor
-- ============================================================
-- SmartMeni — Indeksi za optimizaciju upita
-- ============================================================

-- Orders — najčešće filtriramo po statusu i restaurantu
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status 
  ON orders(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at 
  ON orders(created_at DESC);

-- Guests — pretraga po imenu i restoranu
CREATE INDEX IF NOT EXISTS idx_guests_restaurant_id 
  ON guests(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_guests_name 
  ON guests(first_name, last_name);

-- Inventory — pregled po restoranu i kategoriji
CREATE INDEX IF NOT EXISTS idx_inventory_restaurant_category 
  ON inventory_items(restaurant_id, category);

-- Attendance — HR izvještaji po datumu
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date 
  ON attendance_entries(staff_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_restaurant_date 
  ON attendance_entries(restaurant_id, date DESC);

-- Reservations — filter po datumu
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date 
  ON reservations(restaurant_id, date);

-- Work schedules — raspored po datumu
CREATE INDEX IF NOT EXISTS idx_schedules_restaurant_date 
  ON work_schedules(restaurant_id, date);

-- Inventory movements — historija po stavci
CREATE INDEX IF NOT EXISTS idx_inv_movements_item 
  ON inventory_movements(item_id, created_at DESC);
```

**Korak 2 — Zamijeni `select('*')` sa konkretnim kolonama u listama:**

```bash
# Pronađi sve select('*') u projektu
grep -rn "select('\*')\|select(\"*\")" src/ --include="*.jsx"
```

```jsx
// ❌ Učitava sve kolone — uključujući avatar_url, note, blacklist_reason...
const { data } = await supabase.from('guests').select('*')

// ✅ Samo kolone potrebne za prikaz liste
const { data } = await supabase
  .from('guests')
  .select('id, first_name, last_name, phone, status, total_visits, total_spent')

// ✅ Za detalje — puni select na single record je OK
const { data } = await supabase
  .from('guests')
  .select('*')
  .eq('id', guestId)
  .single()
```

**Prioritet refaktorisanja `select('*')`:**
1. `GuestsPage` — lista gostiju (može biti stotine redova)
2. `InventoryPage` — lista stavki
3. `MovementsLog` — historija pokreta (potencijalno hiljade redova)
4. `HRReportsPage` — agregirani podaci
5. `AnalyticsPage` — kompleksni upiti

**Korak 3 — Paginacija na dugim listama:**

```jsx
// Dodaj paginaciju na GuestsPage i MovementsLog
const PAGE_SIZE = 50

const { data, count } = await supabase
  .from('guests')
  .select('id, first_name, last_name, status', { count: 'exact' })
  .eq('restaurant_id', restaurant.id)
  .order('created_at', { ascending: false })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

// Ukupan broj za prikaz "Stranica 1 od 5"
const totalPages = Math.ceil(count / PAGE_SIZE)
```

**Definition of Done:**
- [ ] Svi indeksi iz SQL skripte su kreirani
- [ ] `select('*')` je zamijenjen konkretnim kolonama u min. 3 liste komponente
- [ ] `GuestsPage` i `MovementsLog` imaju paginaciju ako ima više od 50 redova

---

### 3.5.4 Skeleton loaderi umjesto spinera

**Problem:** Spinner na praznom ekranu je neprijatan — korisnik ne zna koliko će čekati ni šta će se pojaviti. Skeleton prikazuje strukturu odmah.

```bash
touch src/components/shared/SkeletonList.jsx
touch src/components/shared/SkeletonList.module.css
```

Sadržaj `SkeletonList.jsx`:

```jsx
import styles from './SkeletonList.module.css'

// Generički skeleton za listu kartica
export function SkeletonCard({ lines = 2 }) {
  return (
    <div className={styles.card}>
      <div className={`${styles.line} ${styles.title}`} />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`${styles.line} ${styles.body}`} style={{ width: `${70 - i * 15}%` }} />
      ))}
    </div>
  )
}

// Skeleton za tabelu (HR, inventory)
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className={styles.table}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className={styles.row}>
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={styles.cell} style={{ width: `${100 / cols}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
}
```

Sadržaj `SkeletonList.module.css`:

```css
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.line {
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  height: 14px;
  margin-bottom: 8px;
}

.title { height: 18px; width: 60%; }
.body { height: 12px; }

.card {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  margin-bottom: 8px;
}

.table { width: 100%; }
.row {
  display: flex;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}
.cell {
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
```

**Primjer korišćenja:**

```jsx
import { SkeletonCard, SkeletonTable } from '../../../components/shared/SkeletonList'

export default function GuestsPage() {
  const { data: guests, loading } = useSupabaseQuery(...)

  if (loading) return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}
    </div>
  )

  return guests.map(guest => <GuestCard key={guest.id} guest={guest} />)
}
```

**Prioritet uvođenja skeleton lodera:**
1. `GuestsPage` — lista gostiju
2. `WaiterDashboard` — lista narudžbi
3. `InventoryPage` — lista stavki
4. `StaffPage` — lista osoblja
5. `AnalyticsPage` — grafovi i statistike

**Definition of Done:**
- [ ] `SkeletonCard` i `SkeletonTable` komponente postoje
- [ ] Minimum 3 stranice sa listama koriste skeleton umjesto spinera

---

### 3.5.5 Optimistic updates za status narudžbi

**Problem:** Konobar klikne "Prihvati narudžbu" — čeka 300–800ms dok Supabase odgovori, a dugme je zamrznuto. Na zauzenom servisu ovo usporava rad.

**Implementacija u WaiterDashboard:**

```jsx
export default function WaiterDashboard() {
  const [orders, setOrders] = useState([])

  const updateOrderStatus = useCallback(async (orderId, newStatus) => {
    // 1. Optimistički ažuriraj UI odmah
    const previousOrders = orders
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
    )

    // 2. Pokušaj ažurirati u bazi
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    // 3. Ako je greška — vrati na prethodno stanje i obavijesti
    if (error) {
      setOrders(previousOrders)
      toast.error('Greška pri ažuriranju narudžbe. Pokušajte ponovo.')
    }
  }, [orders])

  // ...
}
```

**Gdje primijeniti optimistic updates:**
1. `WaiterDashboard` — promjena statusa narudžbe (pending → accepted → ready → done)
2. `KitchenDashboard` — markiranje narudžbe kao gotove
3. `ReservationsPage` — potvrda / otkazivanje rezervacije
4. `InventoryPage` — brza izmjena količine zalihe

**Definition of Done:**
- [ ] `WaiterDashboard` i `KitchenDashboard` koriste optimistic updates za status promjene
- [ ] Rollback na prethodno stanje radi ispravno pri grešci
- [ ] Toast notifikacija se prikazuje pri grešci rollbacka

---

### 3.5.6 Optimizacija slika — Supabase Storage transform

**Problem:** Logo i avatari se učitavaju u originalnoj veličini. Logo od 2MB se učitava na svakom gostovom meniju.

**Supabase Image Transformation** (dostupno na Pro planu) — dodaj resize parametre direktno u URL:

```js
// src/lib/imageUtils.js

/**
 * Generiše optimizovani URL za Supabase Storage sliku.
 * Automatski dodaje resize parametre ako je Supabase Pro aktivan.
 */
export function getImageUrl(path, { width, height, quality = 80 } = {}) {
  if (!path) return null

  // Ako je već puni URL (legacy) — vrati kao jest
  if (path.startsWith('http')) return path

  const base = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${path}`

  // Na Starter planu — vrati originalni URL
  // Na Pro planu — dodaj transform parametre
  const params = new URLSearchParams()
  if (width) params.set('width', width)
  if (height) params.set('height', height)
  params.set('quality', quality)

  const queryString = params.toString()
  return queryString ? `${base}?${queryString}` : base
}

// Primjeri korišćenja:
// Logo u guest meniju (mala verzija)
// getImageUrl(restaurant.logo_url, { width: 120, quality: 85 })

// Avatar u listi osoblja
// getImageUrl(staff.avatar_url, { width: 48, height: 48, quality: 80 })

// Logo u admin panelu (veća verzija)
// getImageUrl(restaurant.logo_url, { width: 240, quality: 90 })
```

**Dodaj `loading="lazy"` na slike ispod folda:**

```jsx
// U GuestMenu.jsx i svim listama sa slikama
<img
  src={getImageUrl(item.image_url, { width: 300, quality: 80 })}
  alt={item.name}
  loading="lazy"        // Browser lazy-load — ne učitava dok nije u viewportu
  width={300}
  height={200}
  style={{ objectFit: 'cover' }}
/>
```

**Definition of Done:**
- [ ] `src/lib/imageUtils.js` postoji sa `getImageUrl` funkcijom
- [ ] Sve `<img>` sa Supabase Storage URL-ovima koriste `getImageUrl`
- [ ] Sve slike ispod folda imaju `loading="lazy"`
- [ ] Logo u guest meniju se učitava sa `width: 120` umjesto originalne veličine

---

## Faza 4 — Post-launch

### 4.1 Rate limiting na javnim rutama

```sql
-- Pokreni u Supabase SQL Editor
-- Ograniči broj rezervacija sa iste IP adrese

CREATE EXTENSION IF NOT EXISTS pg_rate_limiting;

-- Alternativa bez ekstenzije — honeypot polje u formama
-- Dodaj skriveni input u OnlineReservationForm i GuestRegisterPage:
-- <input type="text" name="_honey" style={{display:'none'}} />
-- Na backendu: ako je polje popunjeno, odbij zahtjev (bot)
```

**Implementacija honeypot-a u formi:**

```jsx
// U svakoj javnoj formi dodaj:
const { register, handleSubmit, watch } = useForm()
const honeypot = watch('_honey')

const onSubmit = async (data) => {
  if (honeypot) return; // Bot detekcija — tiho odbij
  // ... normalan submit
}

// U JSX:
<input 
  {...register('_honey')} 
  type="text" 
  style={{ display: 'none' }} 
  tabIndex={-1} 
  autoComplete="off" 
/>
```

---

### 4.2 Billing webhook — Edge Function

**Problem:** PayPal webhook mora ažurirati `plan` u bazi. Ne smije ići kroz frontend.

```bash
# Inicijalizuj Supabase CLI u projektu
supabase init

# Napravi Edge Function
supabase functions new paypal-webhook
```

Sadržaj `supabase/functions/paypal-webhook/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const payload = await req.json()
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Service role — SAMO na serveru!
  )

  const { event_type, resource } = payload

  if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    await supabase
      .from('restaurants')
      .update({ plan: 'pro', suspended_at: null, plan_expires_at: null })
      .eq('subscription_id', resource.id)
  }

  if (event_type === 'BILLING.SUBSCRIPTION.CANCELLED') {
    await supabase
      .from('restaurants')
      .update({ plan: 'starter' })
      .eq('subscription_id', resource.id)
  }

  return new Response('OK', { status: 200 })
})
```

```bash
# Deploy
supabase functions deploy paypal-webhook
```

---

### 4.3 Sentry error tracking

```bash
npm install @sentry/react
```

```jsx
// main.jsx — dodaj na vrh prije render()
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE, // 'development' ili 'production'
  tracesSampleRate: 0.1, // 10% transakcija
  beforeSend(event) {
    // Ne šalji greške u development modu
    if (import.meta.env.DEV) return null
    return event
  }
})
```

```bash
# Dodaj u .env
echo "VITE_SENTRY_DSN=https://your-dsn@sentry.io/project" >> .env
echo "VITE_SENTRY_DSN=" >> .env.example
```

---

---

## Brzi referentni vodič — CLI komande

```bash
# Pokretanje dev servera
npm run dev

# Build za produkciju
npm run build

# Preview production builda
npm run preview

# Provjera bundle veličine
npm run build -- --analyze  # zahtjeva vite-bundle-analyzer

# Instalacija svih novih paketa iz ovog plana
npm install react-hot-toast react-hook-form

# Provjera da li nema osjetljivih podataka u kodu
grep -r "service_role\|supabase_secret" src/ --include="*.jsx" --include="*.js"

# Provjera Realtime subscriptions bez cleanupa
grep -rn "supabase.channel" src/ --include="*.jsx" -A 20 | grep -v "removeChannel"

# Pronađi sve select('*') koje treba zamijeniti
grep -rn "select('\*')\|select(\"*\")" src/ --include="*.jsx"

# Pronađi komponente sa listama za memoizaciju
grep -rn "\.map(" src/modules --include="*.jsx" -l

# Pronađi search inpute za debouncing
grep -rn "onChange\|setSearch\|setFilter" src/ --include="*.jsx" -l
```

---

---

## ═══ ETAPA B — Hotelska platforma ═══

> **Preduslov:** Sve faze Etape A završene. Aplikacija je stabilna i ima prve korisnike.
> **Cilj:** Izgradnja punog hospitality PMS-a sa online bookingom, housekeepingom i channel managerom.

---

## Faza 5 — Billing infrastruktura i restoran polish

> **Paralelno:** Dok jedan developer polira restoran module, drugi gradi billing infrastrukturu.

**Trajanje:** 6–8 sedmica  
**Tim:** 2 developera

### 1.1 Billing infrastruktura (temelj za sve addonove)

Ovo je **najvažnija tehnička odluka** u ovoj fazi. Sve što dolazi nakon zavisi od toga kako je billing dizajniran.

**Preporučena arhitektura:**

```
Stripe (payment processor)
  ↓
Stripe Webhooks → Supabase Edge Function
  ↓
restaurants.plan, restaurants.addons (jsonb), subscriptions tabela
  ↓
PlatformContext → usePermission hook (već postoji, proširiti)
```

**Supabase tabele:**

```sql
-- Nova tabela za subscription tracking
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  addons JSONB DEFAULT '[]',            -- ['hotel_core', 'booking_engine', ...]
  status TEXT DEFAULT 'active',         -- active | past_due | cancelled | trialing
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Addon definicije (admin konfiguriše, ne hardcode u frontendu)
CREATE TABLE addon_catalog (
  id TEXT PRIMARY KEY,                  -- 'hotel_core', 'booking_engine', ...
  name TEXT NOT NULL,
  description TEXT,
  price_yearly NUMERIC(10,2),
  price_monthly NUMERIC(10,2),
  stripe_price_id_yearly TEXT,
  stripe_price_id_monthly TEXT,
  is_active BOOLEAN DEFAULT true,
  depends_on TEXT[],                    -- ['hotel_core'] za booking_engine
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Edge Function za Stripe webhooks:**

```bash
supabase functions new stripe-webhook
```

```typescript
// supabase/functions/stripe-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const metadata = sub.metadata // restaurant_id mora biti u metadata
      
      await supabase.from('subscriptions').upsert({
        restaurant_id: metadata.restaurant_id,
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer as string,
        status: sub.status,
        addons: sub.items.data.map(i => i.price.metadata.addon_id).filter(Boolean),
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_subscription_id' })
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('subscriptions')
        .update({ status: 'cancelled', addons: [] })
        .eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return new Response('OK', { status: 200 })
})
```

**Proširi `usePermission` hook:**

```js
// src/lib/permissions.js — dodati hasAddon helper
export function hasAddon(subscription, addonId) {
  if (!subscription) return false
  if (subscription.plan === 'enterprise') return true // enterprise ima sve
  return subscription.addons?.includes(addonId) ?? false
}

// Korišćenje u komponentama:
// if (!hasAddon(subscription, 'hotel_core')) return <UpgradePrompt addon="hotel_core" />
```

### 1.2 UpgradePrompt komponenta

Svaki addon modul koji korisnik nema treba prikazati jasnu upgrade poruku umjesto prazne stranice:

```jsx
// src/components/shared/UpgradePrompt.jsx
export default function UpgradePrompt({ addon, name, description, price }) {
  return (
    <div className={styles.container}>
      <div className={styles.icon}>🔒</div>
      <h2>{name}</h2>
      <p>{description}</p>
      <p className={styles.price}>Od {price}€/godišnje</p>
      <button onClick={() => window.open('/billing/addons', '_self')}>
        Aktiviraj modul
      </button>
      <span>14 dana besplatno probno razdoblje</span>
    </div>
  )
}
```

### 1.3 Restoran moduli — polish

Paralelno sa billing infrastrukturom, polish postojećih modula:
- Inventory pro — recepti, FIFO, automatska upozorenja za niske zalihe
- HR pro — kompletan payroll export, godišnji odmori
- Analytics pro — export u PDF/Excel, custom date range

**Definition of Done — Faza 1:**
- [ ] Stripe integracija radi end-to-end (test mode)
- [ ] Webhook prima i obrađuje subscription evente
- [ ] `hasAddon()` helper funkcioniše u svim modulima
- [ ] `UpgradePrompt` se prikazuje za module koje tenant nema
- [ ] Addon catalog je u bazi, ne hardcoded u frontendu
- [ ] Trial 14 dana radi za svaki novi addon

---

---

## Faza 6 — Hotel Core modul (`hotel_core`)

> **Preduslov:** `hotel_core` addon je dostupan u billing sistemu.  
> **Trajanje:** 10–14 sedmica  
> **Tim:** 2 developera

Ovo je najveći i najkompleksniji modul. Razvija se u 4 pod-faze.

### 2.1 Upravljanje nekretninom — osnova

**Nove tabele:**

```sql
-- Tipovi smještajnih jedinica
CREATE TABLE room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- 'Standard', 'Deluxe', 'Suite', 'Apartman'
  description TEXT,
  max_occupancy INT DEFAULT 2,
  base_price NUMERIC(10,2),
  amenities JSONB DEFAULT '[]',     -- ['wifi', 'ac', 'minibar', 'balcony', ...]
  images JSONB DEFAULT '[]',        -- Supabase Storage URLs
  is_active BOOLEAN DEFAULT true
);

-- Konkretne sobe/jedinice
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES room_types(id),
  room_number TEXT NOT NULL,        -- '101', '202', 'Villa A'
  floor INT,
  status TEXT DEFAULT 'available',  -- available | occupied | cleaning | maintenance | blocked
  notes TEXT,
  last_cleaned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hotel rezervacije (odvojeno od restoran rezervacija)
CREATE TABLE hotel_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id),
  room_type_id UUID REFERENCES room_types(id),
  guest_id UUID REFERENCES guests(id),   -- vezan za postojeći guests modul
  
  -- Termini
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  actual_check_in TIMESTAMPTZ,
  actual_check_out TIMESTAMPTZ,
  
  -- Gosti
  adults INT DEFAULT 1,
  children INT DEFAULT 0,
  
  -- Finansije
  rate_per_night NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  paid_amount NUMERIC(10,2) DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',  -- pending | partial | paid | refunded
  
  -- Meta
  status TEXT DEFAULT 'confirmed',  -- inquiry | confirmed | checked_in | checked_out | cancelled | no_show
  source TEXT DEFAULT 'direct',     -- direct | booking_com | airbnb | phone | walk_in
  external_id TEXT,                 -- ID sa eksternog channela (Booking.com reservation ID)
  special_requests TEXT,
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Frontend moduli:**

```
src/modules/hotel/
├── pages/
│   ├── HotelDashboard.jsx      -- Pregled: occupancy, check-ins danas, prihod
│   ├── RoomsPage.jsx           -- Grid/lista soba sa statusom u realtimu
│   ├── RoomTypesPage.jsx       -- Upravljanje tipovima soba
│   ├── ReservationsPage.jsx    -- Lista svih rezervacija sa filterima
│   ├── ReservationDetail.jsx   -- Detalji rezervacije + folio
│   ├── CalendarView.jsx        -- Availability calendar (Gantt-style po sobama)
│   └── FrontDeskPage.jsx       -- Check-in / check-out flow
├── components/
│   ├── RoomCard.jsx
│   ├── RoomStatusBadge.jsx
│   ├── ReservationCard.jsx
│   ├── OccupancyWidget.jsx
│   └── CheckInForm.jsx
└── hooks/
    ├── useRooms.js
    ├── useReservations.js
    └── useOccupancy.js
```

### 2.2 Availability Calendar

Najkompleksnija UI komponenta u hotel modulu — Gantt-style prikaz gdje svaki red je soba a kolone su dani.

```jsx
// Vizualni prikaz:
//
//        | 18.5 | 19.5 | 20.5 | 21.5 | 22.5 |
// -------|------|------|------|------|------|
// 101    | [===SMITH=====] |      |      |
// 102    |      | [====JONES========]   |
// 103    |      |      |      | [==PERIC==]
// Suite  | BLOK.|      | [=========VIP=======]

// Implementacija sa CSS Grid ili react-big-calendar
// Preporučen library: @aldabil/react-scheduler ili custom implementacija
```

### 2.3 Front Desk — Check-in / Check-out

```jsx
// Tok check-ina:
// 1. Pretraži rezervaciju (po prezimenu, ID-u, datumu)
// 2. Potvrdi podatke gosta + skeniranje dokumenta (opcija)
// 3. Dodijeli sobu (ako nije unaprijed dodijeljena)
// 4. Prikaži folio (šta je unaprijed plaćeno, šta duguje)
// 5. Uzmi pre-autorizaciju kartice (opcija)
// 6. Generiši sobu key / QR kod
// 7. Status sobe → 'occupied'

// Tok check-outa:
// 1. Otvori folio
// 2. Pregledaj sve troškove (soba + restoran + minibar + ostalo)
// 3. Napravi korektivne stavke ako treba
// 4. Naplati ostatak
// 5. Generiši finalni račun (PDF)
// 6. Status sobe → 'cleaning'
// 7. Pošalji email zahvalnicu
```

### 2.4 Folio sistem

Folio je "račun boravka" koji agregira sve troškove jednog gosta tokom boravka.

```sql
CREATE TABLE folios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES hotel_reservations(id),
  restaurant_id UUID REFERENCES restaurants(id),
  guest_id UUID REFERENCES guests(id),
  status TEXT DEFAULT 'open',  -- open | closed | invoiced
  total_amount NUMERIC(10,2) DEFAULT 0,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE folio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_id UUID REFERENCES folios(id),
  type TEXT NOT NULL,           -- 'room_charge' | 'restaurant' | 'minibar' | 'spa' | 'other'
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(10,2),
  total_price NUMERIC(10,2),
  date DATE,
  order_id UUID REFERENCES orders(id),  -- veza sa restoran narudžbom ako postoji
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Ključna integracija:** Kada gost naruči iz restorana i identificira se kao hotelski gost, narudžba se automatski dodaje na folio umjesto da se odmah plaća.

**Definition of Done — Faza 2:**
- [ ] Upravljanje tipovima soba i konkretnim sobama
- [ ] Kreiranje / uređivanje / otkazivanje rezervacija
- [ ] Availability calendar prikazuje ispravno zauzetost
- [ ] Check-in flow radi end-to-end
- [ ] Check-out sa folio pregledom i PDF računom
- [ ] Restoran narudžba može biti dodana na hotelski folio
- [ ] Housekeeping — status sobe se mijenja automatski pri check-outu
- [ ] RLS — hotel podaci jednog tenanta nisu vidljivi drugom

---

---

## Faza 7 — Booking Engine (`booking_engine`)

> **Preduslov:** `hotel_core` addon aktivan, `booking_engine` addon u billing sistemu.  
> **Trajanje:** 6–8 sedmica  
> **Tim:** 2 developera

Booking engine je javna stranica/widget koji gosti hotela koriste za direktne rezervacije — bez provizije Booking.coma.

### 3.1 Javni booking widget

```
URL: /:hotel_slug/book

Tok:
1. Odabir datuma (check-in / check-out)
2. Odabir tipa sobe (prikaz sa slikama, opisom, cijenom)
3. Unos podataka gosta
4. Odabir dodatnih usluga (transfer, early check-in, late check-out)
5. Plaćanje (Stripe: kartica ili rezervacija bez plaćanja)
6. Potvrda emailom
```

**Nove tabele:**

```sql
-- Rate planovi (different pricing po kanalima i sezonama)
CREATE TABLE rate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  room_type_id UUID REFERENCES room_types(id),
  name TEXT NOT NULL,            -- 'Standard rate', 'Non-refundable', 'Early bird'
  price_per_night NUMERIC(10,2),
  min_stay INT DEFAULT 1,
  cancellation_policy TEXT,      -- 'free_until_24h' | 'non_refundable' | 'flexible'
  is_active BOOLEAN DEFAULT true
);

-- Sezonske cijene (override base price)
CREATE TABLE seasonal_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id UUID REFERENCES rate_plans(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  price_per_night NUMERIC(10,2),
  label TEXT                     -- 'Ljetna sezona', 'Božić', 'Praznici'
);

-- Dostupnost po datumu (inventory management)
CREATE TABLE room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id UUID REFERENCES room_types(id),
  date DATE NOT NULL,
  total_rooms INT,               -- ukupno soba ovog tipa
  available_rooms INT,           -- slobodne (total - rezervisane)
  stop_sell BOOLEAN DEFAULT false,  -- ručno zaustavi prodaju
  UNIQUE(room_type_id, date)
);
```

### 3.2 Availability engine

```js
// Algoritam za provjeru dostupnosti:
// 1. Za svaki dan u traženom periodu, provjeri room_availability
// 2. available_rooms mora biti > 0 za SVE dane perioda
// 3. Provjeri min_stay uvjet rate plana
// 4. Provjeri stop_sell flag
// 5. Vrati dostupne tipove soba sa cijenom

async function checkAvailability(restaurantId, checkIn, checkOut, adults) {
  const nights = differenceInDays(checkOut, checkIn)
  
  const { data } = await supabase.rpc('get_available_rooms', {
    p_restaurant_id: restaurantId,
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_adults: adults
  })
  
  return data // [{room_type, available_count, price_per_night, total_price}]
}
```

```sql
-- PostgreSQL funkcija za dostupnost (performansna)
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
    rt.id,
    rt.name,
    MIN(ra.available_rooms)::INT as available_count,
    rp.price_per_night,
    rp.price_per_night * v_nights as total_price,
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
  HAVING COUNT(ra.date) = v_nights;  -- svi dani moraju biti dostupni
END;
$$ LANGUAGE plpgsql;
```

### 3.3 Stripe payment flow za booking

```
Gost bira sobu
  ↓
Stripe Payment Intent (amount = total_price)
  ↓
Kartica potvrđena
  ↓
Webhook: payment_intent.succeeded
  ↓
Edge Function: kreira hotel_reservation, smanjuje room_availability, šalje email potvrdu
```

**Definition of Done — Faza 3:**
- [ ] Javna booking stranica radi na `/:slug/book`
- [ ] Availability engine ispravno blokira već zauzete datume
- [ ] Stripe plaćanje radi u test i live modu
- [ ] Email potvrda se šalje automatski
- [ ] Nova rezervacija se pojavljuje u hotel_core dashboardu
- [ ] `room_availability` se smanjuje pri svakoj potvrđenoj rezervaciji
- [ ] Cancellation flow sa refundom (ako cancellation policy dozvoljava)

---

---

## Faza 8 — Housekeeping modul (`housekeeping`)

> **Preduslov:** `hotel_core` aktivan.  
> **Trajanje:** 3–4 sedmice  
> **Tim:** 1–2 developera

### 4.1 Tabele

```sql
CREATE TABLE housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  room_id UUID REFERENCES rooms(id),
  assigned_to UUID REFERENCES staff(id),
  type TEXT NOT NULL,              -- 'checkout_clean' | 'stayover_clean' | 'turndown' | 'inspection'
  status TEXT DEFAULT 'pending',   -- pending | in_progress | done | verified
  priority TEXT DEFAULT 'normal',  -- low | normal | high | urgent
  notes TEXT,
  scheduled_for DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  room_id UUID REFERENCES rooms(id),
  reported_by UUID REFERENCES staff(id),
  category TEXT,                   -- 'plumbing' | 'electrical' | 'ac' | 'furniture' | 'other'
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',      -- open | in_progress | resolved
  priority TEXT DEFAULT 'normal',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.2 Automatizacija taskova

```sql
-- Trigger: pri check-outu automatski kreira housekeeping task
CREATE OR REPLACE FUNCTION create_checkout_cleaning_task()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'checked_out' AND OLD.status = 'checked_in' THEN
    INSERT INTO housekeeping_tasks (restaurant_id, room_id, type, priority, scheduled_for)
    VALUES (NEW.restaurant_id, NEW.room_id, 'checkout_clean', 'high', CURRENT_DATE);
    
    -- Postavi sobu na 'cleaning'
    UPDATE rooms SET status = 'cleaning' WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_checkout_cleaning
AFTER UPDATE ON hotel_reservations
FOR EACH ROW EXECUTE FUNCTION create_checkout_cleaning_task();
```

### 4.3 Housekeeping dashboard (mobile-first)

Sobarice koriste telefon, dashboard mora biti optimizovan za mali ekran:

```
Moji zadaci danas:
┌────────────────────────────────┐
│ 🔴 Soba 101 — HITNO            │
│    Checkout čišćenje           │
│    [Počni] [Detalji]           │
├────────────────────────────────┤
│ 🟡 Soba 205 — Normalno         │
│    Svakodnevno čišćenje        │
│    [Počni] [Detalji]           │
└────────────────────────────────┘
```

**Definition of Done — Faza 4:**
- [ ] Housekeeping taskovi se automatski kreiraju pri check-outu
- [ ] Sobarica može promijeniti status taska (pending → done)
- [ ] Soba automatski mijenja status: occupied → cleaning → available
- [ ] Maintenance requests se mogu kreirati i pratiti
- [ ] Mobile-friendly prikaz za housekeeping osoblje

---

---

## Faza 9 — Revenue Management (`revenue_mgmt`)

> **Preduslov:** `hotel_core` + `booking_engine` aktivni.  
> **Trajanje:** 6–8 sedmica  
> **Tim:** 2 developera

### 5.1 Ključne metrike

```sql
-- View za revenue analitiku (izračunava KPIs automatski)
CREATE OR REPLACE VIEW hotel_revenue_metrics AS
SELECT
  r.id AS restaurant_id,
  DATE_TRUNC('month', hr.check_in_date) AS month,
  COUNT(DISTINCT hr.id) AS total_reservations,
  COUNT(DISTINCT hr.room_id) AS rooms_sold,
  SUM(hr.total_amount) AS total_revenue,
  AVG(hr.rate_per_night) AS adr,          -- Average Daily Rate
  -- RevPAR = Total Revenue / Available Room Nights
  SUM(hr.total_amount) / NULLIF(
    (SELECT COUNT(*) FROM rooms WHERE restaurant_id = r.id) * 
    EXTRACT(DAY FROM DATE_TRUNC('month', hr.check_in_date) + INTERVAL '1 month' - DATE_TRUNC('month', hr.check_in_date)),
    0
  ) AS revpar,
  -- Occupancy Rate
  COUNT(DISTINCT hr.room_id)::FLOAT / NULLIF(
    (SELECT COUNT(*) FROM rooms WHERE restaurant_id = r.id),
    0
  ) * 100 AS occupancy_rate
FROM restaurants r
LEFT JOIN hotel_reservations hr ON hr.restaurant_id = r.id
  AND hr.status NOT IN ('cancelled', 'no_show')
GROUP BY r.id, DATE_TRUNC('month', hr.check_in_date);
```

### 5.2 Dinamičke cijene — osnova

```js
// Algoritam za price suggestion (ne automatski — vlasniku prikazuje prijedloge)
function suggestPrice(basePrice, occupancyRate, daysUntilCheckIn) {
  let multiplier = 1.0

  // Visoka popunjenost → viša cijena
  if (occupancyRate > 0.8) multiplier += 0.3       // +30%
  else if (occupancyRate > 0.6) multiplier += 0.15  // +15%
  else if (occupancyRate < 0.3) multiplier -= 0.1   // -10%

  // Last minute (< 3 dana) sa slobodnim sobama → popust
  if (daysUntilCheckIn < 3 && occupancyRate < 0.5) multiplier -= 0.15

  // Daleko unaprijed (> 60 dana) sa malim interesom → early bird popust
  if (daysUntilCheckIn > 60 && occupancyRate < 0.2) multiplier -= 0.1

  return Math.round(basePrice * multiplier)
}
```

**Definition of Done — Faza 5:**
- [ ] Dashboard prikazuje ADR, RevPAR, Occupancy Rate po periodu
- [ ] Grafovi trendova po sedmicama i mjesecima
- [ ] Price suggestion algoritam daje prijedloge (ne automatski mijenja)
- [ ] Vlasnik može jednim klikom prihvatiti sugestiju i ažurirati rate plan
- [ ] Export analitike u PDF / Excel

---

---

## Faza 10 — Channel Manager (`channel_manager`)

> **Preduslov:** `hotel_core` + `booking_engine` aktivni.  
> **Trajanje:** 12–16 sedmica — ovo je najveći tehnički izazov  
> **Tim:** 2 developera — preporučiti 1 dedikovani za integracije  
> **Napomena:** Ovo je premium addon zbog troška i kompleksnosti razvoja.

### Zašto je ovo teško

- Booking.com Connectivity Partner program zahtijeva aplikaciju, review proces i certifikaciju (2–6 mjeseci)
- Svaki kanal ima vlastiti XML/JSON API sa različitim modelima podataka
- Availability i rate sync mora biti u realtimu ili blizu realtimu — overbooking je katastrofalan
- Svaki kanal ima drugačiju politiku rezervacija, otkazivanja, provizija

### Preporučena strategija za channel manager

**Opcija A — Direktne integracije (dugo, skupo, maksimalna kontrola):**
```
SmartMeni ←→ Booking.com API (XML/HTTPS)
SmartMeni ←→ Airbnb API
SmartMeni ←→ Expedia API
```

**Opcija B — Aggregator middleware (brže, provizija, ali gotovo) ✅ PREPORUČENO:**
```
SmartMeni ←→ Beds24 API / Lodgify API / SiteMinder API
                    ↓
         Beds24 ←→ Booking.com
         Beds24 ←→ Airbnb
         Beds24 ←→ Expedia
         Beds24 ←→ 100+ OTA-a
```

**Zašto Opcija B za MVP:** Beds24, Lodgify i SiteMinder su već certificirani partneri svih major OTA-a. Integrišeš se sa jednim API-em (Beds24 ima dobar REST API) i dobiješ pristup stotinama kanala. Naplatišu to kao premium addon i uračunaj Beds24 API trošak u cijenu.

### 6.1 Beds24 integracija (Opcija B)

```js
// src/lib/channelManager.js

const BEDS24_API = 'https://api.beds24.com/v2'

export async function syncAvailability(restaurantId, roomTypeId, dates) {
  // 1. Dobij Beds24 property ID za ovaj restoran
  // 2. Konstruiši availability update payload
  // 3. Pošalji na Beds24 API
  // 4. Beds24 propagira na sve kanale (Booking.com, Airbnb...)
}

export async function syncRates(restaurantId, roomTypeId, ratePlan) {
  // Sinhronizuj cijene na sve kanale
}

// Webhook handler — Beds24 šalje nove rezervacije sa eksternih kanala
export async function handleExternalBooking(beds24Booking) {
  // Kreira hotel_reservation sa source = 'booking_com' / 'airbnb'
  // Smanjuje room_availability
  // Šalje email potvrdu gostu
}
```

**Definition of Done — Faza 6:**
- [ ] Beds24 (ili ekvivalent) API integracija radi u test modu
- [ ] Promjena dostupnosti u SmartMeniju se reflektuje na Booking.com
- [ ] Nova rezervacija sa Booking.coma se pojavljuje u SmartMeni dashboardu
- [ ] Otkazivanje sa eksternog kanala ažurira dostupnost
- [ ] Overbooking prevencija radi (real-time sync ili buffer strategy)

---

---

## Faza 11 — Loyalty program + Guest App (`loyalty`, `guest_app`)

> **Preduslov:** 100+ aktivnih tenanata, stabilna platforma  
> **Trajanje:** 8–10 sedmica  

### Loyalty sistem

```sql
CREATE TABLE loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  name TEXT,                       -- 'SmartRewards', vlastiti naziv hotela
  points_per_euro NUMERIC DEFAULT 1,
  redemption_rate NUMERIC DEFAULT 0.01,  -- 1 bod = 0.01€
  tier_rules JSONB                 -- [{ min_points: 0, tier: 'bronze' }, ...]
);

CREATE TABLE loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id),
  restaurant_id UUID REFERENCES restaurants(id),
  points_balance INT DEFAULT 0,
  total_points_earned INT DEFAULT 0,
  tier TEXT DEFAULT 'bronze',
  UNIQUE(guest_id, restaurant_id)
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES loyalty_accounts(id),
  type TEXT,                       -- 'earn' | 'redeem' | 'expire' | 'adjustment'
  points INT,
  reference_id UUID,               -- folio_id ili order_id
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Guest App (white-label PWA)

Svaki hotel ima vlastitu guest app na `/:slug/guest-app`:
- Digitalni meni + room service narudžbe
- Pregled i plaćanje folija
- Loyalty bodovi
- Komunikacija sa osobljem (chat ili request)
- Hotel informacije, WiFi kod, spa booking
- Late checkout request

---

---

## Faza 12 — Mobilna aplikacija

> **Preduslov:** 50+ aktivnih tenanata, validiran produkt  
> **Trajanje:** 16–24 sedmice  
> **Tim:** Minimalno 1 mobile developer + backend podrška  
> **Tehnologija:** React Native (Expo) — maksimalna reusabilnost React koda

### Zašto Expo (React Native)

```
Prednosti:
✅ Dijeli logiku sa web app (hooks, API pozivi, permissions)
✅ Jedan codebase → iOS + Android
✅ Over-the-air updates bez app store review (za bug fixove)
✅ Supabase React Native SDK postoji i dobro radi
✅ Expo EAS Build za cloud build bez Mac-a (za Android)

Mane:
❌ Native performanse (animacije, kamera) su malo slabije od pure native
❌ Expo managed workflow ima ograničenja za neke native module
❌ App store deployment + review proces (1–7 dana za review)
```

### Prioritet modula za mobilnu app

Ne treba sve biti u mobilnoj app od starta. Prioritet:

**V1 (launch):**
- Waiter app — primanje i upravljanje narudžbama, waiter requests
- Kitchen display — prikaz narudžbi u kuhinji
- Housekeeping app — taskovi za sobarice
- Front desk quick actions — check-in/out, room status

**V2:**
- Guest app — digitalni meni, room service, rezervacije, folio
- Manager overview — KPIs, live occupancy, prihod danas
- HR — osoblje vidi raspored, prijava prisustva

**V3:**
- Push notifikacije za sve role
- Offline mode (Kitchen display mora raditi i bez interneta)
- NFC check-in (gost privuče telefon i check-in je gotov)

### App store priprema

```bash
# Instalacija Expo
npm install -g @expo/cli
npx create-expo-app smartmeni-mobile --template

# Apple Developer Account: 99$/god — potreban za iOS distribuciju
# Google Play Console: 25$ jednokratno

# Build za testiranje (bez app storea)
npx expo start --tunnel

# Production build
eas build --platform all
```

---

---

## ═══ ETAPA C — Portfolio upravljanje ═══

> **Preduslov:** 50+ aktivnih tenanata, validiran hotelski modul, tim od 2+ developera.
> **Cilj:** Centralizovano upravljanje portfeljima više objekata u više zemalja.

---

## Faza 13 — Portfolio Owner modul (`portfolio_owner`)

> **Preduslov:** `multi_property` addon aktivan, minimum 2 objekta na platformi.
> **Trajanje:** 8-10 sedmica | **Tim:** 2 developera

Centralizovana komandna tabla za vlasnike portfelja koji upravljaju vise objekata u razlicitim drzavama.

### 9.1 Arhitektura — hijerarhija tenanata

Trenutna arhitektura ima jedan nivo (`restaurant_id`). Za portfolio owner potrebna je hijerarhija:

```
portfolio (top-level — vlasnik)
  └── brand (opciono — "Grand Hotels", "Bistro Co.")
        └── property_group (opciono — "Jadranska regija", "Centralna EU")
              └── restaurant / hotel (tenant — postojeca arhitektura)
```

**Kljucne nove tabele:**

```sql
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  currency_primary TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ DEFAULT now()
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
  scope JSONB,         -- null = sve, ili {group_ids: [...], property_ids: [...]}
  PRIMARY KEY (portfolio_id, user_id)
);

-- Tjecajevi valuta (osvjezava se dnevno via ECB API)
CREATE TABLE exchange_rates (
  from_currency TEXT NOT NULL,
  to_currency TEXT DEFAULT 'EUR',
  rate NUMERIC(10,6) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (from_currency, to_currency, date)
);
```

### 9.2 Portfolio Dashboard

Glavna stranica — prikazuje sve objekte sa live KPI-evima i statusom.

**Struktura prikaza:**
- Agregirani KPI-evi na vrhu: ukupni prihod danas, prosjecna popunjenost, ukupne narudzbe, broj upozorenja
- Tabela objekata sa: naziv, drzava (zastava), prihod danas, occupancy, NPS, status (OK / upozorenje / kritican)
- Filteri: po brandu, drzavi, grupi
- Klik na objekat → drill-down u puni admin panel tog objekta

**Materialized view za performanse:**

```sql
CREATE MATERIALIZED VIEW portfolio_kpis AS
SELECT
  pp.portfolio_id,
  r.id AS restaurant_id,
  r.name AS property_name,
  r.country_code,
  pp.brand_id,
  pp.property_group_id,
  COALESCE(SUM(CASE WHEN DATE(o.created_at) = CURRENT_DATE
    THEN o.total_amount END), 0) AS revenue_today,
  COALESCE(SUM(CASE WHEN DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', NOW())
    THEN o.total_amount END), 0) AS revenue_mtd,
  COUNT(CASE WHEN DATE(o.created_at) = CURRENT_DATE THEN 1 END) AS orders_today
FROM portfolio_properties pp
JOIN restaurants r ON r.id = pp.restaurant_id
LEFT JOIN orders o ON o.restaurant_id = r.id
GROUP BY pp.portfolio_id, r.id, r.name, r.country_code, pp.brand_id, pp.property_group_id;

CREATE UNIQUE INDEX ON portfolio_kpis(portfolio_id, restaurant_id);

-- Osvjezavanje svakih 5 minuta
SELECT cron.schedule('refresh-portfolio-kpis', '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_kpis');
```

### 9.3 Sistem upozorenja (Alerts)

Vlasnik ne treba stalno gledati dashboard — sistem ga automatski upozorava na anomalije.

```sql
CREATE TABLE portfolio_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id),
  restaurant_id UUID REFERENCES restaurants(id),
  alert_type TEXT NOT NULL,
  -- Tipovi: 'revenue_drop' | 'occupancy_low' | 'no_orders' |
  --         'staff_absent' | 'maintenance_pending' | 'payment_failed'
  severity TEXT DEFAULT 'warning',  -- 'info' | 'warning' | 'critical'
  title TEXT NOT NULL,
  description TEXT,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE alert_thresholds (
  portfolio_id UUID REFERENCES portfolios(id),
  restaurant_id UUID REFERENCES restaurants(id),  -- null = svi objekti
  alert_type TEXT NOT NULL,
  threshold_value NUMERIC,
  comparison TEXT,          -- 'below' | 'above'
  notify_email BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT true,
  PRIMARY KEY (portfolio_id, COALESCE(restaurant_id, '00000000-0000-0000-0000-000000000000'::UUID), alert_type)
);
```

Edge Function `detect-portfolio-alerts` se pokree hourly via pg_cron i provjerava:
- prihod danas vs. prosjecni dnevni prihod proslog mjeseca (< 60% = upozorenje)
- nema narudzbi vise od 4 sata u radnom vremenu
- popunjenost ispod definisanog praga
- nerijesen maintenance ticket stariji od 48h

### 9.4 Komparativna analitika

Vlasnik odabere 2-5 objekata i vidi ih side-by-side:
- Prihod MTD i % promjena vs. prethodni period
- Occupancy, RevPAR, ADR (za hotele)
- Prosjecan iznos narudzbe i broj narudzbi/dan
- Troskovi osoblja kao % prihoda
- Export u PDF ili Excel za sastanke sa investitorima

### 9.5 Konsolidovani finansijski izvjestaji

Izvjestaji na 5 nivoa: cijeli portfelj → brand → regija → drzava → objekat.
Sve vrijednosti se automatski konvertuju u primarnu valutu portfelja (EUR) po dnevnom tecaju (ECB API).

**Definition of Done — Faza 9:**
- [ ] `portfolios`, `brands`, `property_groups`, `portfolio_access` tabele kreirane s RLS
- [ ] Portfolio dashboard prikazuje live KPI-eve svih objekata
- [ ] Hijerarhija pristupa: vlasnik vidi sve, menadzder samo vlastiti objekat
- [ ] `portfolio_kpis` materialized view osvjezava se svakih 5 min
- [ ] Alert sistem detektuje anomalije i salje notifikacije
- [ ] Komparativna analitika radi za odabrane objekte
- [ ] Konsolidovani izvjestaji sa valutnom konverzijom (ECB API)
- [ ] Export u PDF i Excel

---

---

## Faza 14 — Brand & Regional Management (`brand_mgmt`, `regional_mgmt`)

> **Preduslov:** `portfolio_owner` aktivan.
> **Trajanje:** 6-8 sedmica | **Tim:** 2 developera

### 10.1 Centralizovano upravljanje sabalonima

Vlasnik lanca definise standarde koji se primjenjuju na sve objekte pod istim brandom:

```sql
CREATE TABLE brand_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  template_type TEXT NOT NULL,
  -- 'menu_structure'       → kategorije i nazivi stavki (bez cijena)
  -- 'hr_policy'            → radno vrijeme, pravila odsustva
  -- 'housekeeping'         → standardni checklist za cisenje
  -- 'guest_communication'  → sabloni emailova i SMS poruka
  name TEXT NOT NULL,
  template_data JSONB NOT NULL,
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE template_assignments (
  template_id UUID REFERENCES brand_templates(id),
  restaurant_id UUID REFERENCES restaurants(id),
  override_data JSONB,              -- lokalne izmjene na sablon
  applied_at TIMESTAMPTZ DEFAULT now(),
  applied_by UUID REFERENCES user_profiles(id),
  PRIMARY KEY (template_id, restaurant_id)
);
```

**Flow primjene sablona:**
1. Vlasnik edituje brand sablon (npr. dodaje novu kategoriju menija)
2. Klikne "Primijeni na sve Grand Hotels objekte"
3. Sistem salje notifikaciju manageru svakog objekta
4. Manager prihvata/odbija/modifikuje sablon za vlastiti objekat
5. Po prihvatanju → primjenjuje se uz mogucnost lokalnih izmjena (npr. vlastite cijene)

### 10.2 Hijerarhija pristupa — RBAC na portfolio nivou

```
PORTFOLIO OWNER       → sve akcije, svi objekti, billing
  ├── BRAND MANAGER   → svi objekti pod jednim brandom, brand sabloni
  ├── REGIONAL MGR    → svi objekti u svojoj grupi, HR odobravanje
  └── PROPERTY MGR    → samo vlastiti objekat (postojeca rola)
```

RLS politike se prosiruju da provjeravaju `portfolio_access.scope` za svaki zahtjev — regional manager ne moze pristupiti podacima izvan svoje grupe ni ako zna restaurant_id.

**Definition of Done — Faza 10:**
- [ ] Brand sabloni se mogu kreirati i primjenjivati na objekte
- [ ] Manager objekta moze prihvatiti/odbiti sablon sa lokalnim izmjenama
- [ ] Regional manager ima ogranicen pristup samo svojoj grupi
- [ ] RLS politike pravilno provode cijelu hijerarhiju pristupa
- [ ] Notifikacije pri azuriranju sablona stizu odgovornim osobama

---

---

## Tehnička infrastruktura kroz sve faze

### Multi-tenancy skaliranje

Trenutna arhitektura (restaurant_id na svakoj tabeli + RLS) skalira dobro do ~500 tenanata. Iznad toga:

```
Opcija A: Supabase Pro plan — više compute, connection pooling
Opcija B: Dedicated Supabase instanca po velikom klijentu (enterprise)
Opcija C: Sharding po regiji (EU tenanti na EU Supabase projektu)
```

### Backup i disaster recovery

```bash
# Automatski Supabase backup (uključen na Pro planu)
# Dodatno — custom backup skripte
supabase db dump > backup_$(date +%Y%m%d).sql

# Point-in-time recovery dostupan na Supabase Pro
```

### Monitoring stack (post-launch)

```
Sentry          → Frontend error tracking (već u planu)
Supabase Logs   → DB query performance, slow queries
Uptime Robot    → Monitoring dostupnosti (besplatan tier)
PostHog         → Product analytics (besplatan do 1M events/mj)
```

---

---

## Timski razvoj

— preporuke

### Git workflow

```bash
# Preporučeni branch model
main          → produkcija, uvijek stabilan
develop       → integracija, testirano
feature/xyz   → novi moduli (hotel-core, booking-engine...)
fix/xyz       → bug fixovi
release/x.y   → priprema za deploy

# Feature branch workflow
git checkout develop
git checkout -b feature/hotel-core
# ... razvoj ...
git push origin feature/hotel-core
# → Pull Request → Code review → merge u develop
```

### Podjela posla (2 developera)

| Developer 1 | Developer 2 |
|-------------|-------------|
| Backend: DB schema, RLS, Edge Functions | Frontend: UI komponente, hooks |
| Billing infrastruktura | Addon moduli UX |
| Channel manager integracije | Mobilna aplikacija |
| DevOps, deployment, monitoring | Onboarding flow, korisničko iskustvo |

---

---

## Vizualni timeline

```
2026
│
├── Maj–Jun    [Etapa A / Faze 1–4]  Stabilizacija SmartMenija
│                                    Sigurnost, robusnost, optimizacija, post-launch
│
├── Jun–Aug    [Faza 5]  Billing infrastruktura
│                        Stripe, addon sistem, UpgradePrompt
│
├── Aug–Nov    [Faza 6]  Hotel Core
│                        Sobe, rezervacije, calendar, front desk, folio
│
├── Nov–Jan    [Faza 7]  Booking Engine
│                        Javna booking stranica, availability engine, plaćanje
│
2027
│
├── Jan–Feb    [Faza 8]  Housekeeping
│
├── Feb–Apr    [Faza 9]  Revenue Management
│                        ADR, RevPAR, dinamičke cijene
│
├── Apr–Aug    [Faza 10] Channel Manager
│                        Beds24 integracija, OTA sync
│
├── Jun–Sep    [Faza 11] Loyalty + Guest App
│
├── Sep+       [Faza 12] Mobilna aplikacija (React Native / Expo)
│
2028
│
├── Q1         [Faza 13] Portfolio Owner Dashboard
│                        Komandna tabla, KPI agregacija, alerting
│
└── Q2         [Faza 14] Brand & Regional Management
                         Hijerarhija pristupa, centralizovani šabloni
```

---

## Dnevnik napretka — Master

### Etapa A — Stabilizacija SmartMenija

| Faza | Zadatak | Status | Datum | Napomena |
|------|---------|--------|-------|----------|
| 1 | 1.1 .env audit | ⬜ | | |
| 1 | 1.2 Migracije sortirati | ⬜ | | |
| 1 | 1.3 RLS audit | ⬜ | | |
| 2 | 2.1 handleError utility | ⬜ | | |
| 2 | 2.2 Toast notifikacije | ⬜ | | |
| 2 | 2.3 LoadingSpinner | ⬜ | | |
| 2 | 2.4 useSupabaseQuery | ⬜ | | |
| 3 | 3.1 Code splitting | ⬜ | | |
| 3 | 3.2 Realtime cleanup | ⬜ | | |
| 3 | 3.3 Forma validacija | ⬜ | | |
| 3 | 3.4 Onboarding E2E test | ⬜ | | |
| 3.5 | 3.5.1 Memoizacija komponenti | ⬜ | | |
| 3.5 | 3.5.2 Debouncing na search | ⬜ | | |
| 3.5 | 3.5.3 DB indeksi + select kolonama | ⬜ | | |
| 3.5 | 3.5.4 Skeleton loaderi | ⬜ | | |
| 3.5 | 3.5.5 Optimistic updates | ⬜ | | |
| 3.5 | 3.5.6 Optimizacija slika | ⬜ | | |
| 4 | 4.1 Rate limiting / honeypot | ⬜ | | |
| 4 | 4.2 PayPal webhook function | ⬜ | | |
| 4 | 4.3 Sentry integracija | ⬜ | | |

### Etapa B — Hotelska platforma

| Faza | Zadatak | Status | Datum | Napomena |
|------|---------|--------|-------|----------|
| 5 | Stripe integracija + webhooks | ⬜ | | |
| 5 | Subscriptions tabela | ⬜ | | |
| 5 | Addon catalog u bazi | ⬜ | | |
| 5 | hasAddon() helper | ⬜ | | |
| 5 | UpgradePrompt komponenta | ⬜ | | |
| 6 | room_types + rooms tabele | ⬜ | | |
| 6 | hotel_reservations tabela | ⬜ | | |
| 6 | Availability calendar UI | ⬜ | | |
| 6 | Check-in / Check-out flow | ⬜ | | |
| 6 | Folio sistem | ⬜ | | |
| 6 | Restoran → folio integracija | ⬜ | | |
| 7 | Rate plans + seasonal rates | ⬜ | | |
| 7 | get_available_rooms() funkcija | ⬜ | | |
| 7 | Javna booking stranica | ⬜ | | |
| 7 | Stripe booking payment | ⬜ | | |
| 8 | Housekeeping tasks | ⬜ | | |
| 8 | Auto-task na check-out trigger | ⬜ | | |
| 9 | Revenue metrics view | ⬜ | | |
| 9 | Price suggestion algoritam | ⬜ | | |
| 10 | Beds24 API integracija | ⬜ | | |
| 11 | Loyalty program | ⬜ | | |
| 11 | Guest PWA | ⬜ | | |
| 12 | Expo projekt setup | ⬜ | | |
| 12 | Waiter + Kitchen mobilna app | ⬜ | | |

### Etapa C — Portfolio upravljanje

| Faza | Zadatak | Status | Datum | Napomena |
|------|---------|--------|-------|----------|
| 13 | portfolios + brands tabele | ⬜ | | |
| 13 | portfolio_kpis materialized view | ⬜ | | |
| 13 | Portfolio dashboard UI | ⬜ | | |
| 13 | Alert sistem (detect-portfolio-alerts) | ⬜ | | |
| 13 | Komparativna analitika | ⬜ | | |
| 13 | Konsolidovani izvještaji + valutna konverzija | ⬜ | | |
| 14 | Brand templates tabele | ⬜ | | |
| 14 | Primjena šablona na objekte | ⬜ | | |
| 14 | Regional manager RBAC + RLS | ⬜ | | |

---

*Master roadmap generisan spajanjem SmartMeni plana unapređenja i HospitalityOS hotel roadmapa — Maj 2026*
