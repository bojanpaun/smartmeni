-- ============================================================================
-- DEMO showcase (DS) — demo STAFF nalog za javni „Portal zaposlenih" (/demo/staff).
--
-- Guest portal (/demo/prijava) NE traži auth (match po imenu+kontaktu na guests) —
-- seedovani gost „Marko Petrović / marko@example.com" radi odmah, ništa dodatno.
--
-- Staff portal koristi signInWithPassword → treba pravi auth nalog. Seed već pravi
-- staff zapis `konobar@demo.me`; staff portal veže user_id po emailu na prvi login
-- (fallback), pa je dovoljno da postoji auth nalog s istim emailom.
--
-- reset_demo_tenant se dopunjava da resetuje i staff lozinku (anti-lockout — staff
-- portal ima promjenu lozinke, a nije pod is_demo guardom jer je zaseban kontekst).
-- ============================================================================

-- Demo staff auth nalog (konobar@demo.me / demo1234)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change, email_change_token_new
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'deadbeef-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
  'konobar@demo.me', extensions.crypt('demo1234', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Konobar"}',
  now(), now(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
VALUES (
  'deadbeef-0000-0000-0000-000000000002', 'deadbeef-0000-0000-0000-000000000002',
  jsonb_build_object('sub', 'deadbeef-0000-0000-0000-000000000002', 'email', 'konobar@demo.me'),
  'email', 'deadbeef-0000-0000-0000-000000000002', now(), now(), now()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Dopuni reset: resetuj i staff (konobar) lozinku uz demo vlasnika (anti-lockout).
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

  -- 1) Anti-lockout: vrati demo kredencijale (vlasnik + staff konobar) na fabričko.
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

  -- 2a) Junction tabele bez restaurant_id — preko roditelja.
  DELETE FROM public.menu_item_ingredients  WHERE menu_item_id IN (SELECT id FROM public.menu_items   WHERE restaurant_id = r);
  DELETE FROM public.rate_plan_rooms        WHERE rate_plan_id IN (SELECT id FROM public.rate_plans    WHERE restaurant_id = r);
  DELETE FROM public.staff_roles            WHERE staff_id     IN (SELECT id FROM public.staff         WHERE restaurant_id = r);
  DELETE FROM public.spa_therapist_services WHERE service_id   IN (SELECT id FROM public.spa_services  WHERE restaurant_id = r);

  -- 2b) Glavne tenant tabele — retry petlja.
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

  -- 3) Ponovo napuni čist demo.
  PERFORM public.seed_demo_tenant();

  -- 4) Veži demo staff (konobar) na njegov auth nalog — RLS „Osoblje vidi sebe"
  --    je auth.uid()=user_id, pa bez ovoga staff portal ne bi vidio svoj zapis.
  UPDATE public.staff
  SET user_id = 'deadbeef-0000-0000-0000-000000000002'
  WHERE restaurant_id = r AND lower(email) = 'konobar@demo.me';
END;
$$;

-- Jednokratno (za već seedovan demo staff — D1 ga je napravio bez user_id).
UPDATE public.staff
SET user_id = 'deadbeef-0000-0000-0000-000000000002'
WHERE restaurant_id = 'deadbeef-0000-0000-0000-000000000010'
  AND lower(email) = 'konobar@demo.me';
