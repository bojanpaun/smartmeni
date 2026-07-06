-- ============================================================================
-- RENT-0b anon RPC-ovi: quote / dostupnost (EXCLUDE) / kreiranje / gating
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(7);

SELECT tests.create_supabase_user('rpb_owner');
SELECT tests.create_supabase_user('rpb_owner2');

-- Rental tenant (ima 'rental' vertikalu) + sredstvo + sezonska cijena + postavke.
INSERT INTO public.restaurants (id, user_id, name, slug, active_verticals) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', tests.get_supabase_uid('rpb_owner'),  'RPB Rental', 'rpb-rental', ARRAY['restaurant','rental']),
  ('eeeeeeee-0000-0000-0000-000000000002', tests.get_supabase_uid('rpb_owner2'), 'RPB Plain',  'rpb-plain',  ARRAY['restaurant']);

INSERT INTO public.rental_settings (restaurant_id, tourist_tax_per_person)
  VALUES ('eeeeeeee-0000-0000-0000-000000000001', 1.00);

INSERT INTO public.rental_assets (id, restaurant_id, name, base_price, cleaning_fee, min_duration, status, asset_kind)
  VALUES ('eeeeeeee-0000-0000-0000-0000000000a1', 'eeeeeeee-0000-0000-0000-000000000001',
          'Apartman Test', 50.00, 20.00, 2, 'active', 'accommodation');
INSERT INTO public.rental_accommodation_details (asset_id, max_guests) VALUES
  ('eeeeeeee-0000-0000-0000-0000000000a1', 4);
INSERT INTO public.rental_pricing (restaurant_id, asset_id, date_from, date_to, price)
  VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1',
          CURRENT_DATE, CURRENT_DATE + 30, 80.00);

-- Neaktivno/ne-rental sredstvo pod PLAIN tenantom (za gating test).
INSERT INTO public.rental_assets (id, restaurant_id, name, base_price, min_duration, status, asset_kind)
  VALUES ('eeeeeeee-0000-0000-0000-0000000000b1', 'eeeeeeee-0000-0000-0000-000000000002',
          'Plain Asset', 40.00, 1, 'active', 'accommodation');

-- (1) Quote: 3 noći × 80 = 240 + 20 čišćenje + (1×3×2) taksa 6 = 266.
SELECT is(
  (public.rental_quote_public('eeeeeeee-0000-0000-0000-0000000000a1', CURRENT_DATE + 1, CURRENT_DATE + 4, 2, 0)->>'total_amount')::numeric,
  266.00::numeric,
  'Quote = 266 (240 base + 20 čišćenje + 6 taksa)');

-- (2) Dostupnost: sredstvo je slobodno → 1 red.
SELECT is(
  (SELECT COUNT(*)::int FROM public.get_available_rental_assets('eeeeeeee-0000-0000-0000-000000000001', CURRENT_DATE + 1, CURRENT_DATE + 4, 2)),
  1,
  'Slobodno sredstvo se pojavljuje u dostupnima');

-- Kreiraj rezervaciju (poziva se JEDNOM → temp tabela za provjeru polja).
CREATE TEMP TABLE _bk AS SELECT public.create_rental_booking_public(
  'eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1',
  CURRENT_DATE + 1, CURRENT_DATE + 4, 2, 0, 'Marko Test', 'marko.rpb@example.com', '+382 69 000 000') AS r;

-- (3) Depozit = 30% od 266 = 79.80.
SELECT is((SELECT (r->>'deposit')::numeric FROM _bk), 79.80::numeric, 'Depozit = 30% ukupnog');

-- (4) Booking_id je vraćen.
SELECT isnt((SELECT r->>'booking_id' FROM _bk), NULL, 'create vraća booking_id');

-- (5) Dostupnost sada 0 za preklapajuće datume (EXCLUDE-aware).
SELECT is(
  (SELECT COUNT(*)::int FROM public.get_available_rental_assets('eeeeeeee-0000-0000-0000-000000000001', CURRENT_DATE + 2, CURRENT_DATE + 5, 2)),
  0,
  'Zauzeto sredstvo izuzeto iz dostupnih');

-- (6) Drugi create sa preklapanjem → 23P01 (EXCLUDE guard).
SELECT throws_ok(
  $$SELECT public.create_rental_booking_public(
      'eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000a1',
      CURRENT_DATE + 2, CURRENT_DATE + 5, 2, 0, 'Ana Test', 'ana.rpb@example.com', NULL)$$,
  '23P01',
  NULL,
  'Preklapajuća rezervacija odbijena (EXCLUDE 23P01)');

-- (7) GATING: ne-rental tenant → get_available vraća 0 (iako ima aktivno sredstvo).
SELECT is(
  (SELECT COUNT(*)::int FROM public.get_available_rental_assets('eeeeeeee-0000-0000-0000-000000000002', CURRENT_DATE + 1, CURRENT_DATE + 4, 1)),
  0,
  'Ne-rental tenant ne nudi sredstva (vertikala gating)');

SELECT * FROM finish();
ROLLBACK;
