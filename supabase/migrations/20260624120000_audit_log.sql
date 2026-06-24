-- ════════════════════════════════════════════════════════════════════════
-- AUDIT LOG — trag akcija (dva nivoa pregleda)
--   • SUPERADMIN: vidi sve redove (uz filtere u UI po tenantu/korisniku/akciji)
--   • TENANT (vlasnik): vidi samo aktivnosti unutar svog naloga
--
-- Pisanje:
--   • frontend → public.log_audit_event(...) (SECURITY DEFINER; actor se stempluje
--     iz auth.uid() pa ga klijent NE MOŽE lažirati)
--   • edge funkcije (service_role) → direktan INSERT (zaobilaze RLS)
--
-- NIKAD ne upisivati lozinke/tajne u metadata.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- restaurant_id = tenant na koji se akcija odnosi. NOT NULL — strukturni guard
  -- (test 011) zahtijeva da svaka restaurant_id kolona bude NOT NULL + FK. Svaka
  -- akcija koju bilježimo vezana je za konkretan tenant. (Globalne platform-akcije
  -- bez tenanta nisu u opsegu; ako zatrebaju, to je zasebna odluka.)
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  actor_id      uuid,                 -- auth.users.id izvršioca (NULL = sistem/cron)
  actor_email   text,                 -- snapshot e-maila (preživi brisanje korisnika)
  actor_role    text,                 -- 'superadmin' | 'owner' | 'staff' | 'system'
  action        text NOT NULL,        -- mašinski kod, npr. 'tenant.password_changed'
  entity_type   text,                 -- 'tenant' | 'reservation' | 'invoice' | ...
  entity_id     text,                 -- id pogođenog entiteta (text — može biti i ne-uuid)
  summary       text,                 -- kratak ljudski opis (opciono)
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- dodatni kontekst (bez tajni!)
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS
  'Trag akcija. Superadmin vidi sve; tenant (vlasnik) vidi samo svoje (RLS). '
  'Pisanje preko log_audit_event() ili service_role iz edge funkcija. Bez tajni u metadata.';

-- Indeksi za tipične upite: tenant timeline, po izvršiocu, po tipu akcije, globalni timeline.
CREATE INDEX IF NOT EXISTS idx_audit_log_restaurant_created
  ON public.audit_log (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor    ON public.audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action   ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON public.audit_log (created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Superadmin: pun pristup (čita sve, uključujući NULL restaurant_id platform-akcije).
-- Koristi is_superadmin() helper (SECURITY DEFINER) — bez inline EXISTS (izbjegava
-- rekurziju sa user_profiles politikom; v. CLAUDE.md §1).
CREATE POLICY "audit_log_superadmin_all" ON public.audit_log
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- Tenant (vlasnik): SAMO čitanje redova svog naloga. Upis ide isključivo kroz
-- log_audit_event() (SECURITY DEFINER) ili service_role — nema INSERT politike za
-- authenticated, pa klijent ne može ručno ubaciti/lažirati zapis.
CREATE POLICY "audit_log_owner_read" ON public.audit_log
  FOR SELECT USING (
    restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid())
  );

-- ── RPC: log_audit_event ─────────────────────────────────────────────────
-- Frontend zove ovo. Actor (id/email/uloga) se izvodi iz auth.uid() na serveru —
-- klijent ne može tvrditi da je neko drugi. Vraća id zapisa.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action        text,
  p_restaurant_id uuid  DEFAULT NULL,
  p_entity_type   text  DEFAULT NULL,
  p_entity_id     text  DEFAULT NULL,
  p_summary       text  DEFAULT NULL,
  p_metadata      jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_email    text;
  v_role     text;
  v_is_super boolean;
  v_id       uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Nije autentifikovano';
  END IF;
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id je obavezan';
  END IF;

  SELECT is_superadmin INTO v_is_super FROM public.user_profiles WHERE id = v_actor;
  SELECT email         INTO v_email    FROM auth.users          WHERE id = v_actor;

  -- Odredi ulogu i provjeri pravo na tenant.
  IF COALESCE(v_is_super, false) THEN
    v_role := 'superadmin';
  ELSIF p_restaurant_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.restaurants
                    WHERE id = p_restaurant_id AND user_id = v_actor) THEN
    v_role := 'owner';
  ELSIF p_restaurant_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.staff
                    WHERE restaurant_id = p_restaurant_id AND user_id = v_actor) THEN
    v_role := 'staff';
  ELSE
    RAISE EXCEPTION 'Nemate pravo na ovaj tenant';
  END IF;

  INSERT INTO public.audit_log (
    restaurant_id, actor_id, actor_email, actor_role,
    action, entity_type, entity_id, summary, metadata
  ) VALUES (
    p_restaurant_id, v_actor, v_email, v_role,
    p_action, p_entity_type, p_entity_id, p_summary, COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.log_audit_event(text, uuid, text, text, text, jsonb) IS
  'Upis u audit_log sa actorom izvedenim iz auth.uid() (anti-spoof). '
  'Dozvoljeno superadminu, vlasniku tenanta ili članu osoblja tenanta.';

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, uuid, text, text, text, jsonb)
  TO authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Audit log je append-only (samo INSERT) pa REPLICA IDENTITY FULL nije nužan za
-- UPDATE diffove, ali ga postavljamo radi konzistentnog row-level filtriranja.
ALTER TABLE public.audit_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_log;
