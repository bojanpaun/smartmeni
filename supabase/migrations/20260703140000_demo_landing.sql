-- ============================================================================
-- DEMO landing — lijepi javni sajtovi za /demo/home (restoran) i /demo/hotel.
-- Bez ovoga rendereri koriste „static fallback" (samo hero+meni+kontakt). Ovim
-- demo dobija pun landing (hero sa slikom, priča, specijaliteti, galerija, recenzije,
-- amenities, CTA…). Slike su verifikovani Unsplash CDN URL-ovi.
--
-- landing_pages ima restaurant_id → noćni reset ga briše; zato seed_demo_landing()
-- zove reset (poslije seed_demo_tenant) + jednokratno sad. ON CONFLICT (restaurant_id,
-- page_type) → idempotentno.
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
      {"type":"gallery","enabled":true,"data":{"image_urls":"https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=70&auto=format\nhttps://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=70&auto=format"}},
      {"type":"reviews","enabled":true,"data":{"reviews":[
        {"rating":5,"text":"Najbolja riba u Budvi, ambijent savršen za romantičnu večeru.","name":"Jelena M.","date":"jul 2025"},
        {"rating":5,"text":"Ljubazno osoblje i vrhunska hrana. Vraćamo se svake godine!","name":"Marko P.","date":"jun 2025"}
      ]}},
      {"type":"hours_location","enabled":true,"data":{"address":"Mediteranska 12, 85310 Budva","hours":"Pon–Ned 10:00–23:00"}},
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
      {"type":"contact","enabled":true,"data":{"phone":"+382 33 000 000","email":"info@demo.me","hours":"Recepcija 0–24h"}}
    ]$hot$::jsonb,
    'Hotel Adriatik — Budva', 'Vaš dom na obali Jadrana'
  )
  ON CONFLICT (restaurant_id, page_type)
  DO UPDATE SET blocks = EXCLUDED.blocks, seo_title = EXCLUDED.seo_title,
                seo_description = EXCLUDED.seo_description, updated_at = now();
END;
$fn$;

COMMENT ON FUNCTION public.seed_demo_landing() IS
  'Puni lijepe landing_pages (restaurant+hotel) za demo tenant. Zove je reset_demo_tenant (jer reset briše landing_pages).';

-- Dopuni reset da poslije re-seeda napuni i landing.
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

  UPDATE public.staff
  SET user_id = 'deadbeef-0000-0000-0000-000000000002'
  WHERE restaurant_id = r AND lower(email) = 'konobar@demo.me';
END;
$$;

-- Provizioniraj odmah.
SELECT public.seed_demo_landing();
