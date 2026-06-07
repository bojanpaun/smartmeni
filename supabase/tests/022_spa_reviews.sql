-- ============================================================================
-- spa_reviews — submit_spa_review + auto-rating trigger + tenant izolacija
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(4);

SELECT tests.create_supabase_user('sr_a');
SELECT tests.create_supabase_user('sr_b');
INSERT INTO public.restaurants (id, user_id, name, slug) VALUES
  ('aaaaaaaa-5151-5151-5151-515151515151', tests.get_supabase_uid('sr_a'), 'SR A', 'sr-a'),
  ('bbbbbbbb-5151-5151-5151-515151515151', tests.get_supabase_uid('sr_b'), 'SR B', 'sr-b');

-- Lanac: staff → terapeut → tretman → dva termina (za dvije recenzije).
INSERT INTO public.staff (id, restaurant_id, email)
  VALUES ('11111111-5151-5151-5151-515151515151', 'aaaaaaaa-5151-5151-5151-515151515151', 'ther@sr-a.test');
INSERT INTO public.spa_therapists (id, staff_id, restaurant_id)
  VALUES ('22222222-5151-5151-5151-515151515151', '11111111-5151-5151-5151-515151515151', 'aaaaaaaa-5151-5151-5151-515151515151');
INSERT INTO public.spa_services (id, restaurant_id, name, price)
  VALUES ('33333333-5151-5151-5151-515151515151', 'aaaaaaaa-5151-5151-5151-515151515151', 'Masaža', 50);
INSERT INTO public.spa_appointments (id, restaurant_id, service_id, therapist_id) VALUES
  ('44444444-5151-5151-5151-515151515151', 'aaaaaaaa-5151-5151-5151-515151515151', '33333333-5151-5151-5151-515151515151', '22222222-5151-5151-5151-515151515151'),
  ('55555555-5151-5151-5151-515151515151', 'aaaaaaaa-5151-5151-5151-515151515151', '33333333-5151-5151-5151-515151515151', '22222222-5151-5151-5151-515151515151');

SELECT tests.authenticate_as_service_role();

-- (1) Prva recenzija (4) → rating terapeuta = 4.00
SELECT public.submit_spa_review('44444444-5151-5151-5151-515151515151', 4, NULL);
SELECT is(
  (SELECT rating FROM public.spa_therapists WHERE id = '22222222-5151-5151-5151-515151515151'),
  4.00::numeric,
  'rating = 4.00 nakon prve recenzije');

-- (2) Druga recenzija (5) → avg(4,5) = 4.50
SELECT public.submit_spa_review('55555555-5151-5151-5151-515151515151', 5, NULL);
SELECT is(
  (SELECT rating FROM public.spa_therapists WHERE id = '22222222-5151-5151-5151-515151515151'),
  4.50::numeric,
  'rating = 4.50 nakon druge recenzije');

-- (3) Upsert iste recenzije (4→2) → avg(2,5) = 3.50
SELECT public.submit_spa_review('44444444-5151-5151-5151-515151515151', 2, NULL);
SELECT is(
  (SELECT rating FROM public.spa_therapists WHERE id = '22222222-5151-5151-5151-515151515151'),
  3.50::numeric,
  'rating = 3.50 nakon izmjene recenzije (upsert po terminu)');

-- (4) RLS izolacija: vlasnik B ne vidi A-ove recenzije
SELECT tests.authenticate_as('sr_b');
SELECT is(
  (SELECT count(*)::int FROM public.spa_reviews),
  0,
  'Vlasnik B ne vidi recenzije restorana A');

SELECT * FROM finish();
ROLLBACK;
