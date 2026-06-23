-- Tip prikaza reklame (display_type) — bira se u administraciji
--
-- ZAŠTO: jedna fiksna veličina bannera (slika preko cijele širine, visoka) zna biti
-- prevelika. Tenant sad bira veličinu po reklami:
--   • 'compact' — slika sa strane (nizak red, najmanje mjesta)
--   • 'banner'  — slika preko širine, umjerene visine (default)
--   • 'large'   — slika preko širine, velika (maksimalan vizual)
-- Render u GuestMenu primjenjuje odgovarajući layout po ovom polju.

ALTER TABLE public.partner_ads
  ADD COLUMN IF NOT EXISTS display_type text NOT NULL DEFAULT 'banner';

ALTER TABLE public.partner_ads
  DROP CONSTRAINT IF EXISTS partner_ads_display_type_check;
ALTER TABLE public.partner_ads
  ADD CONSTRAINT partner_ads_display_type_check
  CHECK (display_type IN ('compact','banner','large'));

COMMENT ON COLUMN public.partner_ads.display_type IS
  'Veličina/izgled bannera na javnom meniju: compact (slika sa strane) | banner (puna širina, srednje) | large (puna širina, veliko).';
