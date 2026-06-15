-- ============================================================================
-- Praćenje naplate računa (plaćeno/nije plaćeno) — Faza 1 (šema + RPC)
-- ----------------------------------------------------------------------------
-- Račun (invoices) dobija status naplate ODVOJEN od fiskalizacije (fiscal_status)
-- i od online plaćanja (payment_transaction_id). Klasičan tok: konobar donese
-- račun → izda/fiskalizuje/štampa → kad gost plati keš/karticu, konobar označi.
-- Pregled po stolu (samo order-računi); folio/spa imaju svoje tokove.
-- Spec/dogovor: chat 2026-06-15. invoices se piše SAMO kroz funkcije (write-lock).
-- ============================================================================

-- ── 1) Polja naplate ────────────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid')),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_method text
    CHECK (paid_method IS NULL OR paid_method IN ('cash','card','other')),
  ADD COLUMN IF NOT EXISTS paid_by_staff_id uuid REFERENCES public.staff(id);

COMMENT ON COLUMN public.invoices.payment_status IS
  'Naplata računa: unpaid|paid. ODVOJENO od fiscal_status (fiskalizacija) i od '
  'payment_transaction_id (online plaćanje). Mijenja se samo kroz mark_invoice_paid.';

-- Online-plaćeni (NONCASH veza postoji) su po definiciji plaćeni.
UPDATE public.invoices
   SET payment_status = 'paid', paid_at = COALESCE(paid_at, issued_at)
 WHERE payment_transaction_id IS NOT NULL AND payment_status = 'unpaid';

-- ── 2) Staff SELECT politike (membership) — uz postojeće owner/superadmin ─────
-- Konobar (ne vlasnik) loguje vlastitim nalogom; bez ovoga ne može čitati račune
-- (Naplata pregled + postojeći štampaj-račun). OR-uje se s owner politikom.
CREATE POLICY "Osoblje cita racune" ON public.invoices FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT restaurant_id FROM public.staff
                           WHERE user_id = auth.uid() AND is_active));

CREATE POLICY "Osoblje cita stavke racuna" ON public.invoice_items FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT restaurant_id FROM public.staff
                           WHERE user_id = auth.uid() AND is_active));

-- ── 3) Realtime: naplata vidljiva među uređajima ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'invoices'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices';
  END IF;
END $$;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;

-- ── 4) RPC: označi/skini naplatu (kontrolisana mutacija — invoices je write-lock) ─
-- SECURITY DEFINER po uzoru na create_invoice_* (integritet); mijenja SAMO polja
-- naplate. Validira članstvo (aktivan staff) ILI vlasništvo tenanta.
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  p_invoice_id uuid,
  p_method     text DEFAULT 'cash',
  p_paid       boolean DEFAULT true
) RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv   public.invoices;
  v_staff uuid;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;

  SELECT id INTO v_staff FROM public.staff
   WHERE restaurant_id = v_inv.restaurant_id AND user_id = auth.uid() AND is_active LIMIT 1;
  IF v_staff IS NULL AND NOT EXISTS (
       SELECT 1 FROM public.restaurants WHERE id = v_inv.restaurant_id AND user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_paid AND p_method IS NOT NULL AND p_method NOT IN ('cash','card','other') THEN
    RAISE EXCEPTION 'bad_method';
  END IF;

  UPDATE public.invoices SET
    payment_status   = CASE WHEN p_paid THEN 'paid' ELSE 'unpaid' END,
    paid_at          = CASE WHEN p_paid THEN now() ELSE NULL END,
    paid_method      = CASE WHEN p_paid THEN p_method ELSE NULL END,
    paid_by_staff_id = CASE WHEN p_paid THEN v_staff ELSE NULL END
  WHERE id = p_invoice_id RETURNING * INTO v_inv;

  RETURN v_inv;
END $$;

GRANT EXECUTE ON FUNCTION public.mark_invoice_paid(uuid, text, boolean) TO authenticated;
COMMENT ON FUNCTION public.mark_invoice_paid(uuid, text, boolean) IS
  'Označi račun plaćenim/neplaćenim (keš/kartica). Validira aktivnog staffa ili vlasnika; '
  'mijenja samo polja naplate. SECURITY DEFINER (invoices je write-lock).';

-- ── 5) RPC: order-računi po stolu (za Naplata pregled) ──────────────────────
-- AKTIVNI order-računi (bez storniranih originala i korektivnih). Operativni
-- prozor: svi NEPLAĆENI (bilo koje starosti) + plaćeni iz zadnja 24h (da se upravo
-- označen vidi kao ✓). Frontend grupiše po stolu. SECURITY INVOKER (staff SELECT iznad).
CREATE OR REPLACE FUNCTION public.get_order_invoices(p_restaurant_id uuid)
RETURNS TABLE (
  id uuid, invoice_number text, table_number text, total_cents int, currency text,
  payment_status text, paid_method text, paid_at timestamptz,
  issued_at timestamptz, fiscal_status text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT i.id, i.invoice_number, o.table_number, i.total_cents, i.currency,
         i.payment_status, i.paid_method, i.paid_at, i.issued_at, i.fiscal_status
  FROM public.invoices i
  JOIN public.orders o ON o.id = i.source_id
  WHERE i.restaurant_id = p_restaurant_id
    AND i.source_type = 'order'
    AND i.corrective_for IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.invoices c WHERE c.corrective_for = i.id)
    AND (i.payment_status = 'unpaid' OR i.issued_at >= now() - interval '1 day')
  ORDER BY o.table_number, i.issued_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_invoices(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_order_invoices(uuid) IS
  'Aktivni order-računi (bez storno/korektivnih) za Naplata pregled po stolu. '
  'Vraća neplaćene (sve) + plaćene iz zadnja 24h. Frontend grupiše po table_number.';
