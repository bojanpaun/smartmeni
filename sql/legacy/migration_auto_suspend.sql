-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Automatska suspenzija isteklih pretplata
-- =============================================

-- 1. Omogući pg_cron ekstenziju (ako već nije)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Funkcija koja suspenduje istekle naloge
CREATE OR REPLACE FUNCTION suspend_expired_plans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE restaurants
  SET suspended_at = NOW()
  WHERE
    -- Nije već suspendovan
    suspended_at IS NULL
    -- Nije complimentary (ti se nikad ne suspenduju)
    AND (is_complimentary IS NULL OR is_complimentary = false)
    -- Trial je istekao I nije na Pro planu
    AND (
      (trial_ends_at IS NOT NULL AND trial_ends_at < NOW() AND plan != 'pro')
      OR
      -- Pro plan je istekao
      (plan = 'pro' AND plan_expires_at IS NOT NULL AND plan_expires_at < NOW())
    );

  -- Log koliko je restorana suspendirano
  RAISE LOG 'suspend_expired_plans: % restaurants suspended', ROW_COUNT;
END;
$$;

-- 3. Zakaži cron job — svaki dan u 02:00 UTC
SELECT cron.schedule(
  'suspend-expired-plans',     -- naziv joba (mora biti jedinstven)
  '0 2 * * *',                 -- svaki dan u 02:00 UTC
  'SELECT suspend_expired_plans()'
);

-- ─────────────────────────────────────────────
-- PROVJERA: Lista aktivnih cron jobova
-- SELECT * FROM cron.job;
--
-- RUČNO POKRETANJE (za test):
-- SELECT suspend_expired_plans();
--
-- BRISANJE JOBA (ako trebaš ponovo kreirati):
-- SELECT cron.unschedule('suspend-expired-plans');
-- ─────────────────────────────────────────────
