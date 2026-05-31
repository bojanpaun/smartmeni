-- Označava kategorije menija kao "Bar" (piće)
-- Koristi se za razdvajanje narudžbi između kuhinje i bara u Kitchen Dashboardu

ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_bar boolean NOT NULL DEFAULT false;
