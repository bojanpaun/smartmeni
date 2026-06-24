-- ════════════════════════════════════════════════════════════════════════
-- INVENTORY PRO v2 — Faza 1: Registar dobavljača (suppliers)
--   • suppliers tabela (per-tenant) + preferirani dobavljač na inventory_items
--   • Gating: inventory_pro addon (frontend); RLS = owner-only (kao inventory_items)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name           text NOT NULL,
  contact_person text,
  email          text,
  phone          text,
  -- kategorija dobavljača (F&B / Spa / Housekeeping / Tehničko / Ostalo)
  category       text NOT NULL DEFAULT 'fnb'
                   CHECK (category IN ('fnb','spa','housekeeping','technical','other')),
  payment_terms  text,                 -- slobodan tekst: rokovi/popusti
  lead_days      integer,              -- prosječno vrijeme isporuke (dani)
  rating         integer CHECK (rating BETWEEN 1 AND 5),  -- admin ocjena 1–5 (NULL = bez)
  note           text,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.suppliers IS
  'Registar dobavljača tenanta (Inventory Pro v2). Owner-only RLS kao inventory_items.';

CREATE INDEX IF NOT EXISTS idx_suppliers_restaurant ON public.suppliers (restaurant_id);

-- Preferirani dobavljač po stavci zalihe (ON DELETE SET NULL — brisanje dobavljača
-- ne briše stavku, samo skida vezu).
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- ── RLS (owner-only, ogledalo postojećeg inventory_items obrasca) ───────────
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vlasnik upravlja dobavljačima" ON public.suppliers
  FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

-- updated_at touch
CREATE OR REPLACE FUNCTION public.touch_suppliers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_suppliers_updated_at();
