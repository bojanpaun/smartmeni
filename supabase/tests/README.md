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

## Plan Sloja 1 (po riziku iz "Kritične funkcionalnosti")

- [x] **RLS izolacija** — `001_rls_isolation_hotel_reservations.sql`
      (šablon: kopirati za `guests`, `folios`, `orders`, `spa_appointments`)
- [x] **Overbooking** — `002_overbooking_create_booking_direct.sql`
      (preklapajuća rezervacija odbijena; zaštita živi u `fn_auto_assign_room`)
- [x] **Folio** — `003_folio_spa_charge.sql`
      (spa termin na folio → tačna stavka; gotovinski → bez stavke; trigger `trg_spa_folio`)

## Kasnije: CI gate

Pošto se pušta pravo na `main`, vrijedi vezati ove testove za GitHub Actions na
push/PR — padne test ⇒ crveni X prije produkcije:

```yaml
name: DB tests
on: { push: { branches: [main] }, pull_request: { branches: [main] } }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase test db
```
