-- ============================================================================
-- Faza N — Split folio  [dio hotel_core]
-- ----------------------------------------------------------------------------
-- Jedan gost / jedna rezervacija → više folija (npr. "Glavni" + "Firma d.o.o.").
-- Svaka folio stavka se može premjestiti na specifičan folio; svaki folio se
-- naplaćuje i štampa nezavisno (različiti načini plaćanja podržani jer su folji
-- već nezavisni: payment_transactions.source_id = folio.id).
--
-- folios već ima reservation_id (više redova po rezervaciji). Dodajemo:
--   • label       — naziv folija ("Glavni" / "Firma d.o.o." / "Osobni troškovi")
--   • is_primary  — primarni folio rezervacije (cilj room charge-a; kreiran na check-in)
--
-- Noćni audit: gađa najstariji otvoreni folio = primarni (sekundarni se kreiraju
-- kasnije), pa _night_audit_core ostaje nepromijenjen.
-- ============================================================================

-- ── 1. Kolone ────────────────────────────────────────────────────────────────
ALTER TABLE folios ADD COLUMN IF NOT EXISTS label      TEXT;
ALTER TABLE folios ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN folios.is_primary IS
  'Primarni folio rezervacije — cilj room charge stavki iz noćnog audita. '
  'Najstariji folio (kreiran na check-in). Sekundarni folji (split) imaju false.';

-- Backfill: najstariji folio po rezervaciji = primarni (postojeći single-folji).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY reservation_id ORDER BY created_at) AS rn
    FROM folios
)
UPDATE folios f SET is_primary = true
  FROM ranked r
 WHERE f.id = r.id AND r.rn = 1 AND f.is_primary = false;

-- ── 2. Recalc helper — total_amount = Σ stavki ──────────────────────────────
-- Drži folios.total_amount tačnim nakon premještanja stavki (defense-in-depth;
-- klijent inkrementira total na dodavanju, ali split premještanje dira dva folija).
CREATE OR REPLACE FUNCTION public.recalc_folio_total(p_folio_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE folios
     SET total_amount = COALESCE((
           SELECT SUM(total_price) FROM folio_items WHERE folio_id = p_folio_id
         ), 0),
         updated_at = now()
   WHERE id = p_folio_id;
END; $$;

-- ── 3. Kreiranje sekundarnog folija uz rezervaciju ──────────────────────────
CREATE OR REPLACE FUNCTION public.create_secondary_folio(
  p_reservation_id UUID,
  p_label          TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res     RECORD;
  v_uid     UUID := auth.uid();
  v_new_id  UUID;
BEGIN
  IF COALESCE(btrim(p_label), '') = '' THEN
    RAISE EXCEPTION 'Naziv folija je obavezan';
  END IF;

  SELECT id, restaurant_id, guest_id INTO v_res
    FROM hotel_reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rezervacija ne postoji'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = v_res.restaurant_id AND user_id = v_uid)
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = v_res.restaurant_id AND user_id = v_uid AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup';
  END IF;

  INSERT INTO folios (reservation_id, restaurant_id, guest_id, status, total_amount, label, is_primary)
  VALUES (p_reservation_id, v_res.restaurant_id, v_res.guest_id, 'open', 0, btrim(p_label), false)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_secondary_folio(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_secondary_folio(UUID, TEXT) IS
  'Kreira sekundarni (split) folio uz rezervaciju. Authz: vlasnik/aktivni staff/superadmin.';

-- ── 4. Premještanje stavke na drugi folio ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.move_folio_item(
  p_item_id        UUID,
  p_target_folio_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item   RECORD;
  v_src    RECORD;
  v_tgt    RECORD;
  v_uid    UUID := auth.uid();
BEGIN
  SELECT * INTO v_item FROM folio_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stavka ne postoji'; END IF;

  SELECT * INTO v_src FROM folios WHERE id = v_item.folio_id;
  SELECT * INTO v_tgt FROM folios WHERE id = p_target_folio_id;
  IF v_tgt.id IS NULL THEN RAISE EXCEPTION 'Ciljni folio ne postoji'; END IF;

  -- Guard: isti tenant + isti gost/rezervacija (split unutar jedne rezervacije).
  IF v_src.restaurant_id <> v_tgt.restaurant_id THEN
    RAISE EXCEPTION 'Folji nisu iz istog restorana';
  END IF;
  IF v_src.reservation_id IS DISTINCT FROM v_tgt.reservation_id THEN
    RAISE EXCEPTION 'Stavka se može premjestiti samo unutar iste rezervacije';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM restaurants WHERE id = v_src.restaurant_id AND user_id = v_uid)
    OR EXISTS (SELECT 1 FROM staff WHERE restaurant_id = v_src.restaurant_id AND user_id = v_uid AND is_active = true)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nemate pristup';
  END IF;

  IF v_item.folio_id = p_target_folio_id THEN RETURN; END IF;  -- no-op

  UPDATE folio_items SET folio_id = p_target_folio_id WHERE id = p_item_id;

  PERFORM public.recalc_folio_total(v_src.id);
  PERFORM public.recalc_folio_total(p_target_folio_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.move_folio_item(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.move_folio_item(UUID, UUID) IS
  'Premješta folio stavku na drugi folio iste rezervacije i preračuna oba totala. '
  'Authz: vlasnik/aktivni staff/superadmin.';
