-- ============================================================
-- Fix: create_spa_folio_item nije postavljao restaurant_id
-- ------------------------------------------------------------
-- BUG (pravilo §1 — multi-tenancy): trigger trg_spa_folio
-- (SECURITY DEFINER) upisivao je spa stavku u folio_items BEZ
-- restaurant_id. Kolona je bila nullable, pa je red tiho ulazio
-- s restaurant_id = NULL. Posljedica:
--   • RLS na folio_items je `restaurant_id IN (SELECT ...)` —
--     uz NULL to je uvijek NULL ⇒ stavka NEVIDLJIVA vlasniku i
--     osoblju kroz normalne (RLS-filtrirane) upite;
--   • red nije vezan ni za jedan tenant — curenje invariante.
-- SECURITY DEFINER je zaobilazio RLS pa propušteni restaurant_id
-- nije bacao grešku — tačno tiha klasa buga.
--
-- Ova migracija:
--   1) ispravlja funkciju da postavlja restaurant_id = NEW.restaurant_id
--      (restaurant_id spa termina = tačan tenant);
--   2) backfiluje postojeće NULL redove iz pripadajućeg folija;
--   3) postavlja NOT NULL kao TRAJNI data guard. Svi ostali upisi
--      u folio_items (WaiterView, FolioPage, WaiterDashboard) već
--      postavljaju restaurant_id, pa je guard bezbjedan. Ako prod
--      ima red koji se ne može backfilovati (folio bez restaurant_id),
--      korak 3 će namjerno pasti i poništiti migraciju — fail-safe,
--      umjesto da NOT NULL prođe s prljavim podacima.
-- ============================================================

-- 1) Ispravljena funkcija — dodato restaurant_id u INSERT.
CREATE OR REPLACE FUNCTION create_spa_folio_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_name TEXT;
  v_folio_id     UUID;
BEGIN
  -- Samo za confirmed termine s folio plaćanjem i hotel rezervacijom
  IF NEW.payment_method = 'folio'
     AND NEW.hotel_reservation_id IS NOT NULL
     AND NEW.status = 'confirmed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed')
  THEN
    SELECT name INTO v_service_name
    FROM spa_services WHERE id = NEW.service_id;

    SELECT f.id INTO v_folio_id
    FROM folios f
    WHERE f.reservation_id = NEW.hotel_reservation_id
      AND f.status = 'open'
    LIMIT 1;

    IF v_folio_id IS NOT NULL THEN
      INSERT INTO folio_items (
        folio_id, restaurant_id, type, description,
        quantity, unit_price, total_price, date
      ) VALUES (
        v_folio_id,
        NEW.restaurant_id,                         -- tenant veza (bilo izostavljeno)
        'spa',
        COALESCE(v_service_name, 'Spa tretman') || ' — ' ||
          to_char(NEW.appointment_date, 'DD.MM.YYYY') || ' ' ||
          to_char(NEW.start_time, 'HH24:MI'),
        1,
        NEW.price,
        NEW.price,
        NEW.appointment_date
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- (trigger trg_spa_folio već pokazuje na create_spa_folio_item — ne dira se)

-- 2) Backfill: veži postojeće spa stavke (i sve NULL redove) na tenant folija.
UPDATE folio_items fi
SET restaurant_id = f.restaurant_id
FROM folios f
WHERE fi.folio_id = f.id
  AND fi.restaurant_id IS NULL;

-- 3) Trajni data guard — nijedan folio_item ne smije ostati bez tenanta.
ALTER TABLE folio_items ALTER COLUMN restaurant_id SET NOT NULL;
