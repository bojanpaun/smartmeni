-- ▶ Pokrenuti u: Supabase Dashboard → SQL Editor
-- Prilagođene poruke za poziv konobara

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS waiter_messages JSONB DEFAULT '[
    {"sr": "Pozovi konobara", "en": "Call waiter", "icon": "🔔"},
    {"sr": "Donesi račun", "en": "Bring the bill", "icon": "🧾"},
    {"sr": "Donesi vodu", "en": "Bring water", "icon": "🥤"},
    {"sr": "Skloni prazne tanjire", "en": "Clear the table", "icon": "🍽️"}
  ]'::jsonb;

NOTIFY pgrst, 'reload schema';
