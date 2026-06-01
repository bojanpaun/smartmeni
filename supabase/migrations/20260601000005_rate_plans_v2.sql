-- Rate Plans v2: plan_type (package|seasonal), room_type_id FK, multiplier
-- Package = fiksna cijena po tipu sobe
-- Seasonal = hotel-wide multiplikator za period (primjenjuje se na base_price i packagee)

-- ── 1. Proširi rate_plans tabelu ──────────────────────────────────────────────

ALTER TABLE rate_plans
  ADD COLUMN IF NOT EXISTS room_type_id  UUID REFERENCES room_types(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_type     TEXT NOT NULL DEFAULT 'package',
  ADD COLUMN IF NOT EXISTS multiplier    NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS applies_from  DATE,
  ADD COLUMN IF NOT EXISTS applies_until DATE;

DO $$ BEGIN
  ALTER TABLE rate_plans
    ADD CONSTRAINT chk_rate_plan_type CHECK (plan_type IN ('package','seasonal'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. get_available_rooms — has_packages + seasonal multiplier ───────────────

DROP FUNCTION IF EXISTS get_available_rooms(UUID, DATE, DATE, BIGINT);

CREATE OR REPLACE FUNCTION get_available_rooms(
  p_restaurant_id UUID,
  p_check_in      DATE,
  p_check_out     DATE,
  p_adults        BIGINT DEFAULT 1
)
RETURNS TABLE (
  room_type_id    UUID,
  name            TEXT,
  description     TEXT,
  max_occupancy   INT,
  amenities       JSONB,
  images          JSONB,
  available_count INT,
  price_per_night NUMERIC,
  total_price     NUMERIC,
  nights          INT,
  has_packages    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
BEGIN
  IF v_nights <= 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH
  active_mult AS (
    -- Najveći aktivni seasonal multiplier koji pokriva cijeli period
    SELECT COALESCE(
      (SELECT rp1.multiplier
       FROM rate_plans rp1
       WHERE rp1.restaurant_id = p_restaurant_id
         AND rp1.plan_type     = 'seasonal'
         AND rp1.is_active     = true
         AND (rp1.applies_from  IS NULL OR rp1.applies_from  <= p_check_in)
         AND (rp1.applies_until IS NULL OR rp1.applies_until >= p_check_out)
       ORDER BY rp1.multiplier DESC
       LIMIT 1),
      1.0
    ) AS m
  ),
  pkg_summary AS (
    -- Najniža cijena i broj aktivnih paketa po tipu sobe
    SELECT
      rp2.room_type_id         AS ps_rt_id,
      MIN(rp2.price_per_night) AS ps_min_price,
      COUNT(*)                 AS ps_count
    FROM rate_plans rp2
    WHERE rp2.restaurant_id = p_restaurant_id
      AND rp2.plan_type     = 'package'
      AND rp2.room_type_id  IS NOT NULL
      AND rp2.is_active     = true
      AND rp2.min_stay      <= v_nights
    GROUP BY rp2.room_type_id
  )
  SELECT
    rt.id,
    rt.name,
    rt.description,
    rt.max_occupancy,
    COALESCE(rt.amenities, '[]'::JSONB),
    COALESCE(rt.images,    '[]'::JSONB),
    MIN(ra.available_rooms)::INT,
    ROUND(COALESCE(ps.ps_min_price, rt.base_price) * am.m, 2),
    ROUND(COALESCE(ps.ps_min_price, rt.base_price) * am.m * v_nights, 2),
    v_nights,
    (COALESCE(ps.ps_count, 0) > 0)
  FROM room_types rt
  JOIN room_availability ra ON ra.room_type_id = rt.id
  CROSS JOIN active_mult am
  LEFT JOIN pkg_summary ps ON ps.ps_rt_id = rt.id
  WHERE rt.restaurant_id   = p_restaurant_id
    AND rt.max_occupancy   >= p_adults
    AND rt.is_active       = true
    AND rt.base_price      IS NOT NULL
    AND ra.date            >= p_check_in
    AND ra.date            < p_check_out
    AND ra.available_rooms > 0
    AND ra.stop_sell       = false
  GROUP BY rt.id, rt.name, rt.description, rt.max_occupancy,
           rt.amenities, rt.images, ps.ps_min_price, rt.base_price,
           am.m, ps.ps_count
  HAVING COUNT(DISTINCT ra.date) = v_nights
  ORDER BY ROUND(COALESCE(ps.ps_min_price, rt.base_price) * am.m, 2) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION get_available_rooms(UUID, DATE, DATE, BIGINT) TO authenticated;

-- ── 3. get_room_packages — paketi za odabrani tip sobe ───────────────────────

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
  min_stay            INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nights INT := p_check_out - p_check_in;
  v_mult   NUMERIC;
BEGIN
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
    rp.min_stay
  FROM rate_plans rp
  WHERE rp.room_type_id  = p_room_type_id
    AND rp.restaurant_id = p_restaurant_id
    AND rp.plan_type     = 'package'
    AND rp.is_active     = true
    AND rp.min_stay      <= v_nights
  ORDER BY rp.price_per_night ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO anon;
GRANT EXECUTE ON FUNCTION get_room_packages(UUID, UUID, DATE, DATE) TO authenticated;
