-- ============================================================================
-- DEMO sajtovi (#3): Google mapa + bogatija galerija
-- ----------------------------------------------------------------------------
-- Dopunjava seed_demo_landing() (CREATE OR REPLACE — cijelo tijelo):
--   • RESTORAN: hours_location blok dobija maps_embed_url (Google mapa Budve);
--     galerija proširena sa 3 → 5 slika.
--   • HOTEL: dodat location blok (adresa + maps_embed_url) — ranije samo contact
--     bez mape. HotelLandingPage renderuje `location` (📍 + iframe mape).
--
-- maps_embed_url koristi javni `output=embed` oblik (bez API ključa) — dovoljno za
--   demo. Blok i dalje prikazuje adresu iznad mape, pa i ako mapa ne učita adresa ostaje.
-- ON CONFLICT DO UPDATE SET blocks=EXCLUDED → poziv odmah ažurira postojeći demo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_landing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r uuid := 'deadbeef-0000-0000-0000-000000000010';
BEGIN
  INSERT INTO public.landing_pages (restaurant_id, page_type, blocks, seo_title, seo_description)
  VALUES (
    r, 'restaurant',
    $rest$[
      {"type":"hero","enabled":true,"data":{"title":"Restoran Adriatik","subtitle":"Mediteranska kuhinja na obali Budve","bg_image_url":"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&q=70&auto=format"}},
      {"type":"story","enabled":true,"data":{"text":"Već tri decenije spajamo svježe morske plodove, domaće maslinovo ulje i toplinu crnogorskog gostoprimstva. Svaki tanjir priča priču Jadrana.","image_url":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=70&auto=format","layout":"image-right","col_split":"55-45"}},
      {"type":"menu_preview","enabled":true,"data":{"layout":"grid"}},
      {"type":"specials","enabled":true,"data":{"specials":[
        {"name":"Brancin na žaru","price":"18€","description":"Svježi brancin sa blitvom i krompirom","image_url":"https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=800&q=70&auto=format"},
        {"name":"Njoki sa tartufima","price":"14€","description":"Svježi njoki u kremastom sosu od tartufa","image_url":"https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=70&auto=format"}
      ]}},
      {"type":"gallery","enabled":true,"data":{"image_urls":"https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=70&auto=format"}},
      {"type":"reviews","enabled":true,"data":{"reviews":[
        {"rating":5,"text":"Najbolja riba u Budvi, ambijent savršen za romantičnu večeru.","name":"Jelena M.","date":"jul 2025"},
        {"rating":5,"text":"Ljubazno osoblje i vrhunska hrana. Vraćamo se svake godine!","name":"Marko P.","date":"jun 2025"}
      ]}},
      {"type":"hours_location","enabled":true,"data":{"address":"Mediteranska 12, 85310 Budva","hours":"Pon–Ned 10:00–23:00","maps_embed_url":"https://maps.google.com/maps?q=Budva%2C%20Crna%20Gora&t=&z=13&ie=UTF8&iwloc=&output=embed"}},
      {"type":"reservation_cta","enabled":true,"data":{"text":"Rezerviši sto","subtitle":"Slobodna mjesta za večeras"}}
    ]$rest$::jsonb,
    'Restoran Adriatik — Budva', 'Mediteranska kuhinja na obali Budve'
  )
  ON CONFLICT (restaurant_id, page_type)
  DO UPDATE SET blocks = EXCLUDED.blocks, seo_title = EXCLUDED.seo_title,
                seo_description = EXCLUDED.seo_description, updated_at = now();

  INSERT INTO public.landing_pages (restaurant_id, page_type, blocks, seo_title, seo_description)
  VALUES (
    r, 'hotel',
    $hot$[
      {"type":"hero","enabled":true,"data":{"title":"Hotel Adriatik","subtitle":"Vaš dom na obali Jadrana","bg_image_url":"https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=70&auto=format"}},
      {"type":"about","enabled":true,"data":{"text":"Moderni hotel sa pogledom na more, na par koraka od stare gradske jezgre. Prostrane sobe, doručak sa domaćim specijalitetima i spa oaza za potpuni odmor.","image_url":"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=70&auto=format","layout":"image-right","col_split":"55-45"}},
      {"type":"rooms","enabled":true,"data":{}},
      {"type":"amenities","enabled":true,"data":{"items":"🏊 Bazen\n🧖 Spa & wellness\n🍳 Doručak uključen\n📶 Besplatan Wi-Fi\n🅿️ Parking\n🌊 Pogled na more"}},
      {"type":"gallery","enabled":true,"data":{"image_urls":"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=70&auto=format"}},
      {"type":"reviews","enabled":true,"data":{"reviews":[
        {"rating":5,"text":"Predivan pogled, čiste sobe i ljubazno osoblje. Preporuka!","name":"Ana N.","date":"avgust 2025"},
        {"rating":5,"text":"Spa je fenomenalan, doručak bogat. Vraćamo se sigurno.","name":"Nikola V.","date":"jul 2025"}
      ]}},
      {"type":"cta_banner","enabled":true,"data":{"title":"Rezervišite svoj boravak","subtitle":"Najbolje cijene direktno na sajtu","btn_text":"Provjeri dostupnost"}},
      {"type":"location","enabled":true,"data":{"address":"Mediteranska 12, 85310 Budva","maps_embed_url":"https://maps.google.com/maps?q=Budva%2C%20Crna%20Gora&t=&z=13&ie=UTF8&iwloc=&output=embed"}},
      {"type":"contact","enabled":true,"data":{"phone":"+382 33 000 000","email":"info@demo.me","hours":"Recepcija 0–24h"}}
    ]$hot$::jsonb,
    'Hotel Adriatik — Budva', 'Vaš dom na obali Jadrana'
  )
  ON CONFLICT (restaurant_id, page_type)
  DO UPDATE SET blocks = EXCLUDED.blocks, seo_title = EXCLUDED.seo_title,
                seo_description = EXCLUDED.seo_description, updated_at = now();
END;
$fn$;

-- Primijeni odmah (DO UPDATE ažurira postojeći demo landing).
SELECT public.seed_demo_landing();
