-- ============================================================================
-- Beta launch — auto-complimentary za NOVE tenante dok je beta_free_mode ON
-- ----------------------------------------------------------------------------
-- Problem: tokom bete je sve funkcionalno besplatno (is_beta_free / checkAddon),
-- ali nov tenant se i dalje kreira kao plan='starter' (kolonski default), pa u
-- superadmin panelu izgleda kao "Starter" → superadmin je morao RUČNO uključivati
-- is_complimentary svakom novom nalogu. Ovaj BEFORE INSERT trigger to automatizuje:
-- dok je globalni beta mod ON, nov restoran (tenant) se odmah označi kao
-- complimentary (besplatni Pro pristup), sa notom 'auto: beta' radi kasnijeg
-- čišćenja kad beta završi.
--
-- Redoslijed BEFORE INSERT trigera (Postgres ih okida ALFABETSKI po imenu):
--   restaurant_beta_complimentary  (OVAJ — postavlja NEW.is_complimentary)
--   restaurant_ensure_tenant       (20260607000007 — kopira NEW.* u tenants)
-- 'b' < 'e' ⇒ ovaj se izvrši PRVI, pa ensure_tenant kopira već postavljenu
-- vrijednost i tenants/restaurants ostaju usklađeni od starta (mirror je AFTER
-- UPDATE pa ne bi pokrio INSERT putanju).
--
-- Čišćenje poslije bete: tenanti sa complimentary_note='auto: beta' se mogu
-- masovno revidirati (isključiti is_complimentary kad krene naplata).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_fn_restaurant_beta_complimentary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Samo dok je globalni beta mod uključen i ako complimentary već nije postavljen.
  IF NOT COALESCE(NEW.is_complimentary, false)
     AND COALESCE((SELECT beta_free_mode FROM public.platform_settings LIMIT 1), false)
  THEN
    NEW.is_complimentary   := true;
    NEW.complimentary_note := COALESCE(NULLIF(NEW.complimentary_note, ''), 'auto: beta');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restaurant_beta_complimentary
  BEFORE INSERT ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_restaurant_beta_complimentary();

COMMENT ON FUNCTION public.trg_fn_restaurant_beta_complimentary() IS
  'Tokom globalne bete (platform_settings.beta_free_mode) nov tenant se auto-označi is_complimentary (note "auto: beta") da superadmin ne mora ručno. MORA se izvršiti prije restaurant_ensure_tenant (ime "b" < "e" → alfabetski prvi).';
