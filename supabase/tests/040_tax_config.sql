-- ============================================================================
-- DB test: tax_config RLS — superadmin piše, ne-superadmin ne; svi prijavljeni
-- čitaju (FISK-1 — globalna poreska konfiguracija). Šablon: 039.
-- Pokretanje: supabase test db   (radi u BEGIN ... ROLLBACK)
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('tax_sa');
SELECT tests.create_supabase_user('tax_obican');

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('tax_sa'), true)
ON CONFLICT (id) DO UPDATE SET is_superadmin = true;

INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('tax_obican'), false)
ON CONFLICT (id) DO UPDATE SET is_superadmin = false;

-- ── Test 1: superadmin može INSERT (nova država) ────────────────────────────
SELECT tests.authenticate_as('tax_sa');
SELECT lives_ok(
  $$ INSERT INTO public.tax_config (country, currency, rates)
     VALUES ('XX', 'EUR', '[{"key":"STANDARD","value":0.20,"label":"Std"}]'::jsonb) $$,
  'Superadmin može upisati poresku konfiguraciju države'
);

-- ── Test 2: običan korisnik NE može INSERT (RLS) ────────────────────────────
SELECT tests.authenticate_as('tax_obican');
SELECT throws_ok(
  $$ INSERT INTO public.tax_config (country, currency, rates)
     VALUES ('YY', 'EUR', '[{"key":"STANDARD","value":0.20,"label":"Std"}]'::jsonb) $$,
  '42501',
  NULL,
  'Običan korisnik ne može upisati tax_config (RLS odbija)'
);

-- ── Test 3: prijavljeni korisnik MOŽE čitati ME seed ────────────────────────
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.tax_config WHERE country = 'ME' $$,
  ARRAY[1],
  'Prijavljeni korisnik čita ME poresku konfiguraciju'
);

-- ── Test 4: ME seed ima 3 stope i EUR ───────────────────────────────────────
SELECT results_eq(
  $$ SELECT currency, jsonb_array_length(rates) FROM public.tax_config WHERE country = 'ME' $$,
  $$ VALUES ('EUR', 3) $$,
  'ME seed: EUR + 3 poreske stope (STANDARD/HOSP/BASIC)'
);

SELECT * FROM finish();
ROLLBACK;
