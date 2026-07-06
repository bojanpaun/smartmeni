-- ============================================================================
-- DEMO rental — druga lokacija (da /demo/rent prikaže filter po lokaciji uživo).
-- Apartman Galeb ostaje Stari grad/Budva; Vila Maslina ide u Dobrotu/Kotor.
-- CREATE OR REPLACE seed_demo_rental (cijelo tijelo) + reset za primjenu.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_rental()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r    uuid := 'deadbeef-0000-0000-0000-000000000010';
  loc  uuid := 'deadbeef-0000-0000-0000-0000000e0001';  -- Stari grad, Budva
  loc2 uuid := 'deadbeef-0000-0000-0000-0000000e0002';  -- Dobrota, Kotor
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
END;
$$;

SELECT public.reset_demo_tenant();
