-- Folio integracija: veza između restoran narudžbi i hotelskog folija
ALTER TABLE orders ADD COLUMN IF NOT EXISTS folio_id UUID REFERENCES folios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_folio ON orders(folio_id) WHERE folio_id IS NOT NULL;
