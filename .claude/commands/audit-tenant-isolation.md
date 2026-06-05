---
description: Audit tenant-izolacije — nalazi gdje restaurant_id/RLS fali (READ-ONLY)
allowed-tools: Read, Grep, Glob, Bash(supabase:*), Bash(psql:*)
---

Uradi **READ-ONLY** audit JEDNE invarijante: svaki tenant podatak mora nositi
`restaurant_id` i biti pokriven RLS-om (pravilo §1 iz CLAUDE.md).
NE uređuj i ne kreiraj nijedan fajl — isključivo izvještaj.

## Princip
- Svaki nalaz je OSUMNJIČENI, ne presuda. Tekstualna pretraga laže (poravnati
  razmaci, velika/mala slova). Svaki sumnjivi nalaz POTVRDI protiv stvarne baze
  (`information_schema` / `pg_catalog`), ne protiv teksta migracija.
- Hotspot su `SECURITY DEFINER` funkcije i trigeri: oni zaobilaze RLS, pa
  propušten `restaurant_id` ne baca grešku — samo tiho upiše red bez tenant veze
  (tačno kako je nastao bug u `create_spa_folio_item`).

## Korak 1 — tenant tabele
Iz šeme izlistaj sve tabele u `public` koje imaju kolonu `restaurant_id`.
To su "tenant tabele" i predmet su audita.

## Korak 2 — audit KODA (potvrdi svaki nalaz protiv baze)
1. INSERT-i u `supabase/migrations/` (trigeri, RPC — naročito `SECURITY DEFINER`)
   u tenant tabelu koji NE postavljaju `restaurant_id`.
2. Supabase pozivi u `src/` (`.insert/.update/.delete/.select`) na tenant tabele
   bez `.eq('restaurant_id', ...)`.
3. Tabele koje imaju `CREATE POLICY` ali nemaju `ENABLE ROW LEVEL SECURITY`
   (uspavane politike — RLS isključen, politike se ignorišu).

## Korak 3 — audit PODATAKA
Ako je `supabase start` aktivan, izvrši nad lokalnom bazom upit koji za svaku
tenant tabelu broji redove gdje je `restaurant_id IS NULL`. Ako lokalna baza
nema realne podatke, ISPIŠI gotove read-only `SELECT` upite koje korisnik može
pokrenuti nad produkcijom u Supabase SQL editoru.

## Izvještaj (format)
Tabela poređana po ozbiljnosti (novac/podaci prvo, pa ostalo):

| Ozbiljnost | Lokacija (fajl:linija ili funkcija) | Tabela | Problem | Predlog ispravke |

Na kraju, jasno razdvoji:
- (a) POTVRĐENI nalazi (provjereni protiv baze),
- (b) odbačeni osumnjičeni i zašto (false positives),
- (c) za najopasniju klasu PREDLOŽI — ne piši — trajni pgTAP/data guard koji bi
  je hvatao ubuduće.
