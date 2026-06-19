# Specifikacija — Upravljanje stolovima za evente

**Modul:** `tables` · **Status dokumenta:** radna verzija
**Vezano za:** `restbyme_hotel_roadmap.md` (dnevnik napretka)
**Istorija:** sesija sa klijentom 2026-06-17; analiza + Faza 1 implementirana 2026-06-17.

> **Napomena o statusu (bitno):** raniji nacrt ovog dokumenta je Fazu 1 vodio kao
> „✅ implementirano" iako u repozitoriju ništa od toga nije postojalo (nije bilo ni
> migracije, ni helpera, ni testa; `git status` čist). Ova verzija je **ispravljena**:
> Faza 1 je STVARNO implementirana i testirana u sesiji 2026-06-17 (v. §4), a Faze 2/3/7
> ostaju specifikacija. Tabela ispod odražava stvarno stanje koda.

---

## 1. Problem i cilj

Trenutni `tables` modul rješava samo svakodnevni rad restorana (jedan fiksni raspored
stolova, QR/narudžbe, online rezervacije). Za **evente** (svadbe, proslave, banketi)
nedostaju četiri stvari:

1. **Više rasporeda stolova** (npr. standardni vs. svadbeni za 120 osoba) bez kvarenja
   rasporeda za live rad.
2. **Dodjela stola konobaru.**
3. **Spisak gostiju po stolu** (seating chart).
4. **Napomene po pojedinačnom gostu** (alergije, posebni zahtjevi).

| Faza | Šta | Status |
|------|-----|--------|
| 1 | Više rasporeda stolova (`table_layouts`) | ✅ **implementirano i testirano** 2026-06-17 |
| 1 (dodatak) | Vizuelni prikaz stolica oko stola (§7) | ✅ **implementirano i testirano** 2026-06-17 |
| 2 | Dodjela stola konobaru (`table_assignments`) | ✅ **implementirano i testirano** 2026-06-17 |
| 3 | Eventi + lista gostiju + napomene (`events`, `event_guests`) | ✅ **implementirano i testirano** 2026-06-17 |
| 3 (dodatak) | Integracija eventa sa `reservations` (§8.4) + §8.3 helper + §8.5 banner | ✅ **implementirano i testirano** 2026-06-17 |

**Ne-cilj:** ne dirati postojeću order/QR logiku (`orders.table_number` ostaje plain-text
snapshot, ne FK). Ne migrirati postojeće rezervacije — Faza 3 dodaje paralelan koncept
(event) pored `reservations`, ne zamjenjuje ga.

---

## 2. Trenutno stanje (verifikovano u kodu)

### 2.1 Relevantne tabele
- **`tables`** — `id, restaurant_id, number, label, x, y, width, height, shape,
  seats, status('free'|'occupied'|'calling')`. (Potvrđeno: koristi `seats`, nema
  `capacity`; `shape`/`status` su CHECK enumi.) Faza 1 dodaje `layout_id`.
- **`reservations`** — `table_id` (FK nullable), `table_number`, `guest_name`,
  `guest_phone/email`, `date`, `time`, `guests_count`, jedan `note`, `status`,
  `source('admin'|'online')`. (`duration_minutes` **ne postoji** kao kolona — Planner ga
  referencira ali se svodi na fiksnih 90 min; mrtvo polje.)
- **`staff`** — `id, restaurant_id, user_id, role_id → roles(permissions text[])`.
  Konobar = `roles.name='Konobar'` + permisija `view_tables` (`src/lib/permissions.js`).
- **`guests`/`guest_visits`** — CRM, nezavisan od seating chart-a; Faza 3 se opciono kači.

### 2.2 Mjesta koja čitaju `tables` — **SEDAM, ne šest**
Originalni nacrt je naveo šest i promašio sedmo (StaffPortal konobarski unos). Stvarna
lista (sve izmijenjeno u Fazi 1, §4.3):
`TableMapEditor.jsx`, `WaiterMapView.jsx`, `ReservationsPage.jsx`,
`OnlineReservationForm.jsx`, `TablesAnalytics.jsx`, `AnalyticsPage.jsx`,
**`src/pages/StaffPortal/views/NewOrderView.jsx`** ← bio izostavljen; live unos narudžbe.

