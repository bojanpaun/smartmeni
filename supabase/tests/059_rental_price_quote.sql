-- ============================================================================
-- DB test: rental_quote_price — sezonski override po danu, fallback base_price,
-- cleaning_fee + boravišna taksa, najuži opseg pobjeđuje, nevalidan period. ROLLBACK.
-- UUID prostor dddddddd-9229-… (slobodan).
-- ============================================================================

BEGIN;
SELECT plan(6);

SELECT tests.create_supabase_user('rq_a');

INSERT INTO restaurants (id, user_id, name, slug) VALUES
  ('dddddddd-9229-9229-9229-92299229a001', tests.get_supabase_uid('rq_a'), 'RQ A', 'rq-a');

-- Sredstvo: base 50, cleaning 30.
INSERT INTO rental_assets (id, restaurant_id, name, base_price, cleaning_fee) VALUES
  ('dddddddd-9229-9229-9229-92299229a201', 'dddddddd-9229-9229-9229-92299229a001', 'Vila Sunce', 50, 30);

-- Sezonska cijena: 10–20 jul = 100/noć (širi opseg).
INSERT INTO rental_pricing (restaurant_id, asset_id, date_from, date_to, price) VALUES
  ('dddddddd-9229-9229-9229-92299229a001', 'dddddddd-9229-9229-9229-92299229a201', '2026-07-10', '2026-07-20', 100);

-- Boravišna taksa: 1.00 po osobi/noćenju.
INSERT INTO rental_settings (restaurant_id, tourist_tax_per_person) VALUES
  ('dddddddd-9229-9229-9229-92299229a001', 1.00);

SELECT tests.authenticate_as('rq_a');

-- (1) Sezona: 12–15 jul (3 noći × 100) = 300 base_total
SELECT is(
  (rental_quote_price('dddddddd-9229-9229-9229-92299229a201', '2026-07-12', '2026-07-15', 2, 0)->>'base_total')::numeric,
  300.00, 'Sezonska cijena: 3 noći × 100 = 300');

-- (2) Ukupno = base + cleaning + taksa (2 osobe × 3 noći × 1.00 = 6) = 336
SELECT is(
  (rental_quote_price('dddddddd-9229-9229-9229-92299229a201', '2026-07-12', '2026-07-15', 2, 0)->>'total_amount')::numeric,
  336.00, 'Ukupno = 300 + 30 cleaning + 6 taksa = 336');

-- (3) Boravišna taksa odvojeno (2 odrasla + 1 dijete = 3 × 3 noći × 1.00 = 9)
SELECT is(
  (rental_quote_price('dddddddd-9229-9229-9229-92299229a201', '2026-07-12', '2026-07-15', 2, 1)->>'tourist_tax')::numeric,
  9.00, 'Taksa: (2+1) × 3 noći × 1.00 = 9');

-- (4) Fallback base_price van sezone: 1–4 jun (3 noći × 50) = 150
SELECT is(
  (rental_quote_price('dddddddd-9229-9229-9229-92299229a201', '2026-06-01', '2026-06-04', 1, 0)->>'base_total')::numeric,
  150.00, 'Van sezone: fallback base_price 3 × 50 = 150');

-- (5) Najuži opseg pobjeđuje: uži red 14–16 jul = 200/noć
INSERT INTO rental_pricing (restaurant_id, asset_id, date_from, date_to, price) VALUES
  ('dddddddd-9229-9229-9229-92299229a001', 'dddddddd-9229-9229-9229-92299229a201', '2026-07-14', '2026-07-16', 200);
-- 13 jul (širi 100) + 14 jul (uži 200) = 300 za 2 noći
SELECT is(
  (rental_quote_price('dddddddd-9229-9229-9229-92299229a201', '2026-07-13', '2026-07-15', 1, 0)->>'base_total')::numeric,
  300.00, 'Najuži opseg pobjeđuje: 100 (13.) + 200 (14.) = 300');

-- (6) Nevalidan period (odjava ≤ prijava) → 22023
SELECT throws_ok(
  $$ SELECT rental_quote_price('dddddddd-9229-9229-9229-92299229a201', '2026-07-15', '2026-07-15', 1, 0) $$,
  '22023', NULL, 'Nevalidan period (odjava = prijava) baca grešku');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
