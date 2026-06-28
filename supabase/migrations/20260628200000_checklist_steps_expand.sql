-- ============================================================================
-- „Početni koraci" — bogatiji skup koraka po modulu.
-- ----------------------------------------------------------------------------
-- - Uklonjen generički „Odštampaj QR kod" (meni) — u praksi se ne koristi; QR ide
--   pod STOLOVE („Odštampaj QR kodove za stolove").
-- - Dodati koraci za svaki modul (Osnovno/Meni/Stolovi/HR/Inventar/Hotel/Spa/Najam).
-- - Vidljivost po modulu radi moduleVisible() na frontendu (vertikala+addon+perm iz
--   MODULES). Za inventar Pro funkcije (dobavljači/recepture) dodat eksplicitan
--   addon='inventory_pro' (base inventory radi bez addona).
-- - Labele su izvor 'me'; superadmin klikne „🌐 Prevedi" da dobiju ostale jezike.
-- ============================================================================

-- Ukloni stari generički QR korak (meni).
DELETE FROM public.dashboard_checklist_steps WHERE path = '/admin/menu/qr';

-- Preuredi sort_order postojećih seed-koraka u čist blok-raspored po modulu.
UPDATE public.dashboard_checklist_steps SET sort_order = 10  WHERE path = '/admin/settings/brand';          -- logo (Osnovno)
UPDATE public.dashboard_checklist_steps SET sort_order = 40  WHERE path = '/admin/settings/fiscalization';  -- fiskalizacija (Osnovno)
UPDATE public.dashboard_checklist_steps SET sort_order = 120 WHERE path = '/admin/menu' AND detect_key = 'menu';  -- prvo jelo (Meni)
UPDATE public.dashboard_checklist_steps SET sort_order = 210 WHERE path = '/admin/tables';                  -- raspored stolova (Stolovi)
UPDATE public.dashboard_checklist_steps SET sort_order = 310 WHERE path = '/admin/hr/staff';                -- radnik (HR)

-- Novi koraci. Kolone: sort_order, icon, label, path, detect_key, module, addon.
-- (vertical/perm se izvode iz module preko moduleVisible — ne postavljaju se ručno.)
INSERT INTO public.dashboard_checklist_steps (sort_order, icon, label, path, detect_key, module, addon) VALUES
  -- Osnovno (module NULL)
  (20,  '🏪', 'Popuni podatke o objektu',      '/admin/settings/general',        NULL,           NULL,        NULL),
  (30,  '🎨', 'Izaberi izgled i temu',          '/admin/settings/theme',          NULL,           NULL,        NULL),
  -- Meni
  (110, '🗂️', 'Dodaj kategoriju u meni',        '/admin/menu',                    'categories',   'menu',      NULL),
  (130, '⚙️', 'Podesi postavke menija',          '/admin/menu/settings',           NULL,           'menu',      NULL),
  (140, '🌐', 'Uredi izgled restoran sajta',     '/admin/menu/landing',            NULL,           'menu',      NULL),
  -- Stolovi
  (220, '📱', 'Odštampaj QR kodove za stolove',  '/admin/menu/qr',                 NULL,           'tables',    NULL),
  (230, '👥', 'Rasporedi konobare po stolovima', '/admin/tables/assignments',      NULL,           'tables',    NULL),
  -- HR
  (320, '🔑', 'Podesi role i permisije',         '/admin/staff/roles',             NULL,           'hr',        NULL),
  (330, '📅', 'Napravi raspored smjena',         '/admin/hr/schedule',             NULL,           'hr',        NULL),
  -- Inventar (base bez addona; Pro funkcije gejtovane inventory_pro)
  (410, '📦', 'Dodaj prvu stavku zaliha',        '/admin/inventory',               'inventory',    'inventory', NULL),
  (420, '🚚', 'Dodaj dobavljača',                '/admin/inventory/suppliers',     'suppliers',    'inventory', 'inventory_pro'),
  (430, '🧪', 'Napravi recepturu',               '/admin/inventory/recipes',       NULL,           'inventory', 'inventory_pro'),
  -- Hotel (module hotel → vertikala hotel + hotel_core)
  (510, '🛏️', 'Dodaj tip sobe',                  '/admin/hotel/room-types',        'room_types',   'hotel',     NULL),
  (520, '🚪', 'Dodaj sobe',                       '/admin/hotel/rooms',             'rooms',        'hotel',     NULL),
  (530, '🏷️', 'Napravi cjenovnik (rate plan)',   '/admin/hotel/rate-plans',        NULL,           'hotel',     NULL),
  (540, '🔗', 'Uključi online rezervacije',      '/admin/hotel/booking-settings',  NULL,           'hotel',     NULL),
  -- Spa (module spa → vertikala hotel + spa_wellness)
  (610, '💆', 'Dodaj spa uslugu',                '/admin/spa/services',            'spa_services', 'spa',       NULL),
  (620, '👤', 'Dodaj terapeuta',                 '/admin/spa/therapists',          NULL,           'spa',       NULL),
  -- Najam (module rental → vertikala rental + rental_core)
  (710, '🏠', 'Dodaj smještaj / jedinicu',       '/admin/rental/assets',           NULL,           'rental',    NULL),
  (720, '🏷️', 'Podesi cijene najma',             '/admin/rental/pricing',          NULL,           'rental',    NULL);
