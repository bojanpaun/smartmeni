-- ============================================================================
-- guest_exists(restaurant, phone, email) — detekcija duplikata pri registraciji
-- ----------------------------------------------------------------------------
-- Gost registracija je anon i RLS namjerno NE dozvoljava anonu da čita tuđe
-- guests redove (posebno `pending`). Zato duplikat ne možemo provjeriti običnim
-- SELECT-om s klijenta. Ovaj SECURITY DEFINER helper vraća SAMO coarse kod
-- ('pending' | 'exists' | 'none') — bez izlaganja podataka i bez otkrivanja
-- 'blacklist' statusa (blacklist se gleda kao 'exists').
--
-- Vezano: GuestRegisterPage (poruka 'već registrovani / zahtjev već poslat').
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guest_exists(
  p_restaurant_id UUID,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN bool_or(status = 'pending') THEN 'pending'
    WHEN count(*) > 0                THEN 'exists'
    ELSE 'none'
  END
  FROM public.guests
  WHERE restaurant_id = p_restaurant_id
    AND (
      (p_phone IS NOT NULL AND p_phone <> '' AND phone = p_phone)
      OR (p_email IS NOT NULL AND p_email <> '' AND email = p_email)
    );
$$;

GRANT EXECUTE ON FUNCTION public.guest_exists(UUID, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.guest_exists(UUID, TEXT, TEXT) IS
  'Detekcija duplikata gosta pri anon registraciji. Vraća pending|exists|none (blacklist→exists). Ne izlaže podatke gosta.';
