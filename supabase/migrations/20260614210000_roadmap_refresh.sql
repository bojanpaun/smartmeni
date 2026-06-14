-- ============================================================================
-- platform_roadmap — osvježavanje „Šta razvijamo" sadržaja.
-- ----------------------------------------------------------------------------
-- Početni seed (20260614190000) je nabrajao stavke koje su U MEĐUVREMENU ZAVRŠENE
-- (fiskalni računi, lista/izdavanje, više valuta) → zastario. Brišemo ih i unosimo
-- aktuelne PREOSTALE stavke iz roadmapa. Dalje superadmin uređuje kroz UI
-- (/superadmin → Obavještenja → Šta razvijamo).
-- ============================================================================

DELETE FROM public.platform_roadmap
 WHERE title IN ('Fiskalni računi', 'Lista i izdavanje računa', 'Više valuta');

INSERT INTO public.platform_roadmap (title, description, sort_order) VALUES
  ('Fiskalizacija računa (Crna Gora)', 'Povezivanje s poreskom upravom: IKOF/JIKR/QR na računu, štampa i poreski izvještaji.', 10),
  ('Online plaćanje rezervacija',      'Stripe naplata direktnih hotelskih rezervacija sa javne stranice — bez provizije OTA-a.', 20),
  ('Loyalty program',                   'Bodovi, tier nagrade i istorija — povezano sa narudžbama i folijom.', 30),
  ('Channel manager',                   'Sinhronizacija dostupnosti i cijena sa Booking.com, Airbnb i drugim kanalima.', 40)
ON CONFLICT DO NOTHING;
