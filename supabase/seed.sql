-- ============================================================================
-- LOKALNI SEED — pokreće se automatski pri `supabase db reset` (i `supabase start`).
-- ----------------------------------------------------------------------------
-- NAMJENA: napuniti SAMO lokalnu/dev bazu minimalnim, ali realnim podacima da
-- aplikacija ima šta da prikaže (1 tenant sa restoran + hotel vertikalom,
-- login korisnik, superadmin, par meni stavki i soba).
--
-- NE pokreće se na produkciji — `supabase db push` šalje samo migracije, ne seed.
-- Bez pravih podataka gostiju. Fiksni UUID-jevi → deterministično, re-runabilno.
--
-- Login (lokalno):
--   • Vlasnik:    za.bojana.paunovica@gmail.com  / lozinka: password123
--   • Superadmin: bojanpaun@gmail.com              / lozinka: password123
-- ============================================================================

-- ── 0) Beta-free režim: otključava sve addone (hotel_core, spa, ...) lokalno ──
-- Bez ovoga hotel vertikala je "zaključana" jer nema kupljen addon entitlement.
UPDATE public.platform_settings SET beta_free_mode = true;

-- ── 1) Auth korisnici (vlasnik + superadmin) ────────────────────────────────
-- Lozinka je bcrypt hash preko pgcrypto (extensions.crypt). email_confirmed_at
-- postavljen → nalog je odmah upotrebljiv bez email potvrde lokalno.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
VALUES
  ('00000000-0000-0000-0000-000000000000',
   '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'za.bojana.paunovica@gmail.com', extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lokalni Vlasnik"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'bojanpaun@gmail.com', extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lokalni Superadmin"}',
   now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Identiteti (GoTrue traži red u auth.identities za email login)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
VALUES
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'za.bojana.paunovica@gmail.com'),
   'email', '11111111-1111-1111-1111-111111111111', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   jsonb_build_object('sub', '22222222-2222-2222-2222-222222222222', 'email', 'bojanpaun@gmail.com'),
   'email', '22222222-2222-2222-2222-222222222222', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ── 2) Profili (superadmin flag) ────────────────────────────────────────────
INSERT INTO public.user_profiles (id, is_superadmin, full_name)
VALUES
  ('11111111-1111-1111-1111-111111111111', false, 'Lokalni Vlasnik'),
  ('22222222-2222-2222-2222-222222222222', true,  'Lokalni Superadmin')
ON CONFLICT (id) DO NOTHING;

-- ── 3) Restoran (= tenant root). BEFORE INSERT trigger auto-kreira tenants red.
-- active_verticals = {restaurant, hotel} → obje vertikale aktivne lokalno.
INSERT INTO public.restaurants (
  id, user_id, name, slug, description, location, color,
  onboarding_completed, plan, active_verticals, hotel_visibility
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'Lokalni Test Restoran', 'lokalni-test', 'Test tenant za lokalni razvoj',
  'Podgorica', '#0d7a52', true, 'pro',
  ARRAY['restaurant','hotel']::text[], 'all'
)
ON CONFLICT (id) DO NOTHING;

-- ── 4) Meni: kategorije + par stavki ────────────────────────────────────────
INSERT INTO public.categories (id, restaurant_id, name, name_en, icon, sort_order)
VALUES
  ('44444444-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Predjela',  'Starters', '🥗', 1),
  ('44444444-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Glavna jela','Mains',    '🍝', 2),
  ('44444444-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Pića',      'Drinks',   '🥤', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (restaurant_id, category_id, name, name_en, description, price, emoji)
VALUES
  ('33333333-3333-3333-3333-333333333333', '44444444-0000-0000-0000-000000000001', 'Dalmatinski pršut', 'Prosciutto', 'Domaći pršut sa maslinama', 9.50, '🥓'),
  ('33333333-3333-3333-3333-333333333333', '44444444-0000-0000-0000-000000000002', 'Njoki sa tartufima','Truffle gnocchi', 'Svježi njoki, krem sos', 14.00, '🍝'),
  ('33333333-3333-3333-3333-333333333333', '44444444-0000-0000-0000-000000000002', 'Riblji file',       'Fish fillet', 'Brancin na žaru', 18.00, '🐟'),
  ('33333333-3333-3333-3333-333333333333', '44444444-0000-0000-0000-000000000003', 'Domaća limunada',   'Lemonade', 'Svježe cijeđena', 3.50, '🍋')
ON CONFLICT DO NOTHING;

-- ── 5) Hotel: tipovi soba + konkretne sobe ──────────────────────────────────
INSERT INTO public.room_types (id, restaurant_id, name, description, max_occupancy, base_price)
VALUES
  ('55555555-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Standard', 'Standardna dvokrevetna soba', 2, 60.00),
  ('55555555-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Deluxe',   'Deluxe soba sa pogledom',    3, 95.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rooms (restaurant_id, room_type_id, room_number, floor, status)
VALUES
  ('33333333-3333-3333-3333-333333333333', '55555555-0000-0000-0000-000000000001', '101', 1, 'available'),
  ('33333333-3333-3333-3333-333333333333', '55555555-0000-0000-0000-000000000001', '102', 1, 'available'),
  ('33333333-3333-3333-3333-333333333333', '55555555-0000-0000-0000-000000000002', '201', 2, 'available'),
  ('33333333-3333-3333-3333-333333333333', '55555555-0000-0000-0000-000000000002', '202', 2, 'cleaning')
ON CONFLICT (restaurant_id, room_number) DO NOTHING;
