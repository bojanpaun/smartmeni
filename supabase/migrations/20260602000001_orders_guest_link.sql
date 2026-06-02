-- Poveži orders.guest_id sa gostom automatski kada narudžba ide na folio
-- i backfillaj postojeće narudžbe.

-- ── 1. Trigger: kad se orders.folio_id postavi, kopiraj guest_id iz folija ──

CREATE OR REPLACE FUNCTION trg_fn_order_link_guest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.folio_id IS NOT NULL AND NEW.guest_id IS NULL THEN
    SELECT f.guest_id INTO NEW.guest_id
    FROM folios f
    WHERE f.id = NEW.folio_id AND f.guest_id IS NOT NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_link_guest ON orders;
CREATE TRIGGER trg_order_link_guest
  BEFORE INSERT OR UPDATE OF folio_id ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_fn_order_link_guest();

-- ── 2. Backfill: popuni guest_id za postojeće narudžbe sa folio_id ───────────

UPDATE orders o
SET guest_id = f.guest_id
FROM folios f
WHERE o.folio_id = f.id
  AND f.guest_id IS NOT NULL
  AND o.guest_id IS NULL;

-- ── 3. Index za efikasan lookup po guest_id ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_guest_id ON orders(guest_id)
  WHERE guest_id IS NOT NULL;
