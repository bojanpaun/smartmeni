-- ============================================================================
-- FISK-2c — invoices / invoice_items / invoice_counters + atomarna numeracija +
-- assembly (create_invoice_from_items). Jezgro fiskalnog računa (pred-provajder).
-- ----------------------------------------------------------------------------
-- Princip 2: sve u MINOR jedinicama (centi). Princip: numeracija u ISTOJ transakciji
-- kao kreiranje računa → neprekidan niz po (tenant, ENU, godina), bez rupa, otporno
-- na paralelne narudžbe (atomarni UPSERT brojača serijalizuje konkurentne pozive).
-- Iznosi se NE preračunavaju kroz provajdera; ovdje se sklapa i čuva autoritativni
-- račun, fiskalizacija (IKOF/JIKR/QR) ga dopunjava kasnije (FISK-3).
-- ============================================================================

-- ── invoice_counters: atomarni redni broj po (tenant, ENU, godina) ──────────
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enu_code      text NOT NULL,
  year          int  NOT NULL,
  last_number   int  NOT NULL DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  PRIMARY KEY (restaurant_id, enu_code, year)
);
COMMENT ON TABLE public.invoice_counters IS
  'FISK-2c: atomarni brojač računa po (restaurant_id, enu_code, year). UPSERT u istoj transakciji kao kreiranje računa garantuje neprekidan niz bez rupa (paralelne narudžbe se serijalizuju na PK red).';

-- ── invoices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id        uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  source_type          text NOT NULL,                 -- 'order'|'folio'|'spa'|'booking'
  source_id            uuid,
  idempotency_key      text NOT NULL,
  enu_code             text NOT NULL DEFAULT 'DEFAULT',
  business_unit_code   text,
  operator_code        text,
  invoice_ordinal      int  NOT NULL,                  -- redni broj iz invoice_counters
  invoice_number       text NOT NULL,                  -- formatiran (tax_config.numbering_format)
  issued_at            timestamptz NOT NULL DEFAULT now(),
  kind                 text NOT NULL DEFAULT 'CASH_B2C', -- CASH/NONCASH × B2C/B2B
  buyer_tin            text,                           -- samo B2B
  currency             text NOT NULL DEFAULT 'EUR',     -- pečat valute u trenutku izdavanja
  total_cents          int  NOT NULL,
  total_base_cents     int  NOT NULL,
  total_vat_cents      int  NOT NULL,
  protective_code      text,                           -- IKOF (FISK-3)
  fiscal_code          text,                           -- JIKR (FISK-3)
  qr_data              text,                           -- (FISK-3)
  fiscal_status        text NOT NULL DEFAULT 'PENDING', -- PENDING/QUEUED/FISCALIZED/FAILED
  corrective_for       uuid REFERENCES public.invoices(id),
  payment_transaction_id uuid,                         -- NONCASH veza
  raw_provider_response jsonb,
  created_at           timestamptz DEFAULT now(),
  CONSTRAINT invoices_idem_uniq UNIQUE (restaurant_id, idempotency_key)
);
COMMENT ON TABLE public.invoices IS
  'FISK-2c: autoritativni fiskalni račun (centi, valuta pečatirana). Kreira se SAMO kroz create_invoice_from_items (atomarna numeracija). fiscal_status/IKOF/JIKR/QR popunjava FISK-3.';
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices (restaurant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_source ON public.invoices (source_type, source_id);

-- ── invoice_items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  quantity        numeric NOT NULL DEFAULT 1,
  unit_price_cents int NOT NULL,
  vat_rate_key    text,
  base_cents      int NOT NULL,   -- po stavci (informativno; autoritativni totali su grupni)
  vat_cents       int NOT NULL,
  total_cents     int NOT NULL,   -- bruto po stavci = quantity * unit_price_cents
  sort_order      int DEFAULT 0
);
COMMENT ON COLUMN public.invoice_items.base_cents IS
  'Osnovica po stavci (informativno). Autoritativni poreski totali su na NIVOU GRUPE (po stopi) na invoices.';
CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON public.invoice_items (invoice_id);

-- ── RLS: tenant čita svoje + superadmin; pisanje SAMO kroz funkciju ──────────
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant čita svoje brojače" ON public.invoice_counters FOR SELECT
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Tenant čita svoje račune" ON public.invoices FOR SELECT
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());

CREATE POLICY "Tenant čita svoje stavke računa" ON public.invoice_items FOR SELECT
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()) OR public.is_superadmin());
-- (Bez INSERT/UPDATE/DELETE politika za klijenta — račune kreira samo SECURITY DEFINER funkcija.)

-- ── Assembly + atomarna numeracija ──────────────────────────────────────────
-- p_items: jsonb niz [{name, quantity, unit_price_cents, vat_rate_key}] (bruto, centi).
-- Idempotentno po (restaurant_id, idempotency_key) — retry NE pravi duplikat.
-- Poreske grupe PO STOPI (zaokruživanje na nivou grupe; vat.js ekvivalent).
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

  -- Poreska konfiguracija države + valuta tenanta (pečat).
  SELECT rates, numbering_format INTO v_rates, v_fmt FROM tax_config WHERE country = p_country;
  IF v_rates IS NULL THEN
    RAISE EXCEPTION 'Nema tax_config za državu %', p_country USING ERRCODE = '22023';
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

  -- Broj računa: format iz tax_config ({ordinal}/{enu}/{year}) ili default.
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

  -- Stavke (po stavci base/vat informativno; ord = redoslijed iz ulaza).
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

COMMENT ON FUNCTION public.create_invoice_from_items IS
  'FISK-2c: sklapa fiskalni račun iz stavki (bruto, centi) + atomarni redni broj + insert, sve u jednoj transakciji. Idempotentno po (restaurant_id, idempotency_key). Ovlašćenje: vlasnik/staff/superadmin. Poreske grupe po stopi (tax_config).';

REVOKE ALL ON FUNCTION public.create_invoice_from_items FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_items TO authenticated;
