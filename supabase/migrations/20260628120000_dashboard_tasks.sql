-- ============================================================================
-- dashboard_tasks — konfigurabilna „task traka" na admin početnoj (ControlPanel)
-- ----------------------------------------------------------------------------
-- Cilj: učiniti dashboard intuitivnijim — umjesto da korisnik traži FUNKCIJU u
-- modulu, kuca CILJ („dodaj jelo", „promijeni cijenu") i dobija prečicu. Lista je
-- GLOBALNA (ista za sve tenante) i KURIRA je superadmin na /superadmin/dashboard —
-- svaki čest poziv podršci = jedan zadatak koji ga ukida.
--
-- Globalno (bez restaurant_id) kao addon_catalog/plans — superadmin-kurirano,
-- dijeljeno svim tenantima. Gating se radi PO STAVCI (vertical/perm/addon, sve
-- nullable) na frontendu, isto kao postojeće dashboard kartice (canSee/hasVertical).
--
-- Labela (`label`) je IZVOR na crnogorskom ('me'). Prevodi se preslikavanjem
-- library_translations mehanizma (entity_type='dashboard_task', field='label'):
-- edge translate-content (library:true) ih popuni na 6 jezika, TaskBar čita kroz
-- useLibraryTranslations (fallback na izvor dok prevod ne stigne).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dashboard_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order  int        NOT NULL DEFAULT 0,
  icon        text       NOT NULL DEFAULT '⚡',
  label       text       NOT NULL,            -- izvor 'me' (crnogorski)
  path        text       NOT NULL,            -- npr. '/admin/menu'
  vertical    text,                           -- gating (nullable): 'restaurant'|'hotel'|'rental'
  perm        text,                           -- gating (nullable): permisija (vidi lib/permissions.js)
  addon       text,                           -- gating (nullable): addon id (vidi addon_catalog)
  is_active   boolean    NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE public.dashboard_tasks IS
  'Konfigurabilna task traka na admin početnoj. Globalno (superadmin kurira na /superadmin/dashboard), gating po stavci (vertical/perm/addon). label=izvor me; prevodi u library_translations (entity_type=dashboard_task).';

CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_active
  ON public.dashboard_tasks (is_active, sort_order);

ALTER TABLE public.dashboard_tasks ENABLE ROW LEVEL SECURITY;

-- Čitanje: svaki prijavljeni admin/staff (task traka je admin-only površina, ista
-- lista za sve tenante).
CREATE POLICY "Dashboard zadaci čitljivi prijavljenima"
  ON public.dashboard_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Pisanje: samo superadmin (kurira listu). public.is_superadmin() helper — konvencija
-- (NIKAD inline EXISTS na user_profiles → ciklus s RLS-om, vidi CLAUDE.md §1).
CREATE POLICY "Superadmin upravlja dashboard zadacima"
  ON public.dashboard_tasks FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE TRIGGER dashboard_tasks_updated_at
  BEFORE UPDATE ON public.dashboard_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Početni set (superadmin kasnije uređuje/dopunjava) ──────────────────────
-- Pokriva najčešće „šta želim da uradim" zadatke. Putanje/perm/vertical usklađeni
-- s App.jsx rutama i lib/permissions.js. Fiskalizacija je iza addon-a → gating addon.
INSERT INTO public.dashboard_tasks (sort_order, icon, label, path, vertical, perm, addon) VALUES
  (10, '➕', 'Dodaj jelo',          '/admin/menu',                     'restaurant', 'edit_menu',     NULL),
  (20, '💶', 'Promijeni cijenu',    '/admin/menu',                     'restaurant', 'edit_menu',     NULL),
  (30, '📊', 'Pazar danas',         '/admin/menu/analytics',           'restaurant', 'view_analytics',NULL),
  (40, '📱', 'Štampaj QR kod',      '/admin/menu/qr',                  'restaurant', 'view_menu',     NULL),
  (50, '👤', 'Dodaj radnika',       '/admin/hr/staff',                 NULL,         'manage_staff',  NULL),
  (60, '📅', 'Rezerviši sto',       '/admin/reservations',             'restaurant', 'view_reservations', NULL),
  (70, '🧾', 'Otvorene porudžbine', '/admin/orders',                   'restaurant', 'view_orders',   NULL),
  (80, '🧾', 'Fiskalizacija',       '/admin/settings/fiscalization',   NULL,         NULL,            'fiscalization');
