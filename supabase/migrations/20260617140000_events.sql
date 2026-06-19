-- ============================================================================
-- EVENTS + EVENT_GUESTS — eventi sa listom gostiju i napomenama (Faza 3, eventi)
-- ----------------------------------------------------------------------------
-- Event (svadba, proslava, banket) = jača, paralelna struktura pored `reservations`
-- (ne zamjenjuje ih). Vezuje se na jedan `table_layouts` raspored (po pravilu draft
-- napravljen kroz „Dupliraj raspored", Faza 1). `event_guests` drži seating chart
-- (gost → sto) + napomenu PO POJEDINAČNOM gostu (alergije, VIP, vegetarijansko…).
--
-- ODLUKE (v. docs/spec-stolovi-eventi.md §6, §8.4):
--   • Integracija sa Calendar/Planner ide preko OVERLAY čitanja `events` (preporuka §8.4),
--     NE upisivanjem „marker-rezervacija" u kritičnu `reservations` tabelu.
--   • event_guests.restaurant_id je DENORMALIZOVAN (pravilo: svaka tabela ima restaurant_id
--     za RLS; izbjegava join na events u politici).
--   • table_assignments.event_id se dodaje TEK sada (events postoji) — konobari po stolu
--     na eventu (Faza 2 + Faza 3).
-- ============================================================================

-- ── events ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  date            date NOT NULL,
  layout_id       uuid REFERENCES public.table_layouts(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft',
  expected_guests integer,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  CONSTRAINT events_status_check CHECK (status IN ('draft','confirmed','completed','cancelled'))
);

COMMENT ON TABLE public.events IS
  'Event (svadba/proslava/banket) vezan na table_layouts raspored. Paralelan konceptu reservations (ne zamjenjuje ga). Integracija u Planner ide overlay čitanjem, ne marker-rezervacijama.';

CREATE INDEX IF NOT EXISTS idx_events_restaurant_date ON public.events (restaurant_id, date);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vlasnik upravlja eventima"
  ON public.events FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
              OR public.is_superadmin());

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;

-- ── event_guests ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_guests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      uuid REFERENCES public.tables(id) ON DELETE SET NULL,  -- NULL dok nije rasjeden
  guest_id      uuid REFERENCES public.guests(id) ON DELETE SET NULL,  -- opciona veza na CRM
  first_name    text,
  last_name     text,
  party_size    integer NOT NULL DEFAULT 1,
  rsvp_status   text NOT NULL DEFAULT 'pending',
  notes         text,                                                   -- napomena PO gostu
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT event_guests_rsvp_check CHECK (rsvp_status IN ('pending','confirmed','declined'))
);

COMMENT ON TABLE public.event_guests IS
  'Gosti eventa (seating chart). table_id NULL = nerasjeden. guest_id opciono veže na CRM (guests). notes = napomena po pojedinačnom gostu (alergije/VIP). Brisanje eventa kaskadno briše goste; brisanje stola/CRM gosta samo NULL-uje vezu.';

CREATE INDEX IF NOT EXISTS idx_event_guests_event ON public.event_guests (event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_table ON public.event_guests (table_id);

ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vlasnik upravlja gostima eventa"
  ON public.event_guests FOR ALL
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
         OR public.is_superadmin())
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
              OR public.is_superadmin());

GRANT ALL ON TABLE public.event_guests TO anon;
GRANT ALL ON TABLE public.event_guests TO authenticated;
GRANT ALL ON TABLE public.event_guests TO service_role;

-- ── table_assignments.event_id (Faza 2 + Faza 3: konobari po stolu na eventu) ─
ALTER TABLE public.table_assignments
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_table_assignments_event ON public.table_assignments (event_id);
