-- ============================================================================
-- Beta auto-complimentary — BEFORE INSERT trigger restaurant_beta_complimentary
-- ----------------------------------------------------------------------------
-- Štiti invarijante:
--   • beta ON  ⇒ nov tenant se auto-označi is_complimentary + note 'auto: beta',
--     i to se ogleda i u tenants (ensure_tenant kopira već postavljenu vrijednost).
--   • beta OFF ⇒ nov tenant ostaje običan (is_complimentary = false).
--   • Eksplicitna nota (npr. superadmin) se NE gazi.
--
-- BEGIN ... ROLLBACK (izolovano — toggle beta_free_mode se vraća rollback-om,
-- ne dira test 018 ni druge testove). Pokretanje: supabase test db
-- ============================================================================

BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('sa_betacomp');
SELECT tests.create_supabase_user('owner_beta_off');
SELECT tests.create_supabase_user('owner_beta_on');
INSERT INTO public.user_profiles (id, is_superadmin)
VALUES (tests.get_supabase_uid('sa_betacomp'), true);

-- ─── (1) beta OFF (default): nov tenant NIJE complimentary ────────────────────
SELECT tests.authenticate_as_service_role();
INSERT INTO public.restaurants (id, user_id, name, slug)
VALUES ('dddddddd-5151-4151-8151-515151515151', tests.get_supabase_uid('owner_beta_off'), 'Beta Off', 'beta-off');
SELECT is(
  (SELECT is_complimentary FROM public.restaurants WHERE id = 'dddddddd-5151-4151-8151-515151515151'),
  false,
  'beta OFF ⇒ nov tenant nije complimentary');

-- ─── Superadmin uključuje globalni beta mod ───────────────────────────────────
SELECT tests.authenticate_as('sa_betacomp');
UPDATE public.platform_settings SET beta_free_mode = true WHERE id = true;
SELECT tests.authenticate_as_service_role();

-- ─── (2)(3) beta ON: nov tenant auto-complimentary + nota 'auto: beta' ─────────
INSERT INTO public.restaurants (id, user_id, name, slug)
VALUES ('dddddddd-5252-4252-8252-525252525252', tests.get_supabase_uid('owner_beta_on'), 'Beta On', 'beta-on');
SELECT is(
  (SELECT is_complimentary FROM public.restaurants WHERE id = 'dddddddd-5252-4252-8252-525252525252'),
  true,
  'beta ON ⇒ nov tenant je auto-complimentary');
SELECT is(
  (SELECT complimentary_note FROM public.restaurants WHERE id = 'dddddddd-5252-4252-8252-525252525252'),
  'auto: beta',
  'beta ON ⇒ nota je "auto: beta"');

-- (4) Ogleda se i u tenants (ensure_tenant kopirao već postavljenu vrijednost).
SELECT is(
  (SELECT is_complimentary FROM public.tenants WHERE id = 'dddddddd-5252-4252-8252-525252525252'),
  true,
  'beta ON ⇒ tenants.is_complimentary = true (ensure_tenant kopirao)');

-- (5) Eksplicitna nota se NE gazi (samo se uključi flag ako je bio false).
INSERT INTO public.restaurants (id, user_id, name, slug, complimentary_note)
VALUES ('dddddddd-5353-4353-8353-535353535353', tests.get_supabase_uid('sa_betacomp'), 'Beta Note', 'beta-note', 'partner ugovor');
SELECT is(
  (SELECT complimentary_note FROM public.restaurants WHERE id = 'dddddddd-5353-4353-8353-535353535353'),
  'partner ugovor',
  'beta ON ⇒ postojeća nota se ne pregazi');

SELECT * FROM finish();
ROLLBACK;
