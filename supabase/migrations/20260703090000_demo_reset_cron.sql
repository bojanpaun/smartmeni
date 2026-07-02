-- ============================================================================
-- DEMO D2 — noćni reset demo tenanta + reset demo lozinke (anti-lockout).
--
-- reset_demo_tenant(): (1) vrati demo kredencijale na fabričko (lozinka/email) da
-- visitor ne može trajno zaključati dijeljeni nalog; (2) obriši SVE podatke demo
-- tenanta; (3) ponovo napuni čist demo (seed_demo_tenant).
--
-- Brisanje: retry petlja preko svih tenant tabela (restaurant_id = demo). Ne oslanja
-- se na savršen FK redoslijed ni na session_replication_role (nije zagarantovan na
-- Supabase prod-u) — tabele blokirane FK-om se preskoče i pokušaju u sljedećem prolazu.
-- Junction tabele bez restaurant_id (staff_roles, menu_item_ingredients, …) brišu se
-- preko roditelja PRIJE petlje.
--
-- pg_cron: svake noći 04:00 UTC (nisko opterećenje za CG UTC+1/+2).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reset_demo_tenant()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r uuid := 'deadbeef-0000-0000-0000-000000000010'; -- demo restoran/tenant
  u uuid := 'deadbeef-0000-0000-0000-000000000001'; -- demo vlasnik (auth)
  t text;
  pass int;
  blocked int;
  tbls text[];
BEGIN
  -- Sve tenant tabele (BASE TABLE sa restaurant_id) OSIM subscriptions (drži addone
  -- otključane). Dinamički → auto-isključuje VIEW-ove (npr. hotel_daily_revenue) i
  -- hvata buduće tabele bez ručnog održavanja liste.
  SELECT array_agg(c.table_name ORDER BY c.table_name)
    INTO tbls
  FROM information_schema.columns c
  JOIN information_schema.tables tt
    ON tt.table_schema = c.table_schema AND tt.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND c.column_name = 'restaurant_id'
    AND tt.table_type = 'BASE TABLE'
    AND c.table_name <> 'subscriptions';

  -- 1) Anti-lockout: vrati demo kredencijale na fabričko.
  UPDATE auth.users
  SET encrypted_password        = extensions.crypt('demo1234', extensions.gen_salt('bf')),
      email                     = 'demo@restby.me',
      email_change              = '',
      email_change_token_new    = '',
      email_change_token_current = '',
      updated_at                = now()
  WHERE id = u;

  -- 2a) Junction tabele bez restaurant_id — obriši preko roditelja (inače blokiraju roditelje).
  DELETE FROM public.menu_item_ingredients  WHERE menu_item_id IN (SELECT id FROM public.menu_items   WHERE restaurant_id = r);
  DELETE FROM public.rate_plan_rooms        WHERE rate_plan_id IN (SELECT id FROM public.rate_plans    WHERE restaurant_id = r);
  DELETE FROM public.staff_roles            WHERE staff_id     IN (SELECT id FROM public.staff         WHERE restaurant_id = r);
  DELETE FROM public.spa_therapist_services WHERE service_id   IN (SELECT id FROM public.spa_services  WHERE restaurant_id = r);

  -- 2b) Glavne tenant tabele — retry petlja (FK-blokiran roditelj čeka sljedeći prolaz).
  FOR pass IN 1..8 LOOP
    blocked := 0;
    FOREACH t IN ARRAY tbls LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE restaurant_id = $1', t) USING r;
      EXCEPTION
        -- FK-blokiran roditelj → pokušaj opet sljedeći prolaz. Bilo koja druga
        -- greška (npr. neočekivan view/constraint) NE smije oboriti cijeli reset:
        -- preskoči tu tabelu, nastavi (nightly job mora biti otporan).
        WHEN foreign_key_violation THEN blocked := blocked + 1;
        WHEN OTHERS THEN NULL;
      END;
    END LOOP;
    EXIT WHEN blocked = 0;
  END LOOP;

  -- 3) Ponovo napuni čist demo.
  PERFORM public.seed_demo_tenant();
END;
$$;

COMMENT ON FUNCTION public.reset_demo_tenant() IS
  'Noćni reset demo tenanta: reset demo lozinke/emaila (anti-lockout) + brisanje svih podataka + re-seed. Poziva ga pg_cron (reset-demo-tenant).';

-- pg_cron: svake noći 04:00 UTC. Idempotentno (unschedule ako job već postoji).
DO $cron$
BEGIN
  PERFORM cron.unschedule('reset-demo-tenant');
EXCEPTION WHEN OTHERS THEN NULL; -- job ne postoji → ok
END
$cron$;

SELECT cron.schedule('reset-demo-tenant', '0 4 * * *', $$SELECT public.reset_demo_tenant();$$);
