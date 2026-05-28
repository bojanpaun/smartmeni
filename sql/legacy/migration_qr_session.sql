-- migration_qr_session.sql
-- Pokrenuti u Supabase SQL Editoru

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS qr_session_minutes INTEGER DEFAULT 30;
