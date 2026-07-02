-- ============================================================================
-- DB test: handle_new_user trigger auto-kreira public.user_profiles red za
-- svakog novog auth.users korisnika (invariant iza per-korisnik postavki —
-- checklist_dismissed, dashboard_kpis, profil). BEGIN ... ROLLBACK.
-- ============================================================================

BEGIN;
SELECT plan(2);

-- 1) Kreiranje auth korisnika → profil red postoji (trigger odradio).
SELECT tests.create_supabase_user('pa_auto');
SELECT ok(
  EXISTS (SELECT 1 FROM public.user_profiles WHERE id = tests.get_supabase_uid('pa_auto')),
  'handle_new_user auto-kreira user_profiles red za novog auth korisnika'
);

-- 2) Trigger je stvarno vezan na auth.users.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_created'
      AND NOT tgisinternal
  ),
  'trigger on_auth_user_created postoji na auth.users'
);

SELECT * FROM finish();
ROLLBACK;
