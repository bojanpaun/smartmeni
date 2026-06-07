-- ============================================================================
-- Minibar — katalog artikala (Faza P). Zaduženje ide na folio (type 'minibar',
-- folio_items već podržava taj tip). Katalog je hotel-wide (po restoranu/tenantu).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.minibar_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         NUMERIC(10,2),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_minibar_items_restaurant ON public.minibar_items(restaurant_id);

ALTER TABLE public.minibar_items ENABLE ROW LEVEL SECURITY;

-- Vlasnik i aktivni staff čitaju (staff zadužuje minibar na folio).
CREATE POLICY "Owner/staff read minibar" ON public.minibar_items FOR SELECT USING (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
  OR restaurant_id IN (SELECT restaurant_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true)
  OR public.is_superadmin()
);
-- Vlasnik/superadmin upravljaju katalogom.
CREATE POLICY "Owner manages minibar" ON public.minibar_items FOR ALL USING (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin()
) WITH CHECK (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin()
);
