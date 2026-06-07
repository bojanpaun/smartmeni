-- ============================================================================
-- sell_retail_to_folio — folio stavka + skidanje zaliha + guardi
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('ret_a');
SELECT tests.create_supabase_user('ret_b');
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-5252-5252-5252-525252525252', tests.get_supabase_uid('ret_a'), 'RET A', 'ret-a'),
  ('bbbbbbbb-5252-5252-5252-525252525252', tests.get_supabase_uid('ret_b'), 'RET B', 'ret-b');

INSERT INTO public.spa_retail_items (id, restaurant_id, name, price, stock_quantity)
  VALUES ('cccccccc-5252-5252-5252-525252525252', 'aaaaaaaa-5252-5252-5252-525252525252', 'Ulje', 20, 5);
INSERT INTO public.folios (id, restaurant_id, status)
  VALUES ('dddddddd-5252-5252-5252-525252525252', 'aaaaaaaa-5252-5252-5252-525252525252', 'open');

-- Prodaja 2 kom (vlasnik A)
SELECT tests.authenticate_as('ret_a');
SELECT public.sell_retail_to_folio('cccccccc-5252-5252-5252-525252525252', 'dddddddd-5252-5252-5252-525252525252', 2);

SELECT tests.authenticate_as_service_role();
-- (1) Zaliha skinuta 5 → 3
SELECT is(
  (SELECT stock_quantity FROM public.spa_retail_items WHERE id = 'cccccccc-5252-5252-5252-525252525252'),
  3,
  'Zaliha skinuta na 3 nakon prodaje 2 kom');
-- (2) Folio stavka kreirana sa total 40.00
SELECT is(
  (SELECT total_price FROM public.folio_items WHERE folio_id = 'dddddddd-5252-5252-5252-525252525252'),
  40.00::numeric,
  'Folio stavka total = 40.00 (2 × 20)');

-- (3) Iznad zaliha → odbijeno
SELECT tests.authenticate_as('ret_a');
SELECT throws_ok(
  $$ SELECT public.sell_retail_to_folio('cccccccc-5252-5252-5252-525252525252', 'dddddddd-5252-5252-5252-525252525252', 10) $$,
  'Nedovoljno zaliha',
  'Prodaja iznad zaliha je odbijena');

-- (4) Tuđi proizvod/folio → nema pristup
SELECT tests.authenticate_as('ret_b');
SELECT throws_ok(
  $$ SELECT public.sell_retail_to_folio('cccccccc-5252-5252-5252-525252525252', 'dddddddd-5252-5252-5252-525252525252', 1) $$,
  'Nemate pristup',
  'Vlasnik B ne može prodavati na A folio');

SELECT * FROM finish();
ROLLBACK;
