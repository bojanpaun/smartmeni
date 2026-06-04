-- fn_restore_room_availability: vraća dostupnost sobe pri otkazivanju/refundu
-- Poziva se iz payments-refund Edge Function za svaki datum otkazane rezervacije
CREATE OR REPLACE FUNCTION fn_restore_room_availability(
  p_room_type_id UUID,
  p_date         DATE
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE room_availability
  SET available_rooms = LEAST(total_rooms, available_rooms + 1),
      updated_at      = now()
  WHERE room_type_id = p_room_type_id
    AND date         = p_date;
  -- Ako red ne postoji, ne radi ništa (može se desiti za stare rezervacije)
END;
$$;
