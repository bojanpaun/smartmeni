-- ============================================================================
-- Performanse: indeksi na user_id kolonama koje loadProfile gađa
-- ----------------------------------------------------------------------------
-- loadProfile (PlatformContext) pri svakom učitavanju radi:
--   restaurants WHERE user_id = ...
--   tenants     WHERE user_id = ...
--   staff       WHERE user_id = ...
-- FK constraint NE pravi indeks → ovi upiti su radili SEQUENTIAL SCAN, pa je
-- restaurants?select=*&user_id=eq... znao trajati 750ms–5.46s i raste s brojem
-- tenanta i konkurentnih upita. (staff ima composite UNIQUE (restaurant_id,
-- user_id), ali to ne pokriva upit po samom user_id.)
--
-- Dodavanje indeksa je aditivno i bezopasno. Bez CONCURRENTLY jer migracije idu
-- u transakciji; tabele su male pa je kratak lock zanemarljiv.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON public.restaurants (user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id     ON public.tenants (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id       ON public.staff (user_id);
