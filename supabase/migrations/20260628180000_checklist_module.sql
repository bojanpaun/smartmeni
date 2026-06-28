-- ============================================================================
-- „Početni koraci" — grupisanje po modulu na admin početnoj.
-- ----------------------------------------------------------------------------
-- dashboard_checklist_steps.module: ključ modula (menu/tables/hr/inventory/hotel/
-- spa/rental/analytics/guests) za grupisanje koraka u sekcije na ControlPanel-u.
-- NULL = opšta sekcija („Osnovno" / Pokreni biznis) — cross-modul prvi koraci.
-- Slobodan tekst (bez CHECK-a) jer se skup modula mijenja; superadmin bira iz
-- dropdown-a u editoru.
-- ============================================================================

ALTER TABLE public.dashboard_checklist_steps
  ADD COLUMN IF NOT EXISTS module text;

COMMENT ON COLUMN public.dashboard_checklist_steps.module IS
  'Modul za grupisanje koraka u sekcije na početnoj (menu/tables/hr/inventory/...). NULL = opšta sekcija (Osnovno).';

-- Dodijeli module postojećim seed-koracima (logo i fiskalizacija ostaju NULL =
-- Osnovno; ostali idu pod svoj modul) — da grupisanje odmah bude smisleno.
UPDATE public.dashboard_checklist_steps SET module = 'menu'
  WHERE module IS NULL AND path IN ('/admin/menu', '/admin/menu/qr');
UPDATE public.dashboard_checklist_steps SET module = 'tables'
  WHERE module IS NULL AND path = '/admin/tables';
UPDATE public.dashboard_checklist_steps SET module = 'hr'
  WHERE module IS NULL AND path = '/admin/hr/staff';
