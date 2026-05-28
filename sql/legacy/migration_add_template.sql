-- Dodaj template kolonu u restaurants tabelu
-- Pokreni ovo u Supabase SQL Editor

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS template TEXT DEFAULT 'modern_minimal';

-- Postavi postojeće restorane na default template
UPDATE restaurants
SET template = 'modern_minimal'
WHERE template IS NULL;
