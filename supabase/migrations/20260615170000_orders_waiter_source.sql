-- ============================================================================
-- Faza WO (1/2 šema) — orders metapodaci za konobarski unos narudžbe
-- ----------------------------------------------------------------------------
-- Konobarska narudžba koristi ISTE tabele kao gostova (orders+order_items).
-- Dodajemo samo atribuciju: ko je kreirao (guest QR vs waiter ručni unos) i koji
-- zaposleni — za analitiku i (opciono) UI gating. `preparing` je već u
-- orders_status_check (bez izmjene constraint-a). order_items.note već postoji.
-- Spec: docs/spec-konobarski-unos-narudzbe.md (v1.1).
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'guest'
    CHECK (source IN ('guest','waiter')),
  ADD COLUMN IF NOT EXISTS created_by_staff_id uuid REFERENCES public.staff(id);

COMMENT ON COLUMN public.orders.source IS
  'Ko je kreirao narudžbu: guest (QR/online) ili waiter (ručni unos u portalu zaposlenih).';
COMMENT ON COLUMN public.orders.created_by_staff_id IS
  'Zaposleni koji je unio narudžbu (samo za source=waiter); NULL za gost-narudžbe.';

-- Brzo pronalaženje OTVORENE narudžbe po stolu (append + indikator zauzetosti stola).
CREATE INDEX IF NOT EXISTS idx_orders_open_by_table
  ON public.orders (restaurant_id, table_number)
  WHERE status <> 'closed';