### 2.3 Kritično ograničenje koje je oblikovalo arhitekturu
`orders.table_number` i `waiter_requests.table_number` su **plain text** (potvrđeno:
`baseline_schema.sql`), ne FK. `WaiterMapView`/`NewOrderView` poklapaju narudžbe sa stolom
isključivo po `table.number === order.table_number` (string match), **globalno po
restoranu**. Zato live tok mora uvijek gledati **tačno jedan** skup stolova — aktivan
layout — nikad uniju (dva layout-a sa istim „Sto 1" dala bi duple/pogrešne prikaze).

---

## 3. Arhitektonska odluka

Ne dira se `tables`/order/QR logika. Iznad nje sloj:

- **`table_layouts`** — imenovani raspored. Svaki `tables` red pripada tačno jednom
  layout-u. **Tačno jedan layout po restoranu je `is_active=true`** (partial unique index
  na DB nivou) — to je layout za live rad.
- Faze 2/3 se nadovezuju na `table_layouts`/`tables`.

---

## 4. FAZA 1 — Više rasporeda stolova ✅ (implementirano 2026-06-17)

### 4.1 Data model — `supabase/migrations/20260617120000_table_layouts.sql`
- Tabela `table_layouts (id, restaurant_id, name, is_active, created_at, updated_at)`.
- `CREATE UNIQUE INDEX … (restaurant_id) WHERE is_active` → najviše jedan aktivan.
- `ALTER TABLE tables ADD COLUMN layout_id … ON DELETE CASCADE`; DO-blok backfill kreira
  „Standardni raspored" (`is_active=true`) po restoranu i veže postojeće stolove; potom
  `SET NOT NULL`.
- **RLS (izmjena u odnosu na nacrt):** javno čitanje **suženo na `is_active`** —
  `USING (is_active OR <owner> OR is_superadmin())`. Vlasnik FOR ALL nad svojim. Razlog:
  guest online forma mora pročitati aktivan layout anonimno, ali imena **draft/event**
  layout-a (npr. „Svadba — Marko i Ana") ne smiju curiti anon korisnicima.
- **RPC (SECURITY DEFINER, eksplicitna ownership provjera, `42501` za neovlašćeno):**
  `set_active_table_layout(p_restaurant_id, p_layout_id)` (atomično skine stari, postavi
  novi — jedini dozvoljeni način mijenjanja `is_active`); `duplicate_table_layout(p_layout_id,
  p_new_name)` (klonira layout + stolove kao draft, status resetuje na `free`, vraća novi id).
- `updated_at` trigger (`public.set_updated_at()` reuse).

### 4.2 `TableMapEditor.jsx`
State `layouts/currentLayoutId/layoutBusy`. `loadLayouts()` zamjenjuje stari `loadTables()`:
učita sve layout-e, kreira default ako restoran nema nijedan, postavi `currentLayoutId` na
aktivan/prvi, pozove `loadTables(layoutId)` (filtrira `.eq('layout_id', layoutId)`).
Funkcije: `switchLayout`, `createLayout` (prompt), `duplicateLayout` (RPC), `renameLayout`,
`activateLayout` (RPC), `deleteLayout` (blok ako aktivan ili posljednji). `handleCanvasClick`
i `saveAll` nose `layout_id`. UI: layout traka (`<select>` + „· Aktivan", Draft badge,
dugmad Aktiviraj/Novi/Dupliraj/Preimenuj/Obriši). CSS klase `.layoutBar` … prate token sistem.

### 4.3 Live čitači — filtrirani na AKTIVAN layout (embed, ne helper)
**Odluka (izmjena u odnosu na nacrt):** umjesto `getActiveLayoutId()` helpera koji uvodi
zaseban serijski upit (waterfall na kritičnoj putanji — protiv `CLAUDE.md` §9), koristi se
**PostgREST embed inner-join filter** u svakom čitaču, što ostaje u postojećem `Promise.all`:
```js
supabase.from('tables').select('<kolone>, table_layouts!inner(is_active)')
  .eq('restaurant_id', id).eq('table_layouts.is_active', true)
```
Jedan upit, bez dodatnog round-tripa. Za anon (`OnlineReservationForm`) `!inner` + RLS
dodatno garantuju da se vide samo stolovi aktivnog (javno čitljivog) layouta.
Izmijenjeni: `WaiterMapView`, `ReservationsPage`, `OnlineReservationForm`, `TablesAnalytics`,
`AnalyticsPage`, **`NewOrderView`** (sedmi).

### 4.4 Test — `supabase/tests/055_table_layouts.sql` (NE 052 — bio zauzet)
`plan(7)`: (1) partial unique odbija drugi aktivan (`23505`); (2) RLS — B ne vidi A-jev
**draft** (aktivan je namjerno javan); (3) WITH CHECK izolacija (`42501`); (4)
`set_active_table_layout` odbija neovlašćenog (`42501`); (5) korektno prebacuje aktivan
flag; (6)+(7) `duplicate_table_layout` kreira draft pod novim imenom + klonira stolove.
UUID prostor `dddddddd-7117-7117-7117-7117711a…` (provjereno: ne preklapa se sa `seed.sql`
ni drugim testovima). **Status: PASS** (cijeli paket 259 testova zelen).

### 4.5 i18n — 14 ključeva dodato u svih 7 jezika
`tmeDefaultLayoutName, tmePromptLayoutName, tmeCopySuffix, tmeLayoutActive, tmeLayoutDraft,
tmeActivateLayout, tmeNewLayout, tmeDuplicateLayout, tmeRenameLayout, tmeDeleteLayout,
tmeLayoutActivated, tmeCantDeleteActive, tmeCantDeleteLast, tmeDeleteLayoutConfirm` — u
`{me,en,sr,hr,sq,tr,ru}/admin.json`. `scripts/i18n-check.mjs`: **OK**.

### 4.6 Edge slučajevi / odluke
- Brojevi stolova nisu globalno jedinstveni preko layout-a (namjerno). Implicitno jedinstveni
  unutar aktivnog (kao i do sada, nije DB constraint).
- Promjena aktivnog layout-a ne dira postojeće narudžbe (`orders.table_number` je snapshot).
- RPC su SECURITY DEFINER jer RLS ne pokriva „vidi sve, piši svoje" u jednom `UPDATE`-u;
  ownership se provjerava eksplicitno (nije shortcut — `CLAUDE.md` §1).

### 4.7 Šta NIJE u Fazi 1 (odgođeno, nije blokirajuće)
- [ ] Stolice oko stola (§7) — vizuelna nadogradnja, ide odvojeno.
- [ ] Dodavanje `table_layouts` u veliki `010_rls_isolation_matrix.sql` — `055` već
      samostalno pokriva RLS garanciju; konzistentnije ako se doda, ali nije blokirajuće.
- [ ] Manuelni regresioni test na pravoj app-i (QR/narudžba nakon promjene aktivnog layouta).

---

## 5. FAZA 2 — Dodjela stola konobaru ✅ (implementirano 2026-06-17)

> **Implementirano:** migracija `20260617130000_table_assignments.sql` (tabela + RLS +
> realtime), `TableAssignmentsPage.jsx` (`/admin/tables/assignments`, gejt `manage_tables`),
> WaiterMapView „Svi/Moji stolovi" toggle za staff + dugme „Dodjela stolova" za menadžere +
> realtime subscription, 13 i18n ključeva ×7, pgTAP `056` (RLS izolacija + konobar vidi samo
> svoje). **Odstupanja od nacrta:** `shift_id` i `event_id` **izostavljeni** (YAGNI — dodaju
> se kad zatrebaju; `event_id` u Fazi 3 kad `events` postoji). Build zelen (`TableAssignmentsPage`
> zaseban lazy chunk).

### 5.1 Data model — `table_assignments`
`id, restaurant_id (NOT NULL), table_id (FK→tables CASCADE), staff_id (FK→staff CASCADE),
date, shift_id (NULLABLE), event_id (FK→events CASCADE, NULLABLE), created_at`.
Unique `(table_id, date)` — jedan sto, jedan konobar po danu. **Ne** vezivati FK na
`work_schedules` (konobar može biti dodijeljen bez formalne smjene). Ako kasnije zatreba
više smjena istog stola istog dana → `shift_id` u unique key.

**RLS:** vlasnik upravlja. Razmotriti read-politiku da konobar (`auth.uid()=staff.user_id`)
čita SVOJE dodjele — potrebno za „Moji stolovi" filter u `WaiterMapView`.

### 5.2 Frontend
`WaiterMapView` toggle „Svi / Moji stolovi" (vidljiv samo staff-u, `usePlatform().staffProfile`).
Nova `TableAssignmentsPage` (ili sekcija u editoru): date picker + po stolu dropdown konobara
(ograničen na `view_tables` permisiju). Realtime: dodati `table_assignments` u
`supabase_realtime` + `REPLICA IDENTITY FULL` ako se želi instant sync.

### 5.3 Test — `056_table_assignments.sql` (NE 05X): RLS izolacija + konobar vidi samo svoje.

---

## 6. FAZA 3 — Eventi + lista gostiju + napomene ✅ (implementirano 2026-06-17)

> **Implementirano:** migracija `20260617140000_events.sql` (`events` + `event_guests` +
> `table_assignments.event_id`, RLS oba, updated_at trigger); `EventsPage.jsx`
> (`/admin/tables/events` — lista+filter po statusu, kreiranje uz izbor/„kopiraj aktivni"
> raspored preko `duplicate_table_layout`); `EventDetailPage.jsx`
> (`/admin/tables/events/:id` — read-only canvas event-layouta, gosti po stolu, dodaj/
> ukloni/rasjedi/skloni, **napomena po pojedinačnom gostu**, nerasjeđeni, status/notes eventa,
> brisanje); nav „Eventi" (+ „Dodjela stolova" iz Faze 2); 41 i18n ključ ×7; pgTAP `057`
> (RLS oba + kaskada event→event_guests + SET NULL na sto + CRM gost preživi). Build zelen.
> **Odstupanja:** seating je **klik-dropdown** (ne `@dnd-kit` drag) za v1 — jednostavnije,
> potpuno responsive; AI-prevod sadržaja se NE primjenjuje (event/gost podaci su interni admin,
> ne guest-facing meni). §8.4 reservations-overlay i §8.3 refaktor **odgođeni** kao dodatak.

### 6.1 Data model
**`events`:** `id, restaurant_id, name, date, layout_id (FK→table_layouts), status
('draft'|'confirmed'|'completed'|'cancelled'), expected_guests, notes, created_at, updated_at`.
**`event_guests`:** `id, event_id (CASCADE), restaurant_id (denormalizovano za RLS),
table_id (FK→tables SET NULL, NULLABLE), guest_id (FK→guests SET NULL, NULLABLE),
first_name, last_name, party_size, rsvp_status ('pending'|'confirmed'|'declined'),
notes (napomena po gostu — rješava tačku 4), created_at`. RLS: vlasnik upravlja, obje tabele.

### 6.2 Frontend
`EventsPage` (lista + „Novi event" → forma, izbor layouta ili „Dupliraj trenutni").
`EventDetailPage` (read-only canvas + lista gostiju po stolu, dodaj/ukloni/napomena;
`@dnd-kit` za drag ili dropdown; „Konobari po stolu" iz Faze 2).

### 6.3 Test — `057_events_guests.sql`: RLS izolacija + kaskada (brisanje eventa briše
`event_guests`, NE briše `tables`/`guests` — `SET NULL` provjera).

---

## 7. Vizuelni prikaz stolica oko stola (uvučene) ✅ (implementirano 2026-06-17)

> **Implementirano:** čista funkcija `src/lib/seatLayout.js` `getSeatPositions(shape,w,h,seats,inset=0)`
> (rect: hod po obimu; circle: po krugu) + Vitest `seatLayout.test.js` (7 testova: prazno/nevalidno,
> broj, na-obimu, inset, radijus, cap 40). Render u **4 canvasa** (3 iz spec + EventDetailPage iz
> Faze 3): `TableMapEditor`, `WaiterMapView`, `ReservationsPage`→`TablePicker` (manje 8px stolice,
> skalirane), `EventDetailPage`. Obrazac: `tableEl` omotan u `tableWrap` (nosi left/top/w/h), `tableEl`
> `position:absolute; inset:0; z-index:1`, stolice sibling `z-index:0; pointer-events:none` →
> tijelo stola prekrije unutrašnju polovinu („pogurana pod sto"). **Odstupanje od nacrta:** `inset`
> default **0** (centar na ivici, pola stolice viri) umjesto 7 — nacrtova geometrija (tableEl puni
> wrap + inset 7) bi potpuno sakrila stolice; default 0 daje traženi tucked izgled. Drag u editoru
> provjeren (build + handleri ostali na `tableEl`). Build zelen.

### Originalna specifikacija (referenca)

Cilj: na 3 canvas prikaza (`TableMapEditor`, `WaiterMapView`, `ReservationsPage`→`TablePicker`)
prikazati sjedišta kao male „stolice" oko stola, **uvučene** (blagi preklop sa ivicom, ne
lebde odvojeno). Guest forma nije kandidat (tamo je grid dugmića, ne prostorna mapa).

Zajednički čisti helper `src/lib/seatLayout.js` → `getSeatPositions(shape, w, h, seats, inset=7)`
(rect: hod po obimu uvučen za `inset`; circle: tačke po krugu radijusa `r-inset`). Renderuju se
kao sibling **ISPOD** tijela stola (niži z-index) → sto prekrije unutrašnji dio stolice.
Zahtijeva omotavanje `tableEl` u `tableWrap` (`position:relative`), `tableEl`→`absolute; inset:0`.

> **Oprez (izmjena naglaska):** `TableMapEditor` koristi custom drag (mouse + touch +
> auto-scroll). Omotavanje `tableEl` u wrapper mora se posebno regresiono provjeriti u
> editoru (koordinatni sistem drag/resize handlera) — nije „nizak rizik" tamo kao u
> read-only pogledima. `seatLayout.js` je čista funkcija → **obavezan Vitest unit** (`CLAUDE.md`).

CSS `.seat`: 12×12, `border-radius:4px`, `background:var(--c-surface)`, `border:1.5px solid
var(--c-border-input)`, `transform:translate(-50%,-50%)`, `z-index:0` (a `.tableEl` `z-index:≥1`).
Neutralna boja (ne prati status). v1 ograničenja: nema sudara pri puno sjedišta; uglovi
pravougaonika nisu posebno tretirani — prihvatljivo.

---

## 8. Integracija sa tokom rezervacija stolova

### 8.1 Kako rezervisanje radi danas (verifikovano)
**Gost** (`OnlineReservationForm`): grid dugmića „Sto N"; `checkConflicts(date,time)` upita
`reservations` (`pending|confirmed`, isti `date+time`) i disable-uje te stolove. Insert
`status='pending', source='online'`, prati realtime.
**Admin** (`ReservationsPage`): Lista / Kalendar / Planner (Gantt po `table_number`,
širina iz nepostojećeg `duration_minutes` → fiksno 90 min). Kreiranje kroz `TablePicker`
(prostorna mini-mapa); sto „rezervisan" samo ako `confirmed` na **isti `date`** (bez
provjere vremena). `saveReservation` **ne provjerava konflikt na serveru** (admin svjesno
smije preklopiti).

