-- ============================================================================
-- Task traka (admin početna): dodaj prečicu „Hardver i oprema" → /admin/settings/hardware.
-- Bez gatinga (vertical/perm/addon NULL) → vidljivo svim tenantima. label=izvor 'me';
-- prevodi se kroz library_translations (entity_type=dashboard_task) — do tada fallback na me.
-- Idempotentno: ne dupliraj ako stavka sa tom putanjom već postoji.
-- ============================================================================

INSERT INTO public.dashboard_tasks (sort_order, icon, label, path)
SELECT 90, '🖨️', 'Hardver i oprema', '/admin/settings/hardware'
WHERE NOT EXISTS (
  SELECT 1 FROM public.dashboard_tasks WHERE path = '/admin/settings/hardware'
);
