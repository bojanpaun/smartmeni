-- ============================================================================
-- DEMO rental — uključi rental vertikalu na demo tenant + seed podataka.
-- ----------------------------------------------------------------------------
-- Da javni `/demo/rent` i admin rental modul budu populisani (i da noćni reset
-- to zadrži): (1) `seed_demo_rental()` seeduje lokaciju/sredstva/cijene/postavke/
-- rezervaciju; (2) `reset_demo_tenant()` je proširen da self-heal-uje rental
-- vertikalu + `rental_core` addon i pozove `seed_demo_rental()` poslije re-seeda;
-- (3) jednokratno na kraju `SELECT reset_demo_tenant()` primijeni na prod demo.
--
-- Cijene su CURRENT_DATE-relativne (reset ide noću) da sezonski prozor ostane svjež.
-- ============================================================================

-- ── Seed rental podataka za demo (idempotentno). ────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_demo_rental()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r   uuid := 'deadbeef-0000-0000-0000-000000000010';
  loc uuid := 'deadbeef-0000-0000-0000-0000000e0001';
  a1  uuid := 'deadbeef-0000-0000-0000-0000000e0011';
  a2  uuid := 'deadbeef-0000-0000-0000-0000000e0012';
BEGIN
  INSERT INTO public.rental_settings (restaurant_id, tourist_tax_per_person, tourist_tax_currency, default_check_in_instructions)
  VALUES (r, 1.00, 'EUR', 'Ključevi su u sefu pored ulaza; šifra stiže SMS-om dan prije dolaska.')
  ON CONFLICT (restaurant_id) DO NOTHING;

  INSERT INTO public.rental_locations (id, restaurant_id, name, address, city)
  VALUES (loc, r, 'Stari grad', 'Njegoševa 4', 'Budva')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_assets (id, restaurant_id, location_id, name, base_price, cleaning_fee, min_duration) VALUES
    (a1, r, loc, 'Apartman Galeb', 55.00, 20.00, 2),
    (a2, r, loc, 'Vila Maslina',  180.00, 50.00, 3)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_accommodation_details (asset_id, max_guests, bedrooms, beds, bathrooms, amenities, access_type, description) VALUES
    (a1, 4, 1, 2, 1, ARRAY['wifi','klima','kuhinja','pogled_more'], 'keybox',     'Svijetao apartman 80m od plaže, terasa s pogledom na more.'),
    (a2, 8, 3, 4, 2, ARRAY['wifi','klima','bazen','parking','roštilj'], 'smart_lock', 'Kamena vila s bazenom, idealna za porodice i grupe.')
  ON CONFLICT (asset_id) DO NOTHING;

  INSERT INTO public.rental_pricing (id, restaurant_id, asset_id, date_from, date_to, price) VALUES
    ('deadbeef-0000-0000-0000-0000000e0021', r, a1, CURRENT_DATE - 10, CURRENT_DATE + 120, 85.00),
    ('deadbeef-0000-0000-0000-0000000e0022', r, a2, CURRENT_DATE - 10, CURRENT_DATE + 120, 240.00)
  ON CONFLICT (id) DO NOTHING;

  -- Jedna nadolazeća rezervacija (Vila) — da admin kalendar/rezervacije imaju sadržaj;
  -- ostavlja Apartman i druge datume slobodne za javni booking demo. Auto-guest trigger.
  INSERT INTO public.rental_bookings
    (id, restaurant_id, asset_id, source, start_date, end_date, guest_name, guest_email, guest_phone,
     base_total, cleaning_fee, deposit, total_amount, payment_status, status)
  VALUES
    ('deadbeef-0000-0000-0000-0000000e0031', r, a2, 'booking', CURRENT_DATE + 20, CURRENT_DATE + 25,
     'Petar Nikolić', 'petar.demo@example.com', '+382 69 100 200',
     1200.00, 50.00, 387.00, 1290.00, 'partial', 'confirmed')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_accommodation_stays (booking_id, adults, children, tourist_tax)
  VALUES ('deadbeef-0000-0000-0000-0000000e0031', 6, 2, 40.00)
  ON CONFLICT (booking_id) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.seed_demo_rental() IS
  'Puni rental podatke za demo tenant (lokacija/sredstva/cijene/postavke/rezervacija). Zove je reset_demo_tenant.';

-- ── Proširi reset: self-heal rental vertikale/addona + seed_demo_rental. ─────
CREATE OR REPLACE FUNCTION public.reset_demo_tenant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r uuid := 'deadbeef-0000-0000-0000-000000000010';
  t text;
  pass int;
  blocked int;
  tbls text[];
BEGIN
  SELECT array_agg(c.table_name ORDER BY c.table_name)
    INTO tbls
  FROM information_schema.columns c
  JOIN information_schema.tables tt
    ON tt.table_schema = c.table_schema AND tt.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND c.column_name = 'restaurant_id'
    AND tt.table_type = 'BASE TABLE'
    AND c.table_name <> 'subscriptions';

  UPDATE auth.users
  SET encrypted_password        = extensions.crypt('demo1234', extensions.gen_salt('bf')),
      email                     = CASE id
                                    WHEN 'deadbeef-0000-0000-0000-000000000001' THEN 'demo@restby.me'
                                    WHEN 'deadbeef-0000-0000-0000-000000000002' THEN 'konobar@demo.me'
                                  END,
      email_change              = '',
      email_change_token_new    = '',
      email_change_token_current = '',
      updated_at                = now()
  WHERE id IN ('deadbeef-0000-0000-0000-000000000001', 'deadbeef-0000-0000-0000-000000000002');

  DELETE FROM public.menu_item_ingredients  WHERE menu_item_id IN (SELECT id FROM public.menu_items   WHERE restaurant_id = r);
  DELETE FROM public.rate_plan_rooms        WHERE rate_plan_id IN (SELECT id FROM public.rate_plans    WHERE restaurant_id = r);
  DELETE FROM public.staff_roles            WHERE staff_id     IN (SELECT id FROM public.staff         WHERE restaurant_id = r);
  DELETE FROM public.spa_therapist_services WHERE service_id   IN (SELECT id FROM public.spa_services  WHERE restaurant_id = r);

  FOR pass IN 1..8 LOOP
    blocked := 0;
    FOREACH t IN ARRAY tbls LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE restaurant_id = $1', t) USING r;
      EXCEPTION
        WHEN foreign_key_violation THEN blocked := blocked + 1;
        WHEN OTHERS THEN NULL;
      END;
    END LOOP;
    EXIT WHEN blocked = 0;
  END LOOP;

  PERFORM public.seed_demo_tenant();
  PERFORM public.seed_demo_landing();

  -- Rental vertikala: self-heal (vertikala + addon) pa seed rental podataka.
  UPDATE public.restaurants
    SET active_verticals = ARRAY['restaurant','hotel','rental']::text[]
    WHERE id = r;
  UPDATE public.subscriptions
    SET addons = '["hotel_core","spa_wellness","inventory_pro","hr_pro","rental_core"]'::jsonb
    WHERE restaurant_id = r;
  PERFORM public.seed_demo_rental();

  UPDATE public.staff
  SET user_id = 'deadbeef-0000-0000-0000-000000000002'
  WHERE restaurant_id = r AND lower(email) = 'konobar@demo.me';
END;
$$;

-- ── Primijeni odmah na postojeći demo (prod). ───────────────────────────────
SELECT public.reset_demo_tenant();
