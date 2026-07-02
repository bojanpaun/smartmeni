-- ============================================================================
-- DEMO tenant (D1) — javni „Isprobaj demo" objekat: restoran + hotel sa uzorkom
-- podataka kroz sve module. Označen is_demo=true (frontend gejtuje osjetljive akcije),
-- is_complimentary + plan pro + subscription sa svim addonima → sve funkcije otključane.
--
-- Fiksni UUID prostor `deadbeef-…` (validan hex; nijedan test/seed ga ne koristi —
-- testovi 1111../aaaa.., lokalni seed dddddddd..) → test-neutralno + idempotentno.
-- Login: demo@restby.me / demo1234 (namjerno dijeljeno; osjetljive akcije blokirane u appu).
--
-- seed_demo_tenant() je idempotentna (ON CONFLICT) i biće ponovo korišćena za noćni
-- reset (D2: reset_demo_tenant obriše child podatke pa pozove ovu funkciju).
-- ============================================================================

-- 1) is_demo flag (javno čitljiv preko restaurants → PlatformContext.restaurant.is_demo)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.restaurants.is_demo IS
  'Demo objekat (javni „Isprobaj demo"). Frontend blokira osjetljive/izlazne akcije (billing, brisanje tenanta, promjena emaila/lozinke, slanje mailova, payment ključevi).';

-- 2) Demo auth nalog (isti obrazac kao lokalni seed; handle_new_user trigger napravi profil)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'deadbeef-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'demo@restby.me', extensions.crypt('demo1234', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo nalog"}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
VALUES (
  'deadbeef-0000-0000-0000-000000000001', 'deadbeef-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'deadbeef-0000-0000-0000-000000000001', 'email', 'demo@restby.me'),
  'email', 'deadbeef-0000-0000-0000-000000000001', now(), now(), now()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- 3) Seed funkcija — puni demo tenant + child podatke (idempotentno)
CREATE OR REPLACE FUNCTION public.seed_demo_tenant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r   uuid := 'deadbeef-0000-0000-0000-000000000010'; -- restoran = tenant root
  u   uuid := 'deadbeef-0000-0000-0000-000000000001'; -- demo vlasnik
  lay uuid := 'deadbeef-0000-0000-0000-0000000000f0'; -- table layout
  rt1 uuid := 'deadbeef-0000-0000-0000-0000000000a1';
  rt2 uuid := 'deadbeef-0000-0000-0000-0000000000a2';
  rm1 uuid := 'deadbeef-0000-0000-0000-0000000000b1';
  rm2 uuid := 'deadbeef-0000-0000-0000-0000000000b2';
  g1  uuid := 'deadbeef-0000-0000-0000-0000000000d1';
  g2  uuid := 'deadbeef-0000-0000-0000-0000000000d2';
  role_wait uuid := 'deadbeef-0000-0000-0000-0000000000e1';
  role_recep uuid := 'deadbeef-0000-0000-0000-0000000000e2';
  sup1 uuid := 'deadbeef-0000-0000-0000-0000000000f1';
