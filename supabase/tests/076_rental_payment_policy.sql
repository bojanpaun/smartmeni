-- ============================================================================
-- RENT-PAY: politika plaćanja najma (rental_settings.payment_type/deposit_pct).
-- create_rental_booking_public: on_arrival → depozit 0; online → depozit = pct%.
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(6);

SELECT tests.create_supabase_user('rpay_owner');

INSERT INTO public.restaurants (id, user_id, name, slug, active_verticals) VALUES
  ('eeeeeeee-0000-0000-0000-0000000000f1', tests.get_supabase_uid('rpay_owner'), 'RPay Rental', 'rpay-rental', ARRAY['restaurant','rental']);

INSERT INTO public.rental_assets (id, restaurant_id, name, base_price, cleaning_fee, min_duration, status, asset_kind)
  VALUES ('eeeeeeee-0000-0000-0000-0000000000f2', 'eeeeeeee-0000-0000-0000-0000000000f1',
          'Apartman RPay', 50.00, 20.00, 1, 'active', 'accommodation');
INSERT INTO public.rental_accommodation_details (asset_id, max_guests) VALUES
  ('eeeeeeee-0000-0000-0000-0000000000f2', 4);
-- Fiksna cijena za sve datume (80/noć) → 3 noći = 240 + 20 čišćenje + 0 taksa = 260.
INSERT INTO public.rental_pricing (restaurant_id, asset_id, date_from, date_to, price)
  VALUES ('eeeeeeee-0000-0000-0000-0000000000f1', 'eeeeeeee-0000-0000-0000-0000000000f2',
          CURRENT_DATE, CURRENT_DATE + 60, 80.00);

-- (0) Default kolone payment_type = 'on_arrival' (kad se red kreira bez eksplicitne vrijednosti).
INSERT INTO public.rental_settings (restaurant_id, tourist_tax_per_person)
  VALUES ('eeeeeeee-0000-0000-0000-0000000000f1', 0);
SELECT is(
  (SELECT payment_type FROM public.rental_settings WHERE restaurant_id = 'eeeeeeee-0000-0000-0000-0000000000f1'),
  'on_arrival', 'Default payment_type je on_arrival');

-- (1) on_arrival → depozit 0, ali total pun (260).
CREATE TEMP TABLE _oa AS SELECT public.create_rental_booking_public(
  'eeeeeeee-0000-0000-0000-0000000000f1', 'eeeeeeee-0000-0000-0000-0000000000f2',
  CURRENT_DATE + 1, CURRENT_DATE + 4, 2, 0, 'Gost Dolazak', 'oa@example.com', NULL) AS r;
SELECT is((SELECT (r->>'deposit')::numeric FROM _oa), 0::numeric, 'on_arrival → depozit 0');
SELECT is((SELECT (r->>'total_amount')::numeric FROM _oa), 260.00::numeric, 'on_arrival → pun total 260');
SELECT is((SELECT r->>'payment_type' FROM _oa), 'on_arrival', 'RPC vraća payment_type on_arrival');

-- Prebaci na online sa custom procentom 50%.
UPDATE public.rental_settings SET payment_type = 'online', deposit_pct = 50
  WHERE restaurant_id = 'eeeeeeee-0000-0000-0000-0000000000f1';

-- (2) online 50% → depozit = 50% od 260 = 130 (novi, ne-preklapajući datumi).
CREATE TEMP TABLE _on AS SELECT public.create_rental_booking_public(
  'eeeeeeee-0000-0000-0000-0000000000f1', 'eeeeeeee-0000-0000-0000-0000000000f2',
  CURRENT_DATE + 10, CURRENT_DATE + 13, 2, 0, 'Gost Online', 'on@example.com', NULL) AS r;
SELECT is((SELECT (r->>'deposit')::numeric FROM _on), 130.00::numeric, 'online 50% → depozit 130');
SELECT is((SELECT r->>'payment_type' FROM _on), 'online', 'RPC vraća payment_type online');

SELECT * FROM finish();
ROLLBACK;
