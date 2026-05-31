-- Popravka: dodaj kolone koje možda nedostaju u spa_therapists
-- (tabela mogla biti kreirana ručno bez svih kolona)
ALTER TABLE spa_therapists
  ADD COLUMN IF NOT EXISTS languages       TEXT[]        DEFAULT ARRAY['bs'],
  ADD COLUMN IF NOT EXISTS rating          NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS is_available    BOOLEAN       DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ   DEFAULT now();
