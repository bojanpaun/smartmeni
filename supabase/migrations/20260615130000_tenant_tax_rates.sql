-- ============================================================================
-- FISK #3 — PDV stope po TENANTU (override državnih).
-- ----------------------------------------------------------------------------
-- tax_config ostaje globalna referenca po državi (i fallback). Tenant može imati
-- svoj set stopa (više/manje) u restaurants.tax_rates (isti oblik [{key,value,label}]).
-- NULL = koristi državne stope. Invoice-jezgro i useTaxRates čitaju EFEKTIVNE stope.
-- vat_rate_key na artiklima referencira `key` iz efektivnog seta; nepoznat key → 0%.
-- ============================================================================

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS tax_rates jsonb;
COMMENT ON COLUMN public.restaurants.tax_rates IS
  'FISK: per-tenant override PDV stopa [{key,value,label}] (value=decimalna stopa). NULL = državne stope iz tax_config. Artikli (vat_rate_key) referenciraju key iz efektivnog seta.';

-- Jezgro: jedina izmjena u odnosu na 162000 je izvor `v_rates` — sada EFEKTIVNE
-- stope (restaurants.tax_rates → fallback tax_config.rates). Ostalo nepromijenjeno.
CREATE OR REPLACE FUNCTION public.create_invoice_from_items(
  p_restaurant_id        uuid,
  p_source_type          text,
  p_source_id            uuid,
  p_idempotency_key      text,
  p_items                jsonb,
  p_kind                 text DEFAULT 'CASH_B2C',
  p_buyer_tin            text DEFAULT NULL,
  p_enu_code             text DEFAULT 'DEFAULT',
  p_business_unit_code   text DEFAULT NULL,
  p_operator_code        text DEFAULT NULL,
  p_payment_transaction_id uuid DEFAULT NULL,
  p_country              text DEFAULT 'ME'
) RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv      public.invoices;
  v_existing public.invoices;
  v_rates    jsonb;
  v_fmt      text;
  v_currency text;
  v_year     int := EXTRACT(year FROM now())::int;
  v_ordinal  int;
  v_number   text;
  v_total    int;
  v_base     int;
  v_vat      int;
BEGIN
  -- Ovlašćenje: vlasnik tenanta, aktivni staff tenanta ili superadmin.
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = p_restaurant_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff s WHERE s.restaurant_id = p_restaurant_id AND s.user_id = auth.uid() AND s.is_active)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljeno: korisnik ne pripada tenantu %', p_restaurant_id USING ERRCODE = '42501';
  END IF;

  -- Idempotencija: postojeći račun za isti ključ → vrati ga (bez duplikata).
  SELECT * INTO v_existing FROM invoices
   WHERE restaurant_id = p_restaurant_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;

  -- Format broja iz tax_config (country); EFEKTIVNE stope = tenant override → država.
  SELECT numbering_format INTO v_fmt FROM tax_config WHERE country = p_country;
  SELECT COALESCE(r.tax_rates, (SELECT rates FROM tax_config WHERE country = p_country))
    INTO v_rates FROM restaurants r WHERE r.id = p_restaurant_id;
  IF v_rates IS NULL THEN
    RAISE EXCEPTION 'Nema poreske konfiguracije (tenant/država %)', p_country USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(currency, 'EUR') INTO v_currency FROM restaurants WHERE id = p_restaurant_id;

  -- Grupni totali (poreske grupe PO STOPI; zaokruživanje na nivou grupe).
  WITH lines AS (
    SELECT
      round(GREATEST((it->>'quantity')::numeric, 0) * (it->>'unit_price_cents')::int)::int AS line_gross,
      COALESCE((
        SELECT (r->>'value')::numeric FROM jsonb_array_elements(v_rates) AS r
         WHERE r->>'key' = NULLIF(it->>'vat_rate_key', '')
      ), 0) AS rate
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS it
  ),
  grp AS (SELECT rate, SUM(line_gross)::int AS g_gross FROM lines GROUP BY rate),
  grpc AS (SELECT g_gross, round(g_gross / (1 + rate))::int AS g_base FROM grp)
  SELECT COALESCE(SUM(g_gross), 0)::int,
         COALESCE(SUM(g_base), 0)::int,
         COALESCE(SUM(g_gross - g_base), 0)::int
    INTO v_total, v_base, v_vat
  FROM grpc;

  -- Atomarni redni broj po (tenant, ENU, godina). UPSERT serijalizuje paralelne pozive.
  INSERT INTO invoice_counters (restaurant_id, enu_code, year, last_number)
  VALUES (p_restaurant_id, p_enu_code, v_year, 1)
  ON CONFLICT (restaurant_id, enu_code, year)
  DO UPDATE SET last_number = invoice_counters.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_ordinal;

  v_number := COALESCE(
    replace(replace(replace(v_fmt, '{ordinal}', v_ordinal::text), '{enu}', p_enu_code), '{year}', v_year::text),
    v_ordinal::text || '/' || p_enu_code || '/' || v_year::text
  );

  INSERT INTO invoices (
    restaurant_id, source_type, source_id, idempotency_key,
    enu_code, business_unit_code, operator_code, invoice_ordinal, invoice_number,
    issued_at, kind, buyer_tin, currency,
    total_cents, total_base_cents, total_vat_cents,
    fiscal_status, payment_transaction_id
  ) VALUES (
    p_restaurant_id, p_source_type, p_source_id, p_idempotency_key,
    p_enu_code, p_business_unit_code, p_operator_code, v_ordinal, v_number,
    now(), p_kind, p_buyer_tin, v_currency,
    v_total, v_base, v_vat,
    'PENDING', p_payment_transaction_id
  ) RETURNING * INTO v_inv;

  INSERT INTO invoice_items (
    invoice_id, restaurant_id, name, quantity, unit_price_cents, vat_rate_key,
    base_cents, vat_cents, total_cents, sort_order
  )
  SELECT v_inv.id, p_restaurant_id,
    (q.it->>'name')::text,
    GREATEST((q.it->>'quantity')::numeric, 0),
    (q.it->>'unit_price_cents')::int,
    NULLIF(q.it->>'vat_rate_key', ''),
    round(q.lg / (1 + q.rt))::int,
    (q.lg - round(q.lg / (1 + q.rt))::int)::int,
    q.lg,
    q.ord::int
  FROM (
    SELECT it, ordinality AS ord,
      round(GREATEST((it->>'quantity')::numeric, 0) * (it->>'unit_price_cents')::int)::int AS lg,
      COALESCE((
        SELECT (r->>'value')::numeric FROM jsonb_array_elements(v_rates) AS r
         WHERE r->>'key' = NULLIF(it->>'vat_rate_key', '')
      ), 0) AS rt
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS t(it, ordinality)
  ) q;

  RETURN v_inv;
END;
$$;
