-- Dodaj logo_url kolonu u restaurants tabelu
-- Pokreni u Supabase SQL Editor

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;
