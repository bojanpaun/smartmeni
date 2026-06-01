-- guests.first_name je NOT NULL; trigger je koristio samo 'name' kolonu.
-- Fix: popuni first_name/last_name splitom iz guest_name, last_name nullable.

ALTER TABLE guests ALTER COLUMN last_name DROP NOT NULL;

CREATE OR REPLACE FUNCTION trg_fn_auto_create_guest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gid       UUID;
  v_fname     TEXT;
  v_lname     TEXT;
  v_space_pos INT;
BEGIN
  IF NEW.guest_id IS NULL AND NEW.guest_email IS NOT NULL AND NEW.guest_email <> '' THEN
    SELECT id INTO v_gid FROM guests
    WHERE restaurant_id = NEW.restaurant_id AND lower(email) = lower(NEW.guest_email)
    LIMIT 1;

    -- Split guest_name u first/last
    v_space_pos := position(' ' IN trim(NEW.guest_name));
    IF v_space_pos > 0 THEN
      v_fname := trim(substring(NEW.guest_name FROM 1 FOR v_space_pos));
      v_lname := trim(substring(NEW.guest_name FROM v_space_pos + 1));
    ELSE
      v_fname := trim(NEW.guest_name);
      v_lname := NULL;
    END IF;

    IF v_gid IS NULL THEN
      INSERT INTO guests (restaurant_id, name, first_name, last_name, email, phone)
      VALUES (NEW.restaurant_id, NEW.guest_name, v_fname, v_lname,
              lower(NEW.guest_email), NEW.guest_phone)
      RETURNING id INTO v_gid;
    ELSE
      UPDATE guests
      SET last_visit_at = now(),
          name         = COALESCE(NULLIF(name, ''), NEW.guest_name),
          first_name   = COALESCE(NULLIF(first_name, ''), v_fname),
          phone        = COALESCE(phone, NEW.guest_phone)
      WHERE id = v_gid;
    END IF;

    NEW.guest_id := v_gid;
  END IF;
  RETURN NEW;
END;
$$;
