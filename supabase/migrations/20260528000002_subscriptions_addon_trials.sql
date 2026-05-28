-- Faza 1: addon_trials kolona za praćenje trial perioda po addonу
-- Datum: 2026-05-28

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS addon_trials JSONB DEFAULT '{}';

-- addon_trials format: { "hotel_core": "2026-06-11T00:00:00Z", "inventory_pro": "2026-06-15T00:00:00Z" }
-- Svaki ključ je addon ID, vrijednost je datum isteka triala

-- Dozvoli vlasniku da aktivira addon (INSERT/UPDATE na vlastitoj pretplati)
CREATE POLICY "Owner manages own subscription"
  ON subscriptions FOR ALL
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );
