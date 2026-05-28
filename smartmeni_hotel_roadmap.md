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

## Faze razvoja

---

## Faza 0 — Stabilizacija SmartMenija *(trenutno u toku)*

> **Uslov za nastavak:** Sve tačke iz `smartmeni_plan.md` su završene.

**Cilj:** Stabilan, siguran, performantan restoran SaaS spreman za prve plaćajuće korisnike.

**Ključni output:**
- Migracije uređene, RLS provjeren
- Error handling, toastovi, loading stanja
- Code splitting, optimizacija
- Onboarding flow radi end-to-end

**Trajanje:** 2–4 sedmice (solo ili u paru)

---

## Faza 1 — Restoran SaaS polish + billing infrastruktura

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

## Faza 2 — Hotel Core modul (`hotel_core`)

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

## Faza 3 — Booking Engine (`booking_engine`)

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

## Faza 4 — Housekeeping modul (`housekeeping`)

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

## Faza 5 — Revenue Management (`revenue_mgmt`)

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

## Faza 6 — Channel Manager (`channel_manager`)

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

## Faza 7 — Mobilna aplikacija

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

## Faza 8 — Loyalty program + Guest App (`loyalty`, `guest_app`)

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


## Faza 9 — Portfolio Owner modul (`portfolio_owner`)

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

## Faza 10 — Brand & Regional Management (`brand_mgmt`, `regional_mgmt`)

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

## Timski razvoj — preporuke

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

## Roadmap timeline (vizualni pregled)

```
2026
│
├── Maj–Jun    [Faza 0] SmartMeni plan završen, stabilizacija
│
├── Jun–Aug    [Faza 1] Billing infrastruktura + restoran polish
│                       Stripe integracija, addon sistem, UpgradePrompt
│
├── Aug–Nov    [Faza 2] Hotel Core modul
│                       Sobe, rezervacije, calendar, front desk, folio
│
├── Nov–Jan    [Faza 3] Booking Engine
│                       Javna booking stranica, availability engine, plaćanje
│
2027
│
├── Jan–Feb    [Faza 4] Housekeeping modul
│
├── Feb–Apr    [Faza 5] Revenue Management
│                       ADR, RevPAR, dinamičke cijene
│
├── Apr–Aug    [Faza 6] Channel Manager
│                       Beds24 integracija, OTA sync
│
├── Sep+       [Faza 7] Mobilna aplikacija (React Native / Expo)
│
├── TBD        [Faza 8] Loyalty + Guest App
│
├── TBD        [Faza 9] Portfolio Owner Dashboard
│                       Komandna tabla, KPI agregacija, alerting
│
└── TBD        [Faza 10] Brand & Regional Management
                        Hijerarhija pristupa, centralizovani sabloni
```

---

## Dnevnik napretka — Hotel roadmap

| Faza | Zadatak | Status | Datum | Napomena |
|------|---------|--------|-------|----------|
| 1 | Stripe integracija + webhooks | ⬜ | | PayPal implementiran umjesto Stripea |
| 1 | Subscriptions tabela | ✅ | 2026-05 | `subscriptions` tabela sa `addons` JSONB arraym |
| 1 | Addon catalog u bazi | ✅ | 2026-05 | `addon_catalog` tabela, SuperAdmin panel override |
| 1 | hasAddon() helper | ✅ | 2026-05 | `planUtils.js`, enterprise plan dobija sve |
| 1 | UpgradePrompt komponenta | ✅ | 2026-05 | `AddonGuard` + `UpgradePrompt`, fullPage varijanta |
| 2 | room_types + rooms tabele | ✅ | 2026-05 | RLS, migracije aplicirane |
| 2 | hotel_reservations tabela | ✅ | 2026-05 | Svi statusi: inquiry→confirmed→checked_in→checked_out |
| 2 | Availability calendar UI | ✅ | 2026-05 | Gantt-style, 14 dana, navigacija sedmicama |
| 2 | Check-in / Check-out flow | ✅ | 2026-05 | FrontDeskPage, auto folio kreiranje pri check-inu |
| 2 | Folio sistem | ✅ | 2026-05 | FolioPage, dodavanje/brisanje stavki, zatvaranje folija |
| 2 | Restoran → folio integracija | ✅ | 2026-05 | "Naplati na sobu" u WaiterDashboard, `orders.folio_id` |
| 3 | Rate plans + seasonal rates | ⬜ | | |
| 3 | get_available_rooms() funkcija | ⬜ | | |
| 3 | Javna booking stranica | ⬜ | | |
| 3 | Stripe booking payment | ⬜ | | |
| 4 | Housekeeping tasks | ⬜ | | |
| 4 | Auto-task na check-out trigger | ⬜ | | |
| 5 | Revenue metrics view | ⬜ | | |
| 5 | Price suggestion algoritam | ⬜ | | |
| 6 | Beds24 API integracija | ⬜ | | |
| 7 | Expo projekt setup | ⬜ | | |
| 7 | Waiter + Kitchen mobilna app | ⬜ | | |
| 8 | Loyalty program | ⬜ | | |
| 8 | Guest PWA | ⬜ | | |
| 9 | portfolios + brands tabele | ⬜ | | |
| 9 | portfolio_kpis materialized view | ⬜ | | |
| 9 | Portfolio dashboard UI | ⬜ | | |
| 9 | Alert sistem (detect-portfolio-alerts) | ⬜ | | |
| 9 | Komparativna analitika | ⬜ | | |
| 9 | Konsolidovani izvjestaji + valutna konverzija | ⬜ | | |
| 10 | Brand templates tabele | ⬜ | | |
| 10 | Primjena sablona na objekte | ⬜ | | |
| 10 | Regional manager RBAC + RLS | ⬜ | | |

---

*Roadmap generisan uz analizu SmartMeni arhitekture i hospitality industry best practices — Maj 2026*
