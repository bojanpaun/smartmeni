-- ================================================================
-- Spa reminder: pg_cron job koji poziva send-spa-reminder svakih 15min
-- ================================================================
--
-- PREDUSLOV: Prije primjene ove migracije, postavi u Supabase SQL editoru:
--
--   ALTER DATABASE postgres
--     SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
--
--   ALTER DATABASE postgres
--     SET app.service_key = 'YOUR_SERVICE_ROLE_KEY';
--
-- Ili postavi kao Supabase secrets i dodaj u Edge Function environment.
-- ================================================================

-- Funkcija koja poziva Edge Function (koristi pg_net)
CREATE OR REPLACE FUNCTION call_spa_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url  TEXT;
  v_key  TEXT;
BEGIN
  v_url := current_setting('app.supabase_url', true);
  v_key := current_setting('app.service_key', true);

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE LOG 'spa_reminder: app.supabase_url or app.service_key not set, skipping.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-spa-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- pg_cron job — svakih 15 minuta
-- Briše eventualni stari job istog naziva pa kreira novi
SELECT cron.unschedule('spa-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'spa-reminders'
);

SELECT cron.schedule(
  'spa-reminders',
  '*/15 * * * *',
  'SELECT call_spa_reminder()'
);