### 8.2 Već povezano sa Fazom 1
Oba flow-a čitaju samo stolove aktivnog layouta (embed filter, §4.3). Aktivacija event
layouta automatski mijenja stolove za biranje u oba toka — nema dodatnog rada.

### 8.3 Jaz: nekonzistentna provjera konflikta (preporuka)
Gost: `date+time` + (`pending,confirmed`); admin: `date` + (`confirmed`). Izvući u shared
helper `src/lib/reservationConflicts.js` → `getReservedTableIds(restaurantId, date, time=null,
statuses=['pending','confirmed'])` — refaktor bez promjene ponašanja (gost zove sa `time`;
admin bez `time` sa `statuses=['confirmed']`). Nizak rizik, može bilo kad.

> **✅ IMPLEMENTIRANO 2026-06-17 (overlay pristup, NE marker-rezervacije):**
> - `src/lib/reservationConflicts.js` (§8.3): `getReservedTableIds(restaurantId,date,time,statuses)`
>   (izvučena duplirana logika) + `getEventTableIds(restaurantId,date)` (potvrđen event →
>   `event_guests.table_id`).
> - `OnlineReservationForm.checkConflicts` i `ReservationsPage` `TablePicker` označavaju kao zauzete
>   i stolove potvrđenog eventa (unija). Calendar dobija 🎉 indikator na danima sa eventom.
>   **Bez ijednog upisa u `reservations`** — nema sync RPC-a ni skrivenih redova.
> - §8.5 banner: `components/shared/ActiveLayoutBanner` (ControlPanel dashboard + WaiterMapView) —
>   upozori kad aktivan layout nije najstariji (standardni) + „Vrati standardni" (RPC, gejt
>   `manage_tables`). i18n ×7. Build + 72 unit + pgTAP zeleno.

