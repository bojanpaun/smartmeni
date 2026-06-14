-- ============================================================================
-- require_tenant_approval flag — trigger bira početni approval_status zavisno od
-- globalnog prekidača. BEGIN ... ROLLBACK. Pokretanje: supabase test db
-- ----------------------------------------------------------------------------
-- (1) flag=true  → autentifikovani ne-superadmin insert dobija 'pending'
-- (2) flag=false → isti insert dobija 'approved' (registracija odmah aktivna)
-- ============================================================================

BEGIN;
SELECT plan(2);

SELECT tests.create_supabase_user('ra_u');

-- ── (1) require_tenant_approval = true (default) → pending ────────────────────
SELECT tests.authenticate_as_service_role();
UPDATE platform_settings SET require_tenant_approval = true;

SELECT tests.authenticate_as('ra_u');
INSERT INTO restaurants (user_id, name, slug, approval_status)
  VALUES (tests.get_supabase_uid('ra_u'), 'RA On', 'ra-on', 'approved');

SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT approval_status FROM restaurants WHERE slug = 'ra-on'),
  'pending',
  'Kad je require_tenant_approval=true, nova registracija ide na pending');

-- ── (2) require_tenant_approval = false → approved odmah ──────────────────────
UPDATE platform_settings SET require_tenant_approval = false;

SELECT tests.authenticate_as('ra_u');
INSERT INTO restaurants (user_id, name, slug, approval_status)
  VALUES (tests.get_supabase_uid('ra_u'), 'RA Off', 'ra-off', 'pending');

SELECT tests.authenticate_as_service_role();
SELECT is(
  (SELECT approval_status FROM restaurants WHERE slug = 'ra-off'),
  'approved',
  'Kad je require_tenant_approval=false, nova registracija je odmah approved');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
