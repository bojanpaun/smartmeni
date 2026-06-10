-- ============================================================================
-- LOKALNI SEED — pokreće se automatski pri `supabase db reset` / `supabase start`.
-- ----------------------------------------------------------------------------
-- NAMJENA: napuniti SAMO lokalnu/dev bazu minimalnim, realnim podacima da
-- aplikacija ima šta da prikaže (1 tenant sa restoran + hotel vertikalom,
-- login korisnik, superadmin, par meni stavki i soba).
--
-- NE ide na produkciju — `supabase db push` šalje samo migracije, ne seed.
--
-- TEST-NEUTRALNOST (BITNO): seed se učitava i prije `supabase test db`, pa NE SMIJE
-- pokvariti pgTAP testove. Zato:
--   • Koristi REZERVISANI UUID prostor 'dddddddd-...' koji NIJEDAN test ne koristi
--     (testovi koriste 1111.., 2222.., 3333.., aaaa.., a1a1..). Ne diraj taj prefiks.
--   • NE dira globalni singleton platform_settings.beta_free_mode (test 018 traži
--     da je false po defaultu). Addone otključavamo PER-TENANT preko subscriptions.
--
-- Login (lokalno, lozinka je samo lokalna — nema veze sa prod lozinkom):
--   • Vlasnik:    za.bojana.paunovica@gmail.com  / password123
--   • Superadmin: bojanpaun@gmail.com            / password123
-- ============================================================================

-- ── 1) Auth korisnici (vlasnik + superadmin) ────────────────────────────────
-- Lozinka je bcrypt hash preko pgcrypto. email_confirmed_at postavljen → nalog
-- je odmah upotrebljiv bez email potvrde lokalno.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
VALUES
  ('00000000-0000-0000-0000-000000000000',
   'dddddddd-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'za.bojana.paunovica@gmail.com', extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lokalni Vlasnik"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'dddddddd-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
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
  ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001',
   jsonb_build_object('sub', 'dddddddd-0000-0000-0000-000000000001', 'email', 'za.bojana.paunovica@gmail.com'),
   'email', 'dddddddd-0000-0000-0000-000000000001', now(), now(), now()),
  ('dddddddd-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000002',
   jsonb_build_object('sub', 'dddddddd-0000-0000-0000-000000000002', 'email', 'bojanpaun@gmail.com'),
   'email', 'dddddddd-0000-0000-0000-000000000002', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ── 2) Profili (superadmin flag) ────────────────────────────────────────────
INSERT INTO public.user_profiles (id, is_superadmin, full_name)
VALUES
  ('dddddddd-0000-0000-0000-000000000001', false, 'Lokalni Vlasnik'),
  ('dddddddd-0000-0000-0000-000000000002', true,  'Lokalni Superadmin')
ON CONFLICT (id) DO NOTHING;

-- ── 3) Restoran (= tenant root). BEFORE INSERT trigger auto-kreira tenants red.
-- active_verticals = {restaurant, hotel} → obje vertikale aktivne lokalno.
INSERT INTO public.restaurants (
  id, user_id, name, slug, description, location, color,
  onboarding_completed, plan, active_verticals, hotel_visibility
)
VALUES (
  'dddddddd-0000-0000-0000-000000000010',
  'dddddddd-0000-0000-0000-000000000001',
  'Lokalni Test Restoran', 'lokalni-test', 'Test tenant za lokalni razvoj',
  'Podgorica', '#0d7a52', true, 'pro',
  ARRAY['restaurant','hotel']::text[], 'all'
)
ON CONFLICT (id) DO NOTHING;

-- ── 3b) Subscription: otključava addone SAMO za ovaj tenant (per-tenant) ─────
-- checkAddon (PlatformContext) → hasAddon(subscription, ...) gleda subscription.addons.
-- Ovim ne diramo globalni beta flag, pa testovi ostaju zeleni.
INSERT INTO public.subscriptions (restaurant_id, plan, addons, status)
VALUES (
  'dddddddd-0000-0000-0000-000000000010', 'pro',
  '["hotel_core","spa_wellness","inventory_pro","hr_pro"]'::jsonb, 'active'
)
ON CONFLICT DO NOTHING;

-- ── 4) Meni: kategorije + par stavki ────────────────────────────────────────
INSERT INTO public.categories (id, restaurant_id, name, name_en, icon, sort_order)
VALUES
  ('dddddddd-0000-0000-0000-0000000000c1', 'dddddddd-0000-0000-0000-000000000010', 'Predjela',   'Starters', '🥗', 1),
  ('dddddddd-0000-0000-0000-0000000000c2', 'dddddddd-0000-0000-0000-000000000010', 'Glavna jela','Mains',    '🍝', 2),
  ('dddddddd-0000-0000-0000-0000000000c3', 'dddddddd-0000-0000-0000-000000000010', 'Pića',       'Drinks',   '🥤', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (restaurant_id, category_id, name, name_en, description, price, emoji)
VALUES
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000c1', 'Dalmatinski pršut', 'Prosciutto', 'Domaći pršut sa maslinama', 9.50, '🥓'),
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000c2', 'Njoki sa tartufima','Truffle gnocchi', 'Svježi njoki, krem sos', 14.00, '🍝'),
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000c2', 'Riblji file',       'Fish fillet', 'Brancin na žaru', 18.00, '🐟'),
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000c3', 'Domaća limunada',   'Lemonade', 'Svježe cijeđena', 3.50, '🍋')
ON CONFLICT DO NOTHING;

-- ── 5) Hotel: tipovi soba + konkretne sobe ──────────────────────────────────
INSERT INTO public.room_types (id, restaurant_id, name, description, max_occupancy, base_price)
VALUES
  ('dddddddd-0000-0000-0000-0000000000a1', 'dddddddd-0000-0000-0000-000000000010', 'Standard', 'Standardna dvokrevetna soba', 2, 60.00),
  ('dddddddd-0000-0000-0000-0000000000a2', 'dddddddd-0000-0000-0000-000000000010', 'Deluxe',   'Deluxe soba sa pogledom',    3, 95.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rooms (restaurant_id, room_type_id, room_number, floor, status)
VALUES
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000a1', '101', 1, 'available'),
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000a1', '102', 1, 'available'),
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000a2', '201', 2, 'available'),
  ('dddddddd-0000-0000-0000-000000000010', 'dddddddd-0000-0000-0000-0000000000a2', '202', 2, 'cleaning')
ON CONFLICT (restaurant_id, room_number) DO NOTHING;
