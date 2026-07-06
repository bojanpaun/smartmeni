-- ============================================================================
-- DEMO rental landing — seed landing_pages 'rental' (bogat uređen /demo/rentals).
-- CREATE OR REPLACE seed_demo_rental (2-location body + landing_pages insert) + reset.
-- reset_demo_tenant briše landing_pages (restaurant_id) pa seed_demo_rental reseeduje.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_rental()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r    uuid := 'deadbeef-0000-0000-0000-000000000010';
  loc  uuid := 'deadbeef-0000-0000-0000-0000000e0001';
  loc2 uuid := 'deadbeef-0000-0000-0000-0000000e0002';
  a1   uuid := 'deadbeef-0000-0000-0000-0000000e0011';
  a2   uuid := 'deadbeef-0000-0000-0000-0000000e0012';
BEGIN
  INSERT INTO public.rental_settings (restaurant_id, tourist_tax_per_person, tourist_tax_currency, default_check_in_instructions)
  VALUES (r, 1.00, 'EUR', 'Ključevi su u sefu pored ulaza; šifra stiže SMS-om dan prije dolaska.')
  ON CONFLICT (restaurant_id) DO NOTHING;

  INSERT INTO public.rental_locations (id, restaurant_id, name, address, city) VALUES
    (loc,  r, 'Stari grad', 'Njegoševa 4', 'Budva'),
    (loc2, r, 'Dobrota',    'Obala bb',    'Kotor')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_assets (id, restaurant_id, location_id, name, base_price, cleaning_fee, min_duration) VALUES
    (a1, r, loc,  'Apartman Galeb', 55.00, 20.00, 2),
    (a2, r, loc2, 'Vila Maslina',  180.00, 50.00, 3)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rental_accommodation_details (asset_id, max_guests, bedrooms, beds, bathrooms, amenities, access_type, description, photo_urls) VALUES
    (a1, 4, 1, 2, 1, ARRAY['wifi','klima','kuhinja','pogled_more'], 'keybox',
      'Svijetao apartman 80m od plaže, terasa s pogledom na more.',
      E'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=70&auto=format'),
    (a2, 8, 3, 4, 2, ARRAY['wifi','klima','bazen','parking','roštilj'], 'smart_lock',
      'Kamena vila s bazenom, idealna za porodice i grupe.',
      E'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=70&auto=format')
  ON CONFLICT (asset_id) DO NOTHING;

  INSERT INTO public.rental_pricing (id, restaurant_id, asset_id, date_from, date_to, price) VALUES
    ('deadbeef-0000-0000-0000-0000000e0021', r, a1, CURRENT_DATE - 10, CURRENT_DATE + 120, 85.00),
    ('deadbeef-0000-0000-0000-0000000e0022', r, a2, CURRENT_DATE - 10, CURRENT_DATE + 120, 240.00)
  ON CONFLICT (id) DO NOTHING;

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

  -- Uređen landing hub (/demo/rentals) — blokovi.
  INSERT INTO public.landing_pages (restaurant_id, page_type, blocks, seo_title, seo_description)
  VALUES (
    r, 'rental',
    $blk$[
      {"type":"hero","enabled":true,"data":{"title":"Vile & apartmani Adriatik","subtitle":"Vaš dom na obali Jadrana — smještaj za nezaboravan odmor","bg_image_url":"https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=70&auto=format","cta_text":"Rezerviši smještaj","layout":"fullscreen"}},
      {"type":"about","enabled":true,"data":{"text":"Nudimo pažljivo odabrane apartmane i vile na najljepšim lokacijama crnogorskog primorja. Svaki smještaj je opremljen za udoban boravak, sa ličnim pristupom i domaćinskom brigom.","image_url":"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=70&auto=format","layout":"image-right","col_split":"55-45"}},
      {"type":"accommodation","enabled":true,"data":{}},
      {"type":"amenities","enabled":true,"data":{"items":"🏊 Bazen\n🌊 Pogled na more\n🅿️ Parking\n📶 Besplatan Wi-Fi\n🍳 Opremljena kuhinja\n🔑 Samostalan check-in","layout":"icons-row"}},
      {"type":"reviews","enabled":true,"data":{"reviews":[{"rating":5,"text":"Predivan apartman, čisto i tačno kao na slikama. Domaćin izuzetno ljubazan!","name":"Jelena M.","date":"avgust 2025"},{"rating":5,"text":"Vila sa bazenom savršena za porodicu. Vraćamo se sigurno.","name":"Nikola V.","date":"jul 2025"}],"layout":"cards"}},
      {"type":"location","enabled":true,"data":{"address":"Njegoševa 4, 85310 Budva","maps_embed_url":"https://maps.google.com/maps?q=Budva%2C%20Crna%20Gora&t=&z=13&ie=UTF8&iwloc=&output=embed","layout":"card-with-map"}},
      {"type":"contact","enabled":true,"data":{"phone":"+382 33 000 000","email":"najam@demo.me","hours":"Dostupni 0–24h","layout":"card"}}
    ]$blk$::jsonb,
    'Vile & apartmani Adriatik — Budva', 'Apartmani i vile za najam na obali Jadrana'
  )
  ON CONFLICT (restaurant_id, page_type)
  DO UPDATE SET blocks = EXCLUDED.blocks, seo_title = EXCLUDED.seo_title,
                seo_description = EXCLUDED.seo_description, updated_at = now();
END;
$$;

SELECT public.reset_demo_tenant();
