-- ============================================================================
-- Faza N — Noćni audit (Night Audit / EOD)  [dio hotel_core, bez zasebnog addona]
-- ----------------------------------------------------------------------------
-- Svaki hotel mora dnevno zatvoriti dan: prenijeti room charge na otvorene folije,
-- resetovati housekeeping i generisati dnevni finansijski izvještaj.
--
-- Komponente:
--   • night_audit_runs        — jedan red po (restaurant_id, business_date);
--                               UNIQUE = idempotencija + skladište izvještaja
--   • _night_audit_core()     — interna logika (SECURITY DEFINER, BEZ authz)
--   • run_night_audit()       — user RPC (authz owner/staff/superadmin)
--   • run_night_audit_all()   — cron wrapper (zatvara "jučer" za sve hotele)
--
-- Room charge model: stavka po noći. Za svaku checked_in rezervaciju čiji boravak
-- pokriva business_date (check_in <= d < check_out) upisuje se JEDNA room_charge
-- folio stavka (rate_per_night). Idempotentno: ne dupla ako stavka za (folio, datum)
-- već postoji. Check-in više NE seeduje folio punim iznosom (vidi app izmjenu).
-- ============================================================================

-- ── 1. Tabela zapisa audita ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS night_audit_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  business_date        DATE NOT NULL,                 -- dan koji se zatvara
  status               TEXT NOT NULL DEFAULT 'completed',  -- completed
  room_charges_posted  INT  NOT NULL DEFAULT 0,       -- broj upisanih room_charge stavki
  room_charges_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  report               JSONB NOT NULL DEFAULT '{}',   -- snimak dnevnog izvještaja
  run_by               UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  run_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotencija: jedan zatvoreni audit po danu po hotelu
  UNIQUE (restaurant_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_night_audit_runs_restaurant
  ON night_audit_runs(restaurant_id, business_date DESC);

COMMENT ON TABLE night_audit_runs IS
  'Zapis dnevnog noćnog audita (EOD). UNIQUE(restaurant_id, business_date) garantuje '
  'da se room charge ne upisuje dvaput za isti dan i čuva snimak dnevnog izvještaja.';

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE night_audit_runs ENABLE ROW LEVEL SECURITY;

-- Vlasnik upravlja (čita); upis ide isključivo kroz SECURITY DEFINER RPC.
CREATE POLICY "Owner reads night_audit_runs"
  ON night_audit_runs FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

-- Aktivni staff čita (recepcija vidi istoriju audita).
CREATE POLICY "Staff reads night_audit_runs"
  ON night_audit_runs FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM staff WHERE user_id = auth.uid() AND is_active = true));

-- Superadmin pun pristup (podrška/debug).
CREATE POLICY "Superadmin manages night_audit_runs"
  ON night_audit_runs FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ── 3. Interna logika audita (BEZ authz — pozivaju je samo definer funkcije) ──
