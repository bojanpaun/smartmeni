-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Cron job koji svaki dan poziva send-trial-reminder Edge Function
-- NAPOMENA: Pokrenuti NAKON što je Edge Function deployana
-- =============================================

-- Zakaži cron job — svaki dan u 03:00 UTC (sat nakon suspenzije)
SELECT cron.schedule(
  'send-trial-reminder-emails',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM vault.secrets WHERE name = 'supabase_url') || '/functions/v1/send-trial-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

-- ─────────────────────────────────────────────
-- PROVJERA aktivnih jobova:
-- SELECT * FROM cron.job;
--
-- BRISANJE joba:
-- SELECT cron.unschedule('send-trial-reminder-emails');
-- ─────────────────────────────────────────────