### 8.4 Veza rezervacija ↔ Eventi — **PREPORUČENA IZMJENA u odnosu na nacrt**
Nacrt je predlagao da event u status `confirmed` upisuje **„marker-rezervacije"** u
`reservations` (nova kolona `reservations.event_id`, RPC `sync_event_reservations`, skrivanje
edit/delete dugmadi). **Problem:** to ubacuje sintetičke redove u `reservations` — kritičnu,
naplatno-osjetljivu tabelu (`CLAUDE.md` §8) — uz rizik desinhronizacije sa `event_guests`.

**Preporuka:** Calendar/Planner **čita `events` direktno kao zaseban overlay sloj** (event-blok
po stolu), bez upisivanja u `reservations`. `getReservedTableIds` (§8.3) vraća uniju
(rezervacije + event-zauzeća iz `events`/`event_guests`) u memoriji. Nema sync RPC-a, nema
skrivenih redova, nema desynca. Ako se ipak izabere marker-pristup, zadržati ON DELETE CASCADE
na `event_id` i sakriti ručnu izmjenu marker-redova.

### 8.5 Operativno pravilo: aktivacija event layout-a na dan eventa
`is_active` je globalan flag, **nije vezan za datum**. Tok: (1) dan prije — event layout kao
**draft**; (2) ujutru na dan eventa — „Aktiviraj"; (3) poslije — reaktiviraj standardni.
Manuelno u v1. **Dopuna:** dodati vidljiv **banner na admin dashboardu** kad aktivan layout
nije „Standardni" (npr. „Aktivan raspored: Svadba — nije standardni"), da vlasnik ne zaboravi
vratiti. Buduća faza (van obima): `table_layouts.scheduled_active_date` + cron auto-aktivacija.