CREATE OR REPLACE FUNCTION public._night_audit_core(
  p_restaurant_id UUID,
  p_business_date DATE,
  p_run_by        UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_id        UUID;
  v_existing      night_audit_runs%ROWTYPE;
  v_res           RECORD;
  v_folio_id      UUID;
  v_rate          NUMERIC(10,2);
  v_nights        INT;
  v_room_no       TEXT;
  v_posted_cnt    INT := 0;
  v_posted_amt    NUMERIC(12,2) := 0;
  v_total_rooms   INT;
  v_occupied      INT;
  v_revenue       JSONB;
  v_open_checkout JSONB;
  v_report        JSONB;
BEGIN
  -- Idempotencija: atomično "rezerviši" dan. Ako već postoji → vrati postojeći izvještaj.
  INSERT INTO night_audit_runs (restaurant_id, business_date, status, run_by)
  VALUES (p_restaurant_id, p_business_date, 'completed', p_run_by)
  ON CONFLICT (restaurant_id, business_date) DO NOTHING
  RETURNING id INTO v_run_id;

  IF v_run_id IS NULL THEN
    SELECT * INTO v_existing
      FROM night_audit_runs
     WHERE restaurant_id = p_restaurant_id AND business_date = p_business_date;
    RETURN jsonb_build_object(
      'ok', true, 'already_run', true,
      'business_date', p_business_date,
      'room_charges_posted', v_existing.room_charges_posted,
      'room_charges_amount', v_existing.room_charges_amount,
      'report', v_existing.report
    );
  END IF;

  -- ── 3a. Room charge po noći ─────────────────────────────────────────────────
  -- Sve checked_in rezervacije čiji boravak pokriva business_date.
  FOR v_res IN
    SELECT r.id, r.room_id, r.rate_per_night, r.total_amount,
           r.check_in_date, r.check_out_date, r.guest_name,
           rm.room_number
      FROM hotel_reservations r
      LEFT JOIN rooms rm ON rm.id = r.room_id
     WHERE r.restaurant_id = p_restaurant_id
       AND r.status = 'checked_in'
       AND r.check_in_date <= p_business_date
       AND r.check_out_date > p_business_date
  LOOP
    -- Otvoreni folio rezervacije (kreiraj ako fali — defenzivno).
    SELECT id INTO v_folio_id
      FROM folios
     WHERE reservation_id = v_res.id AND status = 'open'
     ORDER BY created_at
     LIMIT 1;

    IF v_folio_id IS NULL THEN
      INSERT INTO folios (reservation_id, restaurant_id, status, total_amount)
      VALUES (v_res.id, p_restaurant_id, 'open', 0)
      RETURNING id INTO v_folio_id;
    END IF;

    -- Idempotencija na nivou stavke: preskoči ako room_charge za taj datum postoji.
    IF EXISTS (
      SELECT 1 FROM folio_items
       WHERE folio_id = v_folio_id AND type = 'room_charge' AND date = p_business_date
    ) THEN
      CONTINUE;
    END IF;

    -- Cijena noći: rate_per_night, fallback total_amount / broj noći.
    v_nights := GREATEST(1, (v_res.check_out_date - v_res.check_in_date));
    v_rate := COALESCE(
      v_res.rate_per_night,
      ROUND(COALESCE(v_res.total_amount, 0) / v_nights, 2)
    );
    v_room_no := COALESCE(v_res.room_number, '—');

    INSERT INTO folio_items (folio_id, restaurant_id, type, description,
                             quantity, unit_price, total_price, date)
    VALUES (
      v_folio_id, p_restaurant_id, 'room_charge',
      'Soba ' || v_room_no || ' — noćenje ' || to_char(p_business_date, 'DD.MM.YYYY'),
      1, v_rate, v_rate, p_business_date
    );

    UPDATE folios
       SET total_amount = COALESCE(total_amount, 0) + v_rate,
           updated_at   = now()
     WHERE id = v_folio_id;

    v_posted_cnt := v_posted_cnt + 1;
    v_posted_amt := v_posted_amt + v_rate;
  END LOOP;

  -- ── 3b. Housekeeping reset ──────────────────────────────────────────────────
  -- Edge-case: sobe i dalje 'occupied' iako je rezervacija checked_out → 'cleaning'.
  UPDATE rooms rm
     SET status = 'cleaning'
   WHERE rm.restaurant_id = p_restaurant_id
     AND rm.status = 'occupied'
     AND EXISTS (
       SELECT 1 FROM hotel_reservations r
        WHERE r.room_id = rm.id
          AND r.status = 'checked_out'
          AND r.check_out_date <= p_business_date
     )
     AND NOT EXISTS (
       SELECT 1 FROM hotel_reservations r2
        WHERE r2.room_id = rm.id
          AND r2.status = 'checked_in'
          AND r2.check_in_date <= p_business_date
          AND r2.check_out_date > p_business_date
     );

  -- ── 3c. Dnevni finansijski izvještaj ────────────────────────────────────────
  -- Prihod po kategoriji (folio stavke datuma business_date).
  SELECT COALESCE(jsonb_object_agg(t.type, t.amt), '{}'::jsonb)
    INTO v_revenue
  FROM (
    SELECT type, SUM(total_price)::NUMERIC(12,2) AS amt
      FROM folio_items
     WHERE restaurant_id = p_restaurant_id AND date = p_business_date
     GROUP BY type
  ) t;

  -- Popunjenost: zauzete sobe / ukupno aktivnih soba.
  SELECT COUNT(*) INTO v_total_rooms
    FROM rooms
   WHERE restaurant_id = p_restaurant_id
     AND status <> 'blocked';

  SELECT COUNT(DISTINCT r.room_id) INTO v_occupied
    FROM hotel_reservations r
   WHERE r.restaurant_id = p_restaurant_id
     AND r.status = 'checked_in'
     AND r.check_in_date <= p_business_date
     AND r.check_out_date > p_business_date
     AND r.room_id IS NOT NULL;

  -- Otvoreni folji za goste koji su već checked_out (flag za naplatu).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'folio_id', f.id,
           'reservation_id', f.reservation_id,
           'guest_name', r.guest_name,
           'total_amount', f.total_amount,
           'paid_amount', f.paid_amount
         )), '[]'::jsonb)
    INTO v_open_checkout
  FROM folios f
  JOIN hotel_reservations r ON r.id = f.reservation_id
  WHERE f.restaurant_id = p_restaurant_id
    AND f.status = 'open'
    AND r.status = 'checked_out';

  v_report := jsonb_build_object(
    'business_date', p_business_date,
    'revenue_by_type', v_revenue,
    'revenue_total', (
      SELECT COALESCE(SUM(total_price), 0)::NUMERIC(12,2)
        FROM folio_items
       WHERE restaurant_id = p_restaurant_id AND date = p_business_date
    ),
    'rooms_total', v_total_rooms,
    'rooms_occupied', v_occupied,
    'occupancy_pct', CASE WHEN v_total_rooms > 0
                          THEN ROUND(100.0 * v_occupied / v_total_rooms, 1)
                          ELSE 0 END,
    'adr', CASE WHEN v_occupied > 0
                THEN ROUND(COALESCE((v_revenue->>'room_charge')::numeric, 0) / v_occupied, 2)
                ELSE 0 END,
    'room_charges_posted', v_posted_cnt,
    'room_charges_amount', v_posted_amt,
    'open_folios_checked_out', v_open_checkout
  );

  -- ── 3d. Finaliziraj zapis ───────────────────────────────────────────────────
  UPDATE night_audit_runs
     SET room_charges_posted = v_posted_cnt,
         room_charges_amount = v_posted_amt,
         report = v_report
   WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'ok', true, 'already_run', false,
    'business_date', p_business_date,
    'room_charges_posted', v_posted_cnt,
    'room_charges_amount', v_posted_amt,
    'report', v_report
  );
