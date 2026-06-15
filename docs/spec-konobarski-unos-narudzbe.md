# Spec — Konobarski unos narudžbe (StaffPortal) · v1.1 (korigovano)

**Modul:** restoran vertikala · StaffPortal · **Status:** spremno za implementaciju
**v1.1 izmjene naspram v1.0:** podignut prioritet/opseg RLS-a (postojeći bug, ne samo preduslov),
reorder faza (šema A+B prije RPC-a), ispravke (reject je status-gated; total je concurrency-safe),
zaključena otvorena pitanja. Verifikovano naspram koda 2026-06-15.

---

## 1. Cilj
Dodati **konobarski unos narudžbe** u `WaiterView` (portal zaposlenih). Konobarska narudžba
proizvodi **identičan oblik podataka** kao gostova (`orders` + `order_items`), pa cijeli nizvodni
tok (kuhinja/šank realtime, status flow, charge-to-room, fiskalizacija, analitika) radi bez izmjena.
Glavni dodatni zahtjev: **konobar PRVO bira sto, pa unosi stavke.** Pravimo jednu novu ulaznu
površinu, ne novi podsistem.

## 2. Opseg (v1 MVP)
1. Dugme **„+ Nova narudžba"** u `WaiterView` (tab „Narudžbe").
2. **Korak 1 — izbor stola** iz `tables` (slobodan/zauzet indikator).
3. **Korak 2 — unos stavki** (kategorije + stavke menija, +/− količina, opciona napomena po stavci).
4. **Slanje** preko atomarne RPC `waiter_submit_order` → narudžba direktno u `preparing`,
   routing kuhinja/šank po `categories.is_bar`.
5. Zauzet sto → **dopuna** otvorene narudžbe (default); + dugme „Nova zasebna" (`p_mode='new'`).
6. `source='waiter'` za razlikovanje/analitiku.

**Van opsega (kasnije):** vizuelna mapa stolova (Faza 2, reuse `tables.x/y/shape`), podjela/premještanje
stavki, plaćanje gosta na licu mjesta (Faza PAY), uređivanje stavke nakon slanja (storno već postoji).

## 3. UX — tri ekrana u `WaiterView` (lokalni `mode`, bez nove rute/taba)
- **A — Lista narudžbi (postojeća):** sticky `+ Nova narudžba` → B.
- **B — Izbor stola (1/2):** mreža iz `tables` (sort `number`); status **Slobodan/Zauzet**
  (*zauzet* = postoji `orders` red za taj sto sa `status <> 'closed'` — izvedeno, pouzdanije od
  `tables.status`). Tap sto → C. Kad je sto zauzet, ponudi i „Nova zasebna narudžba".
- **C — Unos stavki (2/2):** ako sto ima otvorenu narudžbu → natpis „Dopuna #REF". Pilule kategorija
  (`sort_order`), lista stavki (naziv+cijena, stepper), opciona napomena po stavci. Dno: „X stavki"
  + **Pošalji · €UKUPNO**. Tap Pošalji → RPC → nazad na A, toast „Narudžba poslata na pripremu".
  **Prikaz stola = `label` ako postoji, inače broj; ali u `orders.table_number` se UPISUJE broj
  kao string** (poklapanje sa gostom/QR + detekcija zauzetosti).

## 4. Zaključene odluke
| # | Odluka |
|---|--------|
| 1 | Početni status waiter-narudžbe = **`preparing`** (nema prihvati/odbij koraka). |
| 2 | Routing po **`categories.is_bar`** → `kitchen_status`/`bar_status='preparing'`. |
| 3 | Dodati **`orders.source`** (`guest`/`waiter`) + **`created_by_staff_id`**. |
| 4 | **Izbor stola je prvi korak**, iz `tables`. |
| 5 | Zauzet sto → **dopuna** (default `auto`); + eksplicitno **„Nova zasebna"** (`p_mode='new'`). |
| 6 | Sva logika (insert+total+routing+append) u **jednoj atomarnoj RPC** (`SECURITY INVOKER`). |
| 7 | **Display = `label`/broj; stored `table_number` = broj kao string** (konzistentnost s gostom). |
| 8 | Permisija v1 = reuse **`view_orders`** (bez nove `create_orders` dok ne zatreba). |
| 9 | „1 otvorena narudžba po stolu" = **meka konvencija** (RPC uzima najnoviju); bez tvrde blokade u v1. |

