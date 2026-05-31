-- Odvojen status po stanici za svaku narudžbu
-- kitchen_status: NULL = nije relevantno, 'preparing' = u pripremi, 'ready' = gotovo
-- bar_status:     NULL = nije relevantno, 'preparing' = u pripremi, 'ready' = gotovo

ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bar_status text;

CREATE INDEX IF NOT EXISTS idx_orders_kitchen_status ON orders(kitchen_status);
CREATE INDEX IF NOT EXISTS idx_orders_bar_status     ON orders(bar_status);
