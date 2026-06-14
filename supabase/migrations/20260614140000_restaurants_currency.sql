-- FISK-0 (Faza FISK): valuta po tenantu — platformski temelj (van addona).
-- Jedna aktivna valuta po tenantu (operativna/pravna): vozi prikaz + payments +
-- fiskalni račun. NAMJERNO bez FX-konverzije i bez više valuta istovremeno.
--
-- Profil/operativno polje (kao restaurants.active_verticals / admin_theme), NE
-- billing polje → živi SAMO na restaurants (javno čitljivo), bez mirrora na tenants.
--
-- Promjena valute NE konvertuje postojeće cijene (broj ostaje, mijenja se simbol) i
-- utiče samo na NOVE zapise; svaki money-zapis pečatira svoju valutu u trenutku
-- nastanka (invoices.currency, payment_transactions.currency) → istorija nepromjenjiva.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

COMMENT ON COLUMN public.restaurants.currency IS
  'FISK-0: operativna valuta tenanta (ISO 4217, npr. EUR/RSD/TRY). Javno čitljivo. '
  'Vozi formatMoney prikaz + payments minor-unit + fiskalni račun. Bez runtime FX-konverzije; '
  'promjena ne konvertuje postojeće cijene (stamp po zapisu).';
