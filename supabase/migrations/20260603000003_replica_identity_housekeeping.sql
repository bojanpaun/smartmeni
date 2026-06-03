-- ================================================================
-- REPLICA IDENTITY FULL za housekeeping_tasks i maintenance_requests
--
-- Supabase Realtime postgres_changes sa row-level filterom ne dostavlja
-- UPDATE evente pouzdano kada ih kreira ne-owner korisnik (staff) uz
-- REPLICA IDENTITY DEFAULT. Postavljanjem na FULL, WAL uključuje
-- vrijednosti SVIH kolona u UPDATE eventu, što omogućava serveru da
-- pouzdano filtrira i dostavi event svim pretplatnicima bez obzira
-- na koji korisnik je napravio izmjenu.
-- ================================================================

ALTER TABLE housekeeping_tasks    REPLICA IDENTITY FULL;
ALTER TABLE maintenance_requests  REPLICA IDENTITY FULL;
