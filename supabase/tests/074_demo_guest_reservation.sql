-- ============================================================================
-- get_demo_guest_reservation — vraća demo prijavu, gejtovano na is_demo
-- ----------------------------------------------------------------------------
-- BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(3);

-- Ne-demo tenant sa checked_in rezervacijom — dokaz da RPC NE curi za prave tenante.
SELECT tests.create_supabase_user('dg_owner');
INSERT INTO public.restaurants (id, user_id, name, slug, active_verticals)
  VALUES ('cccccccc-7777-7777-7777-777777777777', tests.get_supabase_uid('dg_owner'),
          'DG Real', 'dg-real', ARRAY['restaurant','hotel']);
INSERT INTO public.rooms (id, restaurant_id, room_number, status)
  VALUES ('c1111111-7777-7777-7777-777777777777', 'cccccccc-7777-7777-7777-777777777777', '101', 'occupied');
INSERT INTO public.hotel_reservations
  (id, restaurant_id, room_id, check_in_date, check_out_date, guest_name, guest_email, rate_per_night, total_amount, status)
  VALUES ('c2222222-7777-7777-7777-777777777777', 'cccccccc-7777-7777-7777-777777777777',
          'c1111111-7777-7777-7777-777777777777', CURRENT_DATE - 1, CURRENT_DATE + 2,
          'Pravi Gost', 'pravi@example.com', 80, 240, 'checked_in');

-- (1) Demo tenant → vraća aktivnu (checked_in) prijavu (Ana, seedovana).
SELECT is(
  (SELECT COUNT(*)::int FROM get_demo_guest_reservation('deadbeef-0000-0000-0000-000000000010')),
  1,
  'Demo tenant vraća jednu aktivnu prijavu');

-- (2) Vraćena prijava je checked_in.
SELECT is(
  (SELECT status FROM get_demo_guest_reservation('deadbeef-0000-0000-0000-000000000010')),
  'checked_in',
  'Vraćena prijava je checked_in');

-- (3) GATING: ne-demo tenant sa checked_in rezervacijom → 0 redova.
SELECT is(
  (SELECT COUNT(*)::int FROM get_demo_guest_reservation('cccccccc-7777-7777-7777-777777777777')),
  0,
  'Ne-demo tenant ne vraća ništa (is_demo gating)');

SELECT * FROM finish();
ROLLBACK;
