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
  konobar: {
    name: 'Konobar',
    permissions: ['view_menu', 'view_orders', 'view_waiter_req', 'manage_waiter_req', 'view_tables', 'view_reservations']
  },
  kuhinja: {
    name: 'Kuhinja',
    permissions: ['view_menu', 'view_orders', 'manage_orders', 'view_inventory']
  },
  menadzer: {
    name: 'Menadžer',
    permissions: ['view_menu', 'edit_menu', 'manage_categories', 'view_orders', 'view_analytics', 'view_reports', 'view_staff', 'view_tables', 'view_reservations']
  },
  sank: {
    name: 'Šank',
    permissions: ['view_menu', 'view_orders', 'manage_orders', 'view_waiter_req', 'manage_waiter_req']
  },
}