BEGIN
  -- Tenant root (BEFORE INSERT trigger napravi tenants red; mirror sinhronizuje account polja)
  INSERT INTO public.restaurants (
    id, user_id, name, slug, description, location, color, phone, hours,
    onboarding_completed, plan, active_verticals, hotel_visibility,
    is_demo, is_complimentary, approval_status
  ) VALUES (
    r, u, 'Restoran & Hotel Adriatik (DEMO)', 'demo',
    'Demo objekat — isprobajte sve funkcije rest.by.me',
    'Budva, Crna Gora', '#0d7a52', '+382 33 000 000', '08:00 – 24:00',
    true, 'pro', ARRAY['restaurant','hotel']::text[], 'all',
    true, true, 'approved'
  ) ON CONFLICT (id) DO NOTHING;

  -- Subscription: otključava sve addone per-tenant (bez diranja globalnog beta flaga)
  INSERT INTO public.subscriptions (restaurant_id, plan, addons, status)
  VALUES (r, 'pro', '["hotel_core","spa_wellness","inventory_pro","hr_pro"]'::jsonb, 'active')
  ON CONFLICT DO NOTHING;

  -- ── Restoran: meni ─────────────────────────────────────────────────────────
  INSERT INTO public.categories (id, restaurant_id, name, name_en, icon, sort_order) VALUES
    ('deadbeef-0000-0000-0000-0000000000c1', r, 'Predjela',    'Starters', '🥗', 1),
    ('deadbeef-0000-0000-0000-0000000000c2', r, 'Glavna jela', 'Mains',    '🍝', 2),
    ('deadbeef-0000-0000-0000-0000000000c3', r, 'Deserti',     'Desserts', '🍰', 3),
    ('deadbeef-0000-0000-0000-0000000000c4', r, 'Pića',        'Drinks',   '🥤', 4)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.menu_items (id, restaurant_id, category_id, name, name_en, description, price, emoji) VALUES
    ('deadbeef-0000-0000-0000-000000010001', r, 'deadbeef-0000-0000-0000-0000000000c1', 'Dalmatinski pršut', 'Prosciutto',      'Domaći pršut sa maslinama',   9.50, '🥓'),
    ('deadbeef-0000-0000-0000-000000010002', r, 'deadbeef-0000-0000-0000-0000000000c1', 'Riblja čorba',      'Fish soup',       'Tradicionalna, sa bijelim vinom', 6.00, '🍲'),
    ('deadbeef-0000-0000-0000-000000010003', r, 'deadbeef-0000-0000-0000-0000000000c2', 'Njoki sa tartufima','Truffle gnocchi', 'Svježi njoki, krem sos',     14.00, '🍝'),
    ('deadbeef-0000-0000-0000-000000010004', r, 'deadbeef-0000-0000-0000-0000000000c2', 'Brancin na žaru',   'Grilled sea bass','Sa blitvom i krompirom',     18.00, '🐟'),
    ('deadbeef-0000-0000-0000-000000010005', r, 'deadbeef-0000-0000-0000-0000000000c3', 'Palačinke',         'Pancakes',        'Sa domaćim džemom',           4.50, '🥞'),
    ('deadbeef-0000-0000-0000-000000010006', r, 'deadbeef-0000-0000-0000-0000000000c4', 'Domaća limunada',   'Lemonade',        'Svježe cijeđena',             3.50, '🍋')
  ON CONFLICT (id) DO NOTHING;

  -- ── Restoran: raspored + stolovi ───────────────────────────────────────────
  INSERT INTO public.table_layouts (id, restaurant_id, name, is_active)
  VALUES (lay, r, 'Prizemlje', true) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tables (id, restaurant_id, layout_id, number, label, seats, x, y, shape, status) VALUES
    ('deadbeef-0000-0000-0000-000000020001', r, lay, 1, 'Sto 1', 2, 40,  40,  'rect',   'free'),
    ('deadbeef-0000-0000-0000-000000020002', r, lay, 2, 'Sto 2', 4, 160, 40,  'rect',   'free'),
    ('deadbeef-0000-0000-0000-000000020003', r, lay, 3, 'Sto 3', 4, 280, 40,  'circle', 'free'),
    ('deadbeef-0000-0000-0000-000000020004', r, lay, 4, 'Terasa 1', 6, 40, 180, 'rect', 'free')
  ON CONFLICT (id) DO NOTHING;

  -- ── Hotel: tipovi soba + sobe ──────────────────────────────────────────────
  INSERT INTO public.room_types (id, restaurant_id, name, description, max_occupancy, base_price) VALUES
    (rt1, r, 'Standard', 'Standardna dvokrevetna soba', 2, 60.00),
    (rt2, r, 'Deluxe',   'Deluxe soba sa pogledom na more', 3, 95.00)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rooms (id, restaurant_id, room_type_id, room_number, floor, status) VALUES
    (rm1, r, rt1, '101', 1, 'available'),
    ('deadbeef-0000-0000-0000-0000000000b3', r, rt1, '102', 1, 'available'),
    (rm2, r, rt2, '201', 2, 'available'),
    ('deadbeef-0000-0000-0000-0000000000b4', r, rt2, '202', 2, 'cleaning')
  ON CONFLICT (restaurant_id, room_number) DO NOTHING;

  -- ── Gosti ──────────────────────────────────────────────────────────────────
  INSERT INTO public.guests (id, restaurant_id, first_name, last_name, phone, email, status) VALUES
    (g1, r, 'Marko',  'Petrović', '+382 69 111 222', 'marko@example.com', 'regular'),
    (g2, r, 'Ana',    'Nikolić',  '+382 69 333 444', 'ana@example.com',   'vip')
  ON CONFLICT (id) DO NOTHING;

  -- ── Hotel rezervacije (jedna in-house, jedna nadolazeća) ───────────────────
  INSERT INTO public.hotel_reservations (
    id, restaurant_id, room_id, room_type_id, guest_id, guest_name, guest_email,
    check_in_date, check_out_date, adults, rate_per_night, total_amount, status, payment_status
  ) VALUES
    ('deadbeef-0000-0000-0000-000000030001', r, rm2, rt2, g2, 'Ana Nikolić', 'ana@example.com',
     CURRENT_DATE - 1, CURRENT_DATE + 2, 2, 95.00, 285.00, 'checked_in', 'paid'),
    ('deadbeef-0000-0000-0000-000000030002', r, rm1, rt1, g1, 'Marko Petrović', 'marko@example.com',
     CURRENT_DATE + 5, CURRENT_DATE + 8, 2, 60.00, 180.00, 'confirmed', 'pending')
  ON CONFLICT (id) DO NOTHING;

  -- ── Restoran rezervacije stolova ───────────────────────────────────────────
  INSERT INTO public.reservations (
    id, restaurant_id, table_id, guest_name, guest_phone, date, time, guests_count, status
  ) VALUES
    ('deadbeef-0000-0000-0000-000000040001', r, 'deadbeef-0000-0000-0000-000000020002',
     'Jovan Marić', '+382 69 555 666', CURRENT_DATE, '20:00', 4, 'confirmed'),
    ('deadbeef-0000-0000-0000-000000040002', r, 'deadbeef-0000-0000-0000-000000020004',
     'Milica Vuković', '+382 69 777 888', CURRENT_DATE + 1, '19:30', 6, 'pending')
  ON CONFLICT (id) DO NOTHING;

  -- ── HR: role + osoblje ─────────────────────────────────────────────────────
  INSERT INTO public.roles (id, restaurant_id, name, permissions) VALUES
    (role_wait,  r, 'Konobar',    ARRAY['orders.view','orders.create','tables.view']::text[]),
    (role_recep, r, 'Recepcioner',ARRAY['hotel.view','reservations.view','guests.view']::text[])
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.staff (
    id, restaurant_id, role_id, email, first_name, last_name, position,
    is_active, employment_type, wage_type, wage_amount
  ) VALUES
    ('deadbeef-0000-0000-0000-000000050001', r, role_wait,  'konobar@demo.me',   'Petar', 'Kovač',   'Konobar',     true, 'full_time', 'monthly', 700),
    ('deadbeef-0000-0000-0000-000000050002', r, role_recep, 'recepcija@demo.me', 'Sara',  'Đukić',   'Recepcioner', true, 'full_time', 'monthly', 800)
  ON CONFLICT (id) DO NOTHING;

  -- ── Zalihe: dobavljač + artikli ────────────────────────────────────────────
  INSERT INTO public.suppliers (id, restaurant_id, name, contact_person, phone, category, is_active)
  VALUES (sup1, r, 'Veletrgovina Jadran', 'Nikola J.', '+382 32 000 111', 'fnb', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.inventory_items (id, restaurant_id, name, category, unit, quantity, min_quantity, cost_per_unit, supplier_id) VALUES
    ('deadbeef-0000-0000-0000-000000060001', r, 'Brašno T-500', 'Namirnice', 'kg', 45,  10, 0.80, sup1),
    ('deadbeef-0000-0000-0000-000000060002', r, 'Maslinovo ulje','Namirnice', 'l',  12,  5,  6.50, sup1),
    ('deadbeef-0000-0000-0000-000000060003', r, 'Brancin',       'Riba',      'kg', 8,   4,  9.00, sup1)
  ON CONFLICT (id) DO NOTHING;

  -- ── Spa usluge ─────────────────────────────────────────────────────────────
  INSERT INTO public.spa_services (id, restaurant_id, name, category, description, duration_minutes, price, is_active) VALUES
    ('deadbeef-0000-0000-0000-000000070001', r, 'Relax masaža',    'Masaža',  'Klasična masaža cijelog tijela', 60, 40.00, true),
    ('deadbeef-0000-0000-0000-000000070002', r, 'Aroma tretman',   'Wellness','Aromaterapija sa eteričnim uljima', 45, 35.00, true)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_demo_tenant() IS
  'Puni demo tenant (deadbeef-…0010) uzorkom kroz sve module (idempotentno). Koristi je i noćni reset (reset_demo_tenant, D2).';

-- 4) Popuni odmah (local + prod). Idempotentno pa je bezopasno pri ponovnom pokretanju.
SELECT public.seed_demo_tenant();
