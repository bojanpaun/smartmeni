-- Faza 1 ponude: popust na pojedinačni artikal + sponzorisani artikli.
--
-- compare_at_price = referentna ("stara") cijena za precrtani prikaz na javnom meniju.
--   price OSTAJE stvarna naplaćena cijena (narudžbe/fiskal se ne diraju). Procenat
--   popusta se računa iz price vs compare_at_price (vidi menuHelpers.discountPercent).
--   Admin može unijeti ili staru cijenu direktno, ili % popusta (frontend izvede compare).
-- is_sponsored = artikal se boost-uje na vrh svoje kategorije na javnom meniju.
-- sponsor_label = opciona oznaka ("Preporuka kuće" / ime brenda); NULL → generička oznaka.
--
-- Bez nove tabele → RLS politike menu_items već važe (izolacija pokrivena postojećim testom).

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS is_sponsored     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sponsor_label    text;
