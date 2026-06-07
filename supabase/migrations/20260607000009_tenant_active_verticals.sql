-- ============================================================================
-- 2b · FAZA 3 — aktivne vertikale po tenantu (nezavisne vertikale)
-- ----------------------------------------------------------------------------
-- `active_verticals` je IZVOR za to KOJE vertikale tenant koristi (restoran,
-- hotel, buduće). Odvojeno od plaćenih addona (subscriptions.addons) — izbor
-- biznisa nije isto što i plaćeni feature. Default '{restaurant}'.
--
-- Backfill: svi postojeći imaju restoran (danas uvijek uključen); dodaj 'hotel'
-- gdje postoje hotelski podaci (room_types) ili je hotel_core u addonima.
-- Hotel nav i dalje (zasad) gejtuje hasAddon('hotel_core'); 'hotel' u
-- active_verticals je tu da kasnija faza unificira gating bez nove migracije.
-- ============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS active_verticals TEXT[] NOT NULL DEFAULT '{restaurant}';

UPDATE public.tenants t SET active_verticals =
  ARRAY['restaurant']::text[] ||
  CASE
    WHEN EXISTS (SELECT 1 FROM public.room_types rt WHERE rt.restaurant_id = t.id)
      OR EXISTS (SELECT 1 FROM public.subscriptions s
                  WHERE s.restaurant_id = t.id AND s.addons ? 'hotel_core')
    THEN ARRAY['hotel']::text[]
    ELSE ARRAY[]::text[]
  END;
