-- Javni RPC — vraća samo boolean, bez otkrivanja kredencijala ili detalja
-- Koristi BookingPage (anon korisnik) da zna treba li prikazati "Plati online" dugme
CREATE OR REPLACE FUNCTION has_active_payment_provider(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_payment_configs
    WHERE restaurant_id = p_restaurant_id
      AND is_active  = true
      AND is_default = true
  );
$$;
