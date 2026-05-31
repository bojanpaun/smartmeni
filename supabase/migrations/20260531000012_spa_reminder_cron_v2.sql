-- ================================================================
-- Spa reminder v2: call_spa_reminder() sa hardkodiranim URL/key
-- (ALTER DATABASE nije dozvoljen u Supabase migracijama)
-- ================================================================

CREATE OR REPLACE FUNCTION call_spa_reminder()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://twtgzrngzretcvyeqpxm.supabase.co/functions/v1/send-spa-reminder',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3dGd6cm5nenJldGN2eWVxcHhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA2OTQ2NywiZXhwIjoyMDkxNjQ1NDY3fQ.Brgyq5Pk1QrKlxaeXD1t3akfol3xMxRWFJXk_V8TcU0'
    ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Obnovi cron job sa ažuriranom funkcijom
SELECT cron.unschedule('spa-reminders');
SELECT cron.schedule(
  'spa-reminders',
  '*/15 * * * *',
  'SELECT call_spa_reminder()'
);
