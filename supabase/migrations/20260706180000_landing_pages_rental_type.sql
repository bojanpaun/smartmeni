-- ============================================================================
-- landing_pages — dozvoli page_type='rental' (rental landing hub /:slug/rentals).
-- Ranije CHECK samo ('hotel','restaurant'). Editor/renderer po istom obrascu.
-- ============================================================================

ALTER TABLE public.landing_pages DROP CONSTRAINT IF EXISTS landing_pages_page_type_check;
ALTER TABLE public.landing_pages
  ADD CONSTRAINT landing_pages_page_type_check CHECK (page_type IN ('hotel', 'restaurant', 'rental'));
