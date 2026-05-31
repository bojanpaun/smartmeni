// Centralni registar svih permisija u sistemu
// Kad dodamo novi modul, ovdje dodamo nove permisije
// Vlasnik ih vidi u UI-u i dodjeljuje rolama

export const PERMISSIONS = {
  // ─── MODUL: DIGITALNI MENI ───────────────────────────
  menu: {
    label: 'Digitalni meni',
    icon: '🍽️',
    permissions: {
      view_menu:          { label: 'Pregledaj meni',         desc: 'Može vidjeti stavke menija' },
      edit_menu:          { label: 'Uredi meni',             desc: 'Može dodavati i mijenjati stavke' },
      manage_categories:  { label: 'Upravljaj kategorijama', desc: 'Može kreirati i brisati kategorije' },
      view_orders:        { label: 'Vidi narudžbe',          desc: 'Može vidjeti narudžbe gostiju' },
      manage_orders:      { label: 'Upravljaj narudžbama',   desc: 'Može mijenjati status narudžbi' },
      view_waiter_req:    { label: 'Vidi zahtjeve konobara', desc: 'Prima notifikacije sa stolova' },
      manage_waiter_req:  { label: 'Upravljaj zahtjevima',   desc: 'Može zatvarati zahtjeve' },
    }
  },

  // ─── MODUL: STOLOVI ──────────────────────────────────
  tables: {
    label: 'Upravljanje stolovima',
    icon: '🪑',
    permissions: {
      view_tables:        { label: 'Vidi stolove',           desc: 'Može vidjeti mapu stolova' },
      manage_tables:      { label: 'Upravljaj stolovima',    desc: 'Može mijenjati raspored stolova' },
      view_reservations:  { label: 'Vidi rezervacije',       desc: 'Može pregledati rezervacije' },
      manage_reservations:{ label: 'Upravljaj rezervacijama',desc: 'Može kreirati i mijenjati rezervacije' },
    }
  },

  // ─── MODUL: ZALIHE ───────────────────────────────────
  inventory: {
    label: 'Upravljanje zalihama',
    icon: '📦',
    permissions: {
      view_inventory:     { label: 'Vidi zalihe',            desc: 'Može pregledati stanje zaliha' },
      edit_inventory:     { label: 'Uredi zalihe',           desc: 'Može ažurirati stanje' },
      manage_suppliers:   { label: 'Upravljaj dobavljačima', desc: 'Može dodavati dobavljače' },
      view_inv_reports:   { label: 'Vidi izvještaje zaliha', desc: 'Pristup izvještajima potrošnje' },
    }
  },

  // ─── ANALITIKA ───────────────────────────────────────
  analytics: {
    label: 'Analitika',
    icon: '📊',
    permissions: {
      view_analytics:     { label: 'Vidi analitiku',         desc: 'Može vidjeti statistiku restorana' },
      view_reports:       { label: 'Vidi izvještaje',        desc: 'Pristup detaljnim izvještajima' },
      export_data:        { label: 'Eksportuje podatke',     desc: 'Može eksportovati CSV/Excel' },
    }
  },

  // ─── OSOBLJE ─────────────────────────────────────────
  staff: {
    label: 'Upravljanje osobljem',
    icon: '👥',
    permissions: {
      view_staff:         { label: 'Vidi osoblje',           desc: 'Može vidjeti listu zaposlenih' },
      manage_staff:       { label: 'Upravljaj osobljem',     desc: 'Može dodavati i uklanjati osoblje' },
      manage_roles:       { label: 'Upravljaj rolama',       desc: 'Može kreirati i mijenjati role' },
    }
  },

  // ─── HOTEL CORE ──────────────────────────────────────
  hotel: {
    label: 'Hotel',
    icon: '🏨',
    permissions: {
      view_reservations_hotel:   { label: 'Vidi rezervacije',      desc: 'Može pregledati hotelske rezervacije' },
      manage_reservations_hotel: { label: 'Upravljaj rezervacijama', desc: 'Može kreirati i mijenjati rezervacije' },
      checkin_checkout:          { label: 'Check-in / Check-out',   desc: 'Može vršiti prijave i odjave gostiju' },
      view_rooms:                { label: 'Vidi sobe',              desc: 'Može vidjeti status soba' },
      manage_rooms:              { label: 'Upravljaj sobama',       desc: 'Može mijenjati status i podatke soba' },
      view_folio:                { label: 'Vidi folio',             desc: 'Može pregledati hotelske račune' },
      manage_folio:              { label: 'Upravljaj foliom',       desc: 'Može dodavati stavke na folio' },
      view_housekeeping:         { label: 'Vidi domaćinstvo',       desc: 'Može vidjeti zadatke čišćenja' },
      manage_housekeeping:       { label: 'Upravljaj domaćinstvom', desc: 'Može kreirati i zatvarati zadatke' },
      view_revenue:              { label: 'Vidi prihode',           desc: 'Pristup revenue metrici hotela' },
    }
  },

  // ─── SPA & WELLNESS ──────────────────────────────────
  spa: {
    label: 'Spa & Wellness',
    icon: '💆',
    permissions: {
      view_appointments:  { label: 'Vidi termine',           desc: 'Može pregledati spa termine' },
      manage_appointments:{ label: 'Upravljaj terminima',    desc: 'Može kreirati i mijenjati termine' },
      view_spa_services:  { label: 'Vidi tretmane',          desc: 'Može vidjeti katalog tretmana' },
      manage_spa_services:{ label: 'Upravljaj tretmanima',   desc: 'Može dodavati i mijenjati tretmane' },
      view_therapists:    { label: 'Vidi terapeute',         desc: 'Može vidjeti raspored terapeuta' },
      view_spa_analytics: { label: 'Vidi spa analitiku',     desc: 'Pristup spa revenue i statistici' },
    }
  },
}

