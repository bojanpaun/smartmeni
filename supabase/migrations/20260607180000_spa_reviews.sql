-- ============================================================================
-- Spa recenzije/ocjene terapeuta — spa_reviews + auto-rating trigger + submit RPC
-- ----------------------------------------------------------------------------
-- spa_therapists.rating je oduvijek postojao ali se nije punio. Ovo dodaje:
--   • spa_reviews (jedna recenzija po terminu), RLS izolacija po restoranu
--   • trigger koji preračunava spa_therapists.rating = avg(rating)
--   • submit_spa_review() — SECURITY DEFINER da gost (anon) može ocijeniti svoj
--     termin bez direktnog write pristupa tabeli
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.spa_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  appointment_id UUID UNIQUE REFERENCES public.spa_appointments(id) ON DELETE CASCADE,
  therapist_id   UUID REFERENCES public.spa_therapists(id) ON DELETE SET NULL,
  service_id     UUID REFERENCES public.spa_services(id) ON DELETE SET NULL,
  guest_id       UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  rating         INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spa_reviews_therapist  ON public.spa_reviews(therapist_id);
CREATE INDEX IF NOT EXISTS idx_spa_reviews_restaurant ON public.spa_reviews(restaurant_id);

ALTER TABLE public.spa_reviews ENABLE ROW LEVEL SECURITY;

-- Čitaju vlasnik, aktivni staff, superadmin (recenzije nisu javne).
CREATE POLICY "Owner/staff read spa reviews" ON public.spa_reviews FOR SELECT USING (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
  OR restaurant_id IN (SELECT restaurant_id FROM public.staff WHERE user_id = auth.uid() AND is_active = true)
  OR public.is_superadmin()
);
-- Vlasnik/superadmin upravljaju (npr. brisanje neprimjerene recenzije).
CREATE POLICY "Owner manages spa reviews" ON public.spa_reviews FOR ALL USING (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin()
) WITH CHECK (
  restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin()
);

-- ─── Auto-rating: avg(rating) → spa_therapists.rating ───────────────────────
CREATE OR REPLACE FUNCTION public.recompute_spa_therapist_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ther UUID := COALESCE(NEW.therapist_id, OLD.therapist_id);
BEGIN
  IF v_ther IS NOT NULL THEN
    UPDATE public.spa_therapists
      SET rating = (SELECT round(avg(rating)::numeric, 2) FROM public.spa_reviews WHERE therapist_id = v_ther)
      WHERE id = v_ther;
  END IF;
  RETURN NULL;
END; $$;

-- Drži spa_therapists.rating sinhronim sa prosjekom recenzija.
CREATE TRIGGER trg_spa_review_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.spa_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recompute_spa_therapist_rating();

-- ─── submit_spa_review: gost ocjenjuje svoj termin (anon-safe) ───────────────
CREATE OR REPLACE FUNCTION public.submit_spa_review(
  p_appointment_id UUID, p_rating INT, p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Ocjena mora biti između 1 i 5';
  END IF;
  SELECT restaurant_id, therapist_id, service_id, guest_id INTO v
    FROM public.spa_appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Termin ne postoji'; END IF;

  INSERT INTO public.spa_reviews (restaurant_id, appointment_id, therapist_id, service_id, guest_id, rating, comment)
  VALUES (v.restaurant_id, p_appointment_id, v.therapist_id, v.service_id, v.guest_id, p_rating, p_comment)
  ON CONFLICT (appointment_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now();
END; $$;

GRANT EXECUTE ON FUNCTION public.submit_spa_review(UUID, INT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_spa_review(UUID, INT, TEXT) IS
  'Gost ocjenjuje svoj spa termin (1-5). SECURITY DEFINER — bez direktnog write pristupa spa_reviews. Trigger osvježi rating terapeuta.';
