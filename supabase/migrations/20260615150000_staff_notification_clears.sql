-- ============================================================================
-- Portal zaposlenih — „očisti obavještenja iz mog prikaza" (per-user dismiss).
-- ----------------------------------------------------------------------------
-- staff_announcements su admin broadcast (zajednički). Zaposleni ne smije obrisati
-- za sve — umjesto toga čisti SVOJ prikaz: pamtimo cleared_at po (user, tenant);
-- prikazuju se samo obavještenja novija/uređena nakon cleared_at. Novi broadcast
-- se ponovo pojavi. Ključ (user_id, restaurant_id) → RLS bez staff-subupita.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_notification_clears (
  user_id       uuid NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  cleared_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, restaurant_id)
);

COMMENT ON TABLE public.staff_notification_clears IS
  'Per-user „očisti sve" za obavještenja portala: cleared_at po (user_id, restaurant_id). Prikaz skriva obavještenja starija od cleared_at. Ne dira deljeni staff_announcements.';

ALTER TABLE public.staff_notification_clears ENABLE ROW LEVEL SECURITY;

-- Svaki korisnik upravlja samo svojim redom (user_id = auth.uid()).
CREATE POLICY "Korisnik upravlja svojim clear-om obavještenja"
  ON public.staff_notification_clears FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER snc_updated_at BEFORE UPDATE ON public.staff_notification_clears
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
