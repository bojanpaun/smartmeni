-- ============================================================================
-- RENT: rental_visibility na restaurants — kontroliše „Iznajmi smještaj" dugme na
-- javnom meniju (i drugim površinama) za miješane tenante (restoran/hotel + rental).
-- Isti obrazac kao hotel_visibility/reservation_visibility. Default 'off'.
-- ============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS rental_visibility text DEFAULT 'off';
COMMENT ON COLUMN public.restaurants.rental_visibility IS
  'Vidljivost „Iznajmi smještaj" linka na javnim površinama (off|all). Prikazuje se samo ako tenant ima rental vertikalu.';
