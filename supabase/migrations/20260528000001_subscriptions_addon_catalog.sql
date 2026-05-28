-- Faza 1: Billing infrastruktura — subscriptions + addon_catalog
-- Datum: 2026-05-28

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_customer_id      TEXT,
  paypal_subscription_id  TEXT UNIQUE,
  plan                    TEXT NOT NULL DEFAULT 'starter',
  addons                  JSONB DEFAULT '[]',
  status                  TEXT DEFAULT 'active',  -- active | past_due | cancelled | trialing
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_restaurant_idx ON subscriptions(restaurant_id);

-- ─── ADDON CATALOG ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addon_catalog (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  description             TEXT,
  price_yearly            NUMERIC(10,2),
  price_monthly           NUMERIC(10,2),
  stripe_price_id_yearly  TEXT,
  stripe_price_id_monthly TEXT,
  is_active               BOOLEAN DEFAULT true,
  depends_on              TEXT[],
  category                TEXT DEFAULT 'restaurant',  -- restaurant | hotel | enterprise
  sort_order              INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_catalog ENABLE ROW LEVEL SECURITY;

-- Vlasnik čita vlastitu pretplatu
CREATE POLICY "Owner reads own subscription"
  ON subscriptions FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

-- Superadmin čita sve pretplate
CREATE POLICY "Superadmin reads all subscriptions"
  ON subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true
    )
  );

-- Svi autentifikovani korisnici čitaju aktivan katalog
CREATE POLICY "Authenticated reads addon catalog"
  ON addon_catalog FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Superadmin upravlja katalogom
CREATE POLICY "Superadmin manages addon catalog"
  ON addon_catalog FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_superadmin = true
    )
  );

-- ─── SEED: ADDON CATALOG ──────────────────────────────────────────────────────
INSERT INTO addon_catalog (id, name, description, price_yearly, price_monthly, category, sort_order, depends_on) VALUES
  -- Restoran addoni
  ('inventory_pro',  'Inventar Pro',        'Recepti, FIFO rotacija, automatska upozorenja za niske zalihe, napredni izvještaji potrošnje.',    149, 14,  'restaurant', 10, NULL),
  ('hr_pro',         'HR Pro',              'Payroll export, evidencija godišnjih odmora, napredni rasporedi i HR analitika.',                   149, 14,  'restaurant', 20, NULL),
  ('analytics_pro',  'Analitika Pro',       'Export u PDF/Excel, prilagođeni datumski rasponi, napredne vizualizacije i prognoza prihoda.',      99,  9,   'restaurant', 30, NULL),
  -- Hotel addoni
  ('hotel_core',     'Hotel Core',          'Upravljanje sobama i tipovima, rezervacije, front desk, check-in/out, folio sistem.',              299, 29,  'hotel',      40, NULL),
  ('booking_engine', 'Booking Engine',      'Javna stranica za direktne rezervacije sa Stripe plaćanjem — bez provizije OTA-a.',                199, 19,  'hotel',      50, ARRAY['hotel_core']),
  ('housekeeping',   'Housekeeping',        'Dashboard za sobarice, automatski taskovi pri check-outu, maintenance zahtjevi.',                  99,  9,   'hotel',      60, ARRAY['hotel_core']),
  ('revenue_mgmt',   'Revenue Management',  'ADR, RevPAR, occupancy analitika, dinamičke cijene i prijedlozi za yield optimizaciju.',           299, 29,  'hotel',      70, ARRAY['hotel_core', 'booking_engine']),
  ('channel_manager','Channel Manager',     'Sinhronizacija dostupnosti i cijena sa Booking.com, Airbnb, Expedia i 100+ OTA kanala.',           799, 79,  'hotel',      80, ARRAY['hotel_core', 'booking_engine']),
  ('spa_wellness',   'Spa & Wellness',      'Booking spa tretmana i kapaciteta, rasporedi terapeuta, online uplata.',                           149, 14,  'hotel',      90, ARRAY['hotel_core']),
  ('loyalty',        'Loyalty Program',     'Sistem bodova, tier nagrade, povijest transakcija, integracija sa folijom i narudžbama.',          149, 14,  'hotel',     100, NULL),
  ('guest_app',      'Guest App',           'White-label PWA za goste: meni, room service, folio pregled, loyalty bodovi, chat s osobljem.',    199, 19,  'hotel',     110, ARRAY['hotel_core']),
  -- Enterprise addoni
  ('multi_property', 'Multi Property',      'Upravljanje više nekretnina jednim nalogom — consolidovani prikaz i shared guest baza.',           499, 49,  'enterprise', 120, NULL),
  ('portfolio_owner','Portfolio Owner',     'Portfolio dashboard, komparativna analitika, konsolidovani finansijski izvještaji.',                799, 79,  'enterprise', 130, ARRAY['multi_property']),
  ('brand_mgmt',     'Brand Management',    'Centralizovani šabloni menija i HR politika koji se primjenjuju na sve objekte jednog branda.',    399, 39,  'enterprise', 140, ARRAY['multi_property']),
  ('regional_mgmt',  'Regional Management', 'Hijerarhija pristupa: vlasnik → regionalni menadžer → menadžer objekta, sa RLS na svakom nivou.',  399, 39,  'enterprise', 150, ARRAY['multi_property'])
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  price_yearly= EXCLUDED.price_yearly,
  price_monthly = EXCLUDED.price_monthly,
  category    = EXCLUDED.category,
  sort_order  = EXCLUDED.sort_order,
  depends_on  = EXCLUDED.depends_on;
