-- ================================================================
-- Rate Plan Rooms: veza rate_plan ↔ konkretna soba (opciona)
--
-- Logika:
--   Ako plan NEMA zapisa u rate_plan_rooms → važi za sve sobe room_type_id
--   Ako plan IMA zapise                   → važi samo za te sobe
--
-- Bonus: get_room_packages sada vraća payment_type i provjerava
--        dostupnost na nivou specifičnih soba.
-- ================================================================

-- ── 1. Junction tabela ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_plan_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id  UUID NOT NULL REFERENCES rate_plans(id) ON DELETE CASCADE,
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rate_plan_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_rate_plan_rooms_plan ON rate_plan_rooms(rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_rate_plan_rooms_room ON rate_plan_rooms(room_id);

ALTER TABLE rate_plan_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages rate_plan_rooms"
  ON rate_plan_rooms FOR ALL
  USING (rate_plan_id IN (
    SELECT rp.id FROM rate_plans rp
    JOIN restaurants rest ON rest.id = rp.restaurant_id
    WHERE rest.user_id = auth.uid()
  ));

CREATE POLICY "Public reads rate_plan_rooms"
  ON rate_plan_rooms FOR SELECT
  USING (true);

-- ── 2. Ažurirana get_room_packages ──────────────────────────────
--   - Vraća payment_type (fix: booking stranica nije znala online vs on_arrival)
--   - Filtrira planove koji imaju specifične sobe prema dostupnosti

DROP FUNCTION IF EXISTS get_room_packages(UUID, UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION get_room_packages(
  p_room_type_id  UUID,
  p_restaurant_id UUID,
  p_check_in      DATE,
  p_check_out     DATE
)
RETURNS TABLE (
  rate_plan_id        UUID,
  plan_name           TEXT,
  plan_description    TEXT,
  price_per_night     NUMERIC,
  total_price         NUMERIC,
  nights              INT,
  cancellation_policy TEXT,
  min_stay            INT,
  payment_type        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
  v_mult   NUMERIC;
BEGIN
  -- Aktivni sezonski multiplikator
  SELECT COALESCE(
    (SELECT rp0.multiplier
     FROM rate_plans rp0
     WHERE rp0.restaurant_id = p_restaurant_id
       AND rp0.plan_type     = 'seasonal'
       AND rp0.is_active     = true
       AND (rp0.applies_from  IS NULL OR rp0.applies_from  <= p_check_in)
       AND (rp0.applies_until IS NULL OR rp0.applies_until >= p_check_out)
     ORDER BY rp0.multiplier DESC
     LIMIT 1),
    1.0
  ) INTO v_mult;

  RETURN QUERY
  SELECT
    rp.id,
    rp.name,
    rp.description,
    ROUND(rp.price_per_night * v_mult, 2),
    ROUND(rp.price_per_night * v_mult * v_nights, 2),
    v_nights,
    rp.cancellation_policy,
    rp.min_stay,
    COALESCE(rp.payment_type, 'online')
  FROM rate_plans rp
  WHERE rp.room_type_id  = p_room_type_id
    AND rp.restaurant_id = p_restaurant_id
    AND rp.plan_type     = 'package'
    AND rp.is_active     = true
    AND rp.min_stay      <= v_nights
    AND (
      -- Plan bez specificnih soba → dostupan (room_type nivo vec provjeren)
      NOT EXISTS (
        SELECT 1 FROM rate_plan_rooms rpr
        WHERE rpr.rate_plan_id = rp.id
      )
      OR
      -- Plan sa specificnim sobama → barem jedna slobodna za trazeni period
      EXISTS (
        SELECT 1
        FROM rate_plan_rooms rpr
        JOIN rooms r ON r.id = rpr.room_id
        WHERE rpr.rate_plan_id = rp.id
          AND r.status = 'available'
          AND NOT EXISTS (
            SELECT 1 FROM hotel_reservations hr
            WHERE hr.room_id         = r.id
              AND hr.status         NOT IN ('cancelled', 'no_show')
              AND hr.check_in_date  < p_check_out
              AND hr.check_out_date > p_check_in
          )
      )
    )
  ORDER BY rp.price_per_night ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO authenticated;