END; $$;

-- ── 4. User RPC (authz) ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_night_audit(
  p_restaurant_id UUID,
  p_business_date DATE DEFAULT (timezone('Europe/Podgorica', now()))::date
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = p_restaurant_id AND user_id = v_uid)
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = p_restaurant_id AND user_id = v_uid AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup';
  END IF;

  RETURN public._night_audit_core(
    p_restaurant_id,
    p_business_date,
    (SELECT id FROM user_profiles WHERE id = v_uid)  -- run_by samo ako profil postoji
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.run_night_audit(UUID, DATE) TO authenticated;

COMMENT ON FUNCTION public.run_night_audit(UUID, DATE) IS
  'Pokreće noćni audit za hotel/datum (default: današnji lokalni datum). Authz: '
  'vlasnik/aktivni staff/superadmin. Idempotentno — drugi poziv istog dana vraća '
  'postojeći izvještaj bez ponovnog upisa room charge stavki.';

-- ── 5. Cron wrapper — zatvara "jučer" za sve hotele ──────────────────────────
CREATE OR REPLACE FUNCTION public.run_night_audit_all()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date  DATE := (timezone('Europe/Podgorica', now()) - interval '1 day')::date;
  v_rid   UUID;
  v_count INT := 0;
BEGIN
  FOR v_rid IN
    SELECT id FROM restaurants
     WHERE 'hotel' = ANY (active_verticals)   -- 'hotel' = vertikala (hotel_core je addon)
  LOOP
    PERFORM public._night_audit_core(v_rid, v_date, NULL);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

COMMENT ON FUNCTION public.run_night_audit_all() IS
  'Cron ulaz: zatvara prethodni lokalni dan (Europe/Podgorica) za sve hotele. '
  'Idempotentno preko _night_audit_core.';

-- ── 6. pg_cron — svaki dan 01:00 UTC (~02:00–03:00 lokalno, dan već prošao) ──
-- Napomena: lista hotela ('hotel' vertikala) se gleda u runtime-u, ne u cron-u.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'night-audit-daily') THEN
      PERFORM cron.unschedule('night-audit-daily');
    END IF;
    PERFORM cron.schedule('night-audit-daily', '0 1 * * *', 'SELECT public.run_night_audit_all()');
  END IF;
END $$;
