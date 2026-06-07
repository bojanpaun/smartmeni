# Testovi baze (Sloj 1)

pgTAP testovi koji provjeravaju kritične invarijante direktno u Postgresu —
RLS izolaciju, overbooking, folio kalkulacije. Ovo je sloj s najvećim ROI-jem
jer kompleksna logika namjerno živi u DB funkcijama/politikama, ne u UI-ju.

Svaki test radi u `BEGIN ... ROLLBACK`, pa se ništa ne upisuje u pravu bazu.

## Preduslovi

1. **Docker** pokrenut + **Supabase CLI** instaliran.
2. U korijenu projekta: `supabase start` (digne lokalni Postgres sa svim migracijama).

Nema drugih preduslova. **Test helperi** (`tests.create_supabase_user`, `authenticate_as`,
`get_supabase_uid`, `rls_enabled`, ...) su **vendorovani** u `0000_setup_test_helpers.sql` —
taj fajl se po abecedi učitava prvi i kreira `tests` schemu, pa svi ostali testovi koriste
helpere direktno. Bez `dbdev`-a, bez `CREATE EXTENSION`, bez mrežnog koraka — deterministički
i lokalno i u CI-ju.

## Pokretanje

```bash
supabase test db        # pokrene sve .sql fajlove iz supabase/tests/
```

Predlog: dodaj u `package.json` skripte → `"test:db": "supabase test db"`.

## Konvencije

- Fajlovi se izvršavaju **alfabetski** → prefiks brojem (`001_`, `002_`, ...).
- Jedan fajl = jedna oblast/tabela. Naziv jasno kaže šta testira.
- Svaki fajl: `BEGIN; plan(N); ... finish(); ROLLBACK;` (helperi dolaze iz `0000_` setupa).
- Broj u `plan(N)` mora odgovarati broju asercija (inače pgTAP prijavi grešku).

## Šta je pokriveno

**Meta-guardi (samoodržavajući, preko `pg_catalog` — pokrivaju SVE tabele):**
- [x] `000_rls_enabled_all_tables` — RLS uključen na svim tabelama
- [x] `004_tenant_id_no_orphans` — nijedan red `restaurant_id IS NULL`
- [x] `011_tenant_fk_guard` — svaka `restaurant_id`: NOT NULL + FK na `restaurants`

**RLS izolacija:**
- [x] `001_rls_isolation_hotel_reservations` — šablon (A ne vidi/mijenja B)
- [x] `010_rls_isolation_matrix` — **svih 23 tenant tabele**: SELECT-izolacija (privatne)
      + DELETE-izolacija (sve; before/after, otporno na auto-trigere)

**Kritični tokovi:**
- [x] `002_overbooking_create_booking_direct` — preklapanje odbijeno
- [x] `003_folio_spa_charge` — spa → folio stavka (trigger `trg_spa_folio`)
- [x] `005_import_recipe_from_library` — import RPC (happy/idempotent/odbijanje/starter)
- [x] `012_guest_auto_trigger` — rezervacija s emailom → auto-kreira/povezuje gosta

**2b tenant model:**
- [x] `013_tenants` — tenants RLS izolacija + backfill integritet
- [x] `014_tenants_mirror` — mirror trigger restaurants→tenants (account polja)
- [x] `015_tenant_verticals` — `restaurants.active_verticals` default + guard
- [x] `016_public_verticals` — anon čita `active_verticals` (guest routing)
- [x] `017_add_vertical_isolation` — owner mijenja vlastite vertikale, tuđe ne može

## CI gate — AKTIVAN

Vezano za GitHub Actions (`.github/workflows/tests.yml`, job `database`): `supabase start`
+ `supabase test db` na svaki push/PR. Padne test ⇒ crveni X prije produkcije.
