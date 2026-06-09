-- ============================================================================
-- Folio: room charge za cijeli boravak na check-in + politika ranog odlaska
-- ----------------------------------------------------------------------------
-- Problem: Faza N je seedovala folio na 0 (room charge se akumulirao po noći kroz
-- audit), pa je FrontDesk (ugovoreni total) prikazivao drugi iznos od Folija dok
-- audit ne odradi noći. Rješenje: check-in upiše room_charge za SVE noći boravka
-- odmah (itemizovano po noći). Noćni audit ostaje izvještaj + safety (idempotentan).
--
-- Rani odlazak: politika po hotelu (restaurants.early_departure_charge):
--   'stay' = naplati samo odsjedene noći (skini buduće na check-out)
--   'full' = naplati ukupno rezervisano (zadrži sve noći)
-- ============================================================================

-- ── 1. Politika ranog odlaska ────────────────────────────────────────────────
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS early_departure_charge TEXT NOT NULL DEFAULT 'stay'
  CHECK (early_departure_charge IN ('stay', 'full'));

COMMENT ON COLUMN restaurants.early_departure_charge IS
  'Politika naplate pri ranom odlasku: stay = samo odsjedene noći (default), '
  'full = ukupno rezervisano bez obzira na raniji check-out.';

-- ── 2. RPC: upiši room_charge za sve noći boravka (idempotentno) ────────────
CREATE OR REPLACE FUNCTION public.post_stay_room_charges(p_reservation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res     RECORD;
  v_uid     UUID := auth.uid();
  v_folio   UUID;
  v_rate    NUMERIC(10,2);
  v_nights  INT;
  v_room    TEXT;
  v_d       DATE;
  v_posted  INT := 0;
BEGIN
  SELECT r.id, r.restaurant_id, r.room_id, r.guest_id, r.rate_per_night, r.total_amount,
         r.check_in_date, r.check_out_date, rm.room_number
    INTO v_res
    FROM hotel_reservations r
    LEFT JOIN rooms rm ON rm.id = r.room_id
   WHERE r.id = p_reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rezervacija ne postoji'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = v_res.restaurant_id AND user_id = v_uid)
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = v_res.restaurant_id AND user_id = v_uid AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup';
  END IF;

  -- Otvoreni (primarni) folio rezervacije; kreiraj ako fali.
  SELECT id INTO v_folio FROM folios
   WHERE reservation_id = p_reservation_id AND status = 'open'
   ORDER BY is_primary DESC, created_at LIMIT 1;
  IF v_folio IS NULL THEN
    INSERT INTO folios (reservation_id, restaurant_id, guest_id, status, total_amount, is_primary)
    VALUES (p_reservation_id, v_res.restaurant_id, v_res.guest_id, 'open', 0, true)
    RETURNING id INTO v_folio;
  END IF;

  v_nights := GREATEST(1, (v_res.check_out_date - v_res.check_in_date));
  v_rate := COALESCE(v_res.rate_per_night, ROUND(COALESCE(v_res.total_amount, 0) / v_nights, 2));
  v_room := COALESCE(v_res.room_number, '—');

  -- Po jedna stavka za svaku noć [check_in, check_out) — preskoči postojeće.
  v_d := v_res.check_in_date;
  WHILE v_d < v_res.check_out_date LOOP
    IF NOT EXISTS (
      SELECT 1 FROM folio_items
       WHERE folio_id = v_folio AND type = 'room_charge' AND date = v_d
    ) THEN
      INSERT INTO folio_items (folio_id, restaurant_id, type, description, quantity, unit_price, total_price, date)
      VALUES (v_folio, v_res.restaurant_id, 'room_charge',
              'Soba ' || v_room || ' — noćenje ' || to_char(v_d, 'DD.MM.YYYY'),
              1, v_rate, v_rate, v_d);
      v_posted := v_posted + 1;
    END IF;
    v_d := v_d + 1;
  END LOOP;

  PERFORM public.recalc_folio_total(v_folio);
  RETURN jsonb_build_object('ok', true, 'folio_id', v_folio, 'posted', v_posted, 'nights', v_nights);
END; $$;

GRANT EXECUTE ON FUNCTION public.post_stay_room_charges(UUID) TO authenticated;

COMMENT ON FUNCTION public.post_stay_room_charges(UUID) IS
  'Upisuje room_charge folio stavku za svaku noć boravka (idempotentno) i preračuna '
  'folio total. Poziva se na check-in. Authz: vlasnik/aktivni staff/superadmin.';
