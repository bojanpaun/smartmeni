-- ============================================================================
-- 2b · FAZA 5 (sigurni dio) — ukloni vestigijalni tenants.active_verticals
-- ----------------------------------------------------------------------------
-- Izvor vertikala je restaurants.active_verticals (javno čitljiv, Faza 4c).
-- tenants.active_verticals (Faza 3) više se NIGDJE ne čita (provjereno grep-om) —
-- uklanjamo da ne bude dva izvora.
-- ============================================================================

ALTER TABLE public.tenants DROP COLUMN IF EXISTS active_verticals;
