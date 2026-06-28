-- Per-korisnik mogućnost da ručno sakrije „Početni koraci" karticu na admin dashboardu
-- (i da odbaci čestitku kad su svi koraci gotovi). Vraća se preko linka uz KPI red.
-- Bez ovoga kartica je mogla samo automatski nestati kad su svi koraci ispunjeni —
-- korisnik nije imao kontrolu da je trajno ukloni dok ima preostalih koraka.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS checklist_dismissed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.checklist_dismissed IS
  'Per-korisnik: korisnik je ručno sakrio „Početni koraci" karticu (uklj. odbacivanje čestitke kad su svi koraci gotovi). Vraća se linkom uz KPI red na dashboardu.';
