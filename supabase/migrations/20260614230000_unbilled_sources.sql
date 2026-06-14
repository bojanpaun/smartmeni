-- ============================================================================
-- FISK — trajni pristup izdavanju računa + auto-izdavanje (flag).
-- ----------------------------------------------------------------------------
-- Problem: dugme „Izdaj račun" je bilo samo na serviranoj narudžbi (prolazno).
-- Rješenje: (1) auto_fiscalize flag → frontend sam izda račun na zatvaranje;
-- (2) get_unbilled_sources → lista nedavnih izvora (narudžba/folio/spa) BEZ računa
-- za ručno izdavanje sa fiskalizacione stranice (uvijek dostupno).
-- ============================================================================

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS auto_fiscalize boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.restaurants.auto_fiscalize IS
  'FISK: ako je TRUE, frontend automatski izda račun na zatvaranje narudžbe/folija/spa (uz fiscalization addon). Ručno izdavanje uvijek dostupno (get_unbilled_sources).';

-- Nedavni naplativi izvori bez izdatog računa (za „Za izdavanje" listu).
CREATE OR REPLACE FUNCTION public.get_unbilled_sources(
  p_restaurant_id uuid,
  p_limit int DEFAULT 50
) RETURNS TABLE (
  source_type  text,
  source_id    uuid,
  ref_label    text,
  occurred_at  timestamptz,
  total_amount numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = p_restaurant_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM staff s WHERE s.restaurant_id = p_restaurant_id AND s.user_id = auth.uid() AND s.is_active)
    OR public.is_superadmin()
  ) THEN
    RAISE EXCEPTION 'Nije dozvoljeno' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT q.source_type, q.source_id, q.ref_label, q.occurred_at, q.total_amount
  FROM (
    -- Narudžbe: servirane/zatvorene, NE odbijene, bez računa
    SELECT 'order'::text AS source_type, o.id AS source_id,
           ('Sto ' || COALESCE(o.table_number, '-'))::text AS ref_label,
           o.created_at AS occurred_at,
           COALESCE(o.total, 0)::numeric AS total_amount
    FROM orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.status IN ('served', 'closed')
      AND o.rejection_message IS NULL
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.source_type = 'order' AND i.source_id = o.id)

    UNION ALL
    -- Spa termini: ne otkazani/no-show, bez računa
    SELECT 'spa'::text, a.id,
           COALESCE(s.name, 'Spa')::text,
           (a.appointment_date + a.start_time)::timestamptz,
           COALESCE(a.price, 0)::numeric
    FROM spa_appointments a
    LEFT JOIN spa_services s ON s.id = a.service_id
    WHERE a.restaurant_id = p_restaurant_id
      AND a.status NOT IN ('cancelled', 'no_show')
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.source_type = 'spa' AND i.source_id = a.id)

    UNION ALL
    -- Folio: sa prometom (total_amount > 0), bez računa
    SELECT 'folio'::text, f.id,
           ('Folio ' || COALESCE(NULLIF(trim(coalesce(g.first_name,'') || ' ' || coalesce(g.last_name,'')), ''), '—'))::text,
           f.created_at,
           COALESCE(f.total_amount, 0)::numeric
    FROM folios f
    LEFT JOIN guests g ON g.id = f.guest_id
    WHERE f.restaurant_id = p_restaurant_id
      AND COALESCE(f.total_amount, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.source_type = 'folio' AND i.source_id = f.id)
  ) q
  ORDER BY q.occurred_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_unbilled_sources FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_unbilled_sources TO authenticated;