> **Poznato ograničenje modela:** globalni `is_active` serijalizuje cijeli restoran na jedan
> raspored — venue koji isti dan radi i redovan rad i event u zasebnoj sali ne može oboje
> istovremeno. Za ciljnu grupu (mali restoran koji zatvori redovan rad za event) prihvatljivo;
> zabilježeno kao eksplicitna pretpostavka.

### 8.6 Dopuna DoD za Fazu 3 (ako se ide marker-pristupom; preskočiti uz §8.4 overlay)
- [ ] (samo marker varijanta) migracija `reservations.event_id` + `sync_event_reservations()`.
- [ ] Test: event `confirmed` → zauzeće blokira sto u `getReservedTableIds`; `cancelled`/obrisan → nestaje.

---

## 9. Redosljed preostalog rada (DoD checklist)

1. ✅ Faza 1 (§4) — implementirana, `npm run db:reset` + `test db` (259) + unit (65) + i18n + build zeleno.
2. Stolice (§7) u 3 canvas prikaza + Vitest za `seatLayout.js` (oprez sa editor dragom).
3. Faza 2 (§5) + pgTAP `056` prije merge-a (RLS izolacija obavezna).
4. Faza 3 (§6) + §8.4 overlay (preporučeno) + pgTAP `057`.
5. Refaktor §8.3 (`getReservedTableIds`) — nezavisno, nizak rizik.
6. Banner za aktivan ne-standardni layout (§8.5).
7. Nakon svake faze — ažurirati `restbyme_hotel_roadmap.md`.
8. `supabase db push` PRIJE `git push` (fiksni redosljed deploya, `CLAUDE.md`).