// Helper — flat lista svih permisija
export const getAllPermissions = () => {
  const all = []
  Object.entries(PERMISSIONS).forEach(([moduleKey, module]) => {
    Object.entries(module.permissions).forEach(([permKey, perm]) => {
      all.push({ key: permKey, moduleKey, moduleLabel: module.label, ...perm })
    })
  })
  return all
}

// Default role templates — vlasnik može koristiti kao početnu tačku
export const ROLE_TEMPLATES = {
  // ── Restoran ─────────────────────────────────────────
  konobar: {
    name: 'Konobar',
    permissions: ['view_menu', 'view_orders', 'manage_orders', 'view_waiter_req', 'manage_waiter_req', 'view_tables', 'view_reservations']
  },
  kuhinja: {
    name: 'Kuhinja',
    permissions: ['view_menu', 'view_orders', 'manage_orders', 'view_inventory']
  },
  sank: {
    name: 'Šank',
    permissions: ['view_menu', 'view_orders', 'manage_orders', 'view_waiter_req', 'manage_waiter_req']
  },
  menadzer_restoran: {
    name: 'Menadžer restorana',
    permissions: ['view_menu', 'edit_menu', 'manage_categories', 'view_orders', 'manage_orders',
      'view_waiter_req', 'manage_waiter_req', 'view_tables', 'manage_tables',
      'view_reservations', 'manage_reservations', 'view_analytics', 'view_reports',
      'view_staff', 'view_inventory']
  },

  // ── Hotel ─────────────────────────────────────────────
  recepcija: {
    name: 'Recepcija',
    permissions: ['view_reservations_hotel', 'manage_reservations_hotel', 'checkin_checkout',
      'view_rooms', 'view_folio', 'manage_folio']
  },
  sobarica: {
    name: 'Sobarica',
    permissions: ['view_rooms', 'view_housekeeping', 'manage_housekeeping']
  },
  menadzer_hotel: {
    name: 'Menadžer hotela',
    permissions: ['view_reservations_hotel', 'manage_reservations_hotel', 'checkin_checkout',
      'view_rooms', 'manage_rooms', 'view_folio', 'manage_folio',
      'view_housekeeping', 'manage_housekeeping', 'view_revenue',
      'view_staff', 'view_analytics']
  },

  // ── Spa ───────────────────────────────────────────────
  spa_terapeut: {
    name: 'Spa terapeut',
    permissions: ['view_appointments', 'view_spa_services', 'view_therapists']
  },
  spa_menadzer: {
    name: 'Spa menadžer',
    permissions: ['view_appointments', 'manage_appointments', 'view_spa_services',
      'manage_spa_services', 'view_therapists', 'view_spa_analytics']
  },
}