## 5. Model podataka — Migracija A (`orders` metapodaci)
`orders`/`order_items` se reuse-uju. `order_items.note` već postoji. `preparing` već u
`orders_status_check` (bez izmjene constraint-a — **potvrđeno**).
```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'guest'
    CHECK (source IN ('guest','waiter')),
  ADD COLUMN IF NOT EXISTS created_by_staff_id uuid REFERENCES public.staff(id);
CREATE INDEX IF NOT EXISTS idx_orders_open_by_table
  ON public.orders (restaurant_id, table_number) WHERE status <> 'closed';
COMMENT ON COLUMN public.orders.source IS
  'Ko je kreirao narudžbu: guest (QR/online) ili waiter (ručni unos u portalu).';
```
> `orders.table_number` je **text**, `tables.number` **integer** → upisati `number::text`.

## 6. RLS — ⚠️ KRITIČNO (Migracija B): postojeći bug, ne samo preduslov
**Potvrđeno u kodu:** StaffPortal loguje svako osoblje preko `supabase.auth.signInWithPassword`
(`StaffPortal.jsx`), pa je `auth.uid()` = nalog konobara, **ne** vlasnika. A SVE UPDATE politike na
`orders`/`order_items` su **owner-only** (`auth.uid() = restaurants.user_id`; politika „Osoblje
upravlja stavkama" je pogrešno imenovana — i ona je owner-check). INSERT i SELECT su otvoreni.

**Posljedica (vjerovatno već živi bug):** za osoblje koje nije vlasnik **tiho padaju** (0 redova,
bez greške, maskirano optimističnim `setState`-om): promjena statusa narudžbe, odbijanje,
charge-to-room order-update, te `kitchen_status`/`bar_status` iz KitchenView/BarView.

**→ Migracija B je zaseban, prioritetan zadatak** (popravlja cijeli portal), radi se PRVA i
verifikuje ručno sa pravim staff nalogom (ne vlasnikom).
```sql
CREATE POLICY "Osoblje azurira narudzbe" ON public.orders
  FOR UPDATE TO authenticated
  USING      (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active))
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active));
CREATE POLICY "Osoblje azurira stavke" ON public.order_items
  FOR UPDATE TO authenticated
  USING      (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active))
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.staff
                                WHERE user_id = auth.uid() AND is_active));
```
Obrazac membership-a je već u upotrebi (`hotel_core`/`housekeeping`/`spa`/`breakfast`). Time RPC iz §7
može biti **`SECURITY INVOKER`** (CLAUDE.md: DEFINER samo za anon). Ne dirati otvoreni guest-insert.

**DoD:** pgTAP `001_rls_isolation_*` — staff tenanta A ne piše/mijenja narudžbe tenanta B.

## 7. RPC `waiter_submit_order` (SECURITY INVOKER, atomarna)
Potpis i logika kao u v1.0 (nepromijenjeno):
```sql
waiter_submit_order(p_restaurant_id uuid, p_table text, p_items jsonb,
                    p_mode text DEFAULT 'auto')  -- 'auto'|'new'|'append'
RETURNS public.orders
```
- `auto`: dopuni otvorenu narudžbu stola ako postoji, inače nova. `new`: uvijek nova. `append`: greška ako nema otvorene.
- Bar set: `category_id ∈ (categories WHERE restaurant_id=? AND is_bar)`.
- Nova: `status/kitchen_status/bar_status='preparing'` (po stanicama koje stavke pogađaju), `source='waiter'`, `created_by_staff_id`, `total=Σ price·qty`.
- Dopuna: `total = total + Δ` (**concurrency-safe** — row-lock na UPDATE-u; nije „last-write-wins"); `ready/served → preparing`; podigni stanične statuse.
- Cijena snapshot u `order_items.price`. Validacija članstva u funkciji (defense-in-depth: `staff … user_id=auth.uid() AND is_active`, inače `RAISE EXCEPTION 'not_active_staff'`).

(Skeleton funkcije = isti kao v1.0 §7; doraditi i pokriti testom.)

**DoD (pgTAP):** happy (nova: status/routing/total/stavke) · odbijanje (`not_active_staff`) · append (Δ total, `served→preparing`, bar routing).

## 8. Frontend
| Fajl | Akcija |
|------|--------|
| `src/modules/menu/hooks/useMenuData.js` *(razmotriti `hooks/` ako se širi)* | **novo** — `categories`(sort_order)+`menu_items`(`is_visible=true`,sort_order); vraća kategorije i mapu stavki. |
| `src/pages/StaffPortal/views/NewOrderView.jsx` | **novo** — `step:'table'|'menu'`; `tables`+zauzetost; korpa; RPC `waiter_submit_order`. |
| `src/pages/StaffPortal/views/WaiterView.jsx` | izmjena — lokalni `mode:'list'|'new'`; dugme; render `NewOrderView`. |
| `src/pages/StaffPortal/StaffPortal.module.css` | izmjena — mreža stolova, pilule, stepper, korpa-traka (bez cross-importa). |
| `src/i18n/locales/{7}/staffportal.json` | izmjena — novi ključevi (§9). |

> **Napomena:** skrivanje reject-a za `source='waiter'` je **opciono** — reject-dugmad se ionako
> renderuju samo za `status ∈ {pending,received}`, a waiter-narudžba je uvijek `preparing`. Nije DoD.

`WaiterView` već prima `restaurant` prop; proslijediti `restaurant`/`restaurant.id` u `NewOrderView`.
Upiti i gating = kao v1.0 §8 (potvrđene kolone: `menu_items.is_visible/emoji/sort_order`, `categories.icon/sort_order/is_bar`).

## 9. i18n (namespace `staffportal`, svih 7 jezika, `i18n-check` gate)
Ključevi: `newOrder, pickTable, stepTableOf, tableFree, tableBusy, orderItems, addItemsHint,
sendOrder, appendToOrder, itemNote, orderSentToast, newSeparateOrder`.
Sloj B (AI prevod) **nije potreban** — portal je za osoblje (vidi `me` izvor); napomena po stavci je runtime unos.

## 10. Realtime
Bez novog kanala — postojeći `waiter-portal-${restaurantId}` već hvata `orders` INSERT/UPDATE.
Preduslov (već zadovoljen jer status-update realtime radi): `orders` u publikaciji + `REPLICA IDENTITY FULL`.

## 11. Edge slučajevi (recap + ispravke)
- Prazna korpa → „Pošalji" disabled. · Promjena stola → nazad na 1, korpa ostaje. · Dupli tap → disable tokom `await`.
- Zauzet sto → `auto` dopuna ILI „Nova zasebna". · Više otvorenih → RPC uzima najnoviju.
- **Konkurentnost:** `total = total + Δ` je row-safe (saberu se); pravi race = dva „nova" za isti slobodan sto → dvije narudžbe (prihvatljivo v1).
- **Append na gost-narudžbu:** zauzet sto može biti `source='guest'`; `auto` dodaje u taj red (mješovita narudžba — svjesno).
- Cijena snapshot u `order_items.price`.

## 12. Faze implementacije (REDOSLIJED) i DoD
1. **Šema:** Migracija A (`source`/`created_by_staff_id`/index) **+** Migracija B (staff RLS). pgTAP RLS izolacija. Ručna verifikacija portala sa staff nalogom.
2. **RPC** `waiter_submit_order` + pgTAP (happy/append/odbijanje).
3. **`useMenuData`** + Vitest (grupisanje po kategoriji; total korpe round 2 decimale).
4. **`NewOrderView` + WaiterView** + i18n (7) + CSS (375px/dark) + realtime provjera.
5. Roadmap dnevnik update.

`npm run check` prije pusha; **`db:push` PRIJE `git push`**.

## 13. Cross-vertikalno (SMJER, ne v1 scope)
Princip: za svaki gost-„kreiraj" tok postoji staff-ekvivalent koji zove **istu RPC**; logika u RPC,
dva tanka klijenta; operativni „kreiraj" ide u **portal, ne admin** (admin = menadžerska površina;
otvaranje admina za staff = ogroman RLS blast radius). Faze poslije restorana:
- **Faza H (hotel walk-in):** `ReceptionView` → `create_booking_direct` (staff-mode). Gating `checkin_checkout`.
- **Faza S (spa walk-in):** `SpaView` → `book_spa_appointment` (staff-mode). Gating `view_appointments`.
- **Cleanup:** admin `ReservationForm` prebaciti na `create_booking_direct` (jedan izvor istine).
- **Extract u `components/shared/`:** `GuestPicker` + shell/CSS step-sheet-a. **Bez** generičke „creation engine" apstrakcije (domeni prerazličiti).
- Staff-mode po vertikali: opcioni gost-email/plaćanje, `source`/`created_by_staff_id` atribucija, provjeriti staff RLS (ekvivalent Migracije B) na `hotel_reservations`/`spa_appointments`.
> Drži kao budući rad — ne počinjati GuestPicker apstrakciju dok restoran v1 ne slegne.
