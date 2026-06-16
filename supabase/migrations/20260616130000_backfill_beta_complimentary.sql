-- ============================================================================
-- Backfill — postojeći beta-era "starter" tenanti → complimentary (auto: beta)
-- ----------------------------------------------------------------------------
-- Trigger restaurant_beta_complimentary (20260616120000) hvata SAMO nove tenante.
-- Ovaj jednokratni backfill pokriva tenante kreirane PRIJE trigera koji su ostali
-- na starteru — da i oni dobiju besplatni pristup bez ručnog dodavanja complimentary.
--
-- Guard: izvršava se SAMO ako je globalni beta mod trenutno ON. U svježoj/test/CI
-- bazi je beta_free_mode=false (default) ⇒ no-op (test-neutralno).
--
-- Piše u restaurants (writer strana); AFTER UPDATE mirror (20260607000008) sinhronizuje
-- tenants.is_complimentary. Ne dira plaćene, već-complimentary ni suspendovane naloge.
-- Nota 'auto: beta' omogućava masovno čišćenje kad beta završi (isključi is_complimentary).
-- ============================================================================

UPDATE public.restaurants r
SET is_complimentary   = true,
    complimentary_note = COALESCE(NULLIF(r.complimentary_note, ''), 'auto: beta')
WHERE COALESCE(r.is_complimentary, false) = false
  AND COALESCE(r.plan, 'starter') NOT IN ('restaurant', 'hotel', 'hotel_pro', 'enterprise', 'pro')
  AND r.suspended_at IS NULL
  AND COALESCE((SELECT beta_free_mode FROM public.platform_settings LIMIT 1), false) = true;
