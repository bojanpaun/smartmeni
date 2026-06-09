// ▶ Zamijeniti: src/layouts/AdminLayout.jsx

import { useState, useEffect, createContext, useContext } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePlatform } from '../context/PlatformContext'
import { supabase } from '../lib/supabase'
import styles from './AdminLayout.module.css'
import TrialBanner from '../platform/admin/TrialBanner'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../i18n/LanguageSwitcher'
import useKitchenCounts from '../hooks/useKitchenCounts'
import { useAnnouncements } from '../context/AnnouncementsContext'
const SEV_BANNER = {
  important: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '⚠️' },
  update:    { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '✨' },
  info:      { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '📣' },
}

// Banner ispod headera za nepročitane platform najave (jedna po jedna, može da se ugasi)
function AnnouncementBanner() {
  const { bannerUnread, dismissBanner } = useAnnouncements()
  const navigate = useNavigate()
  if (!bannerUnread?.length) return null
  const a = bannerUnread[0]
  const c = SEV_BANNER[a.severity] || SEV_BANNER.info
  return (
    <div style={{ background: c.bg, borderBottom: `1px solid ${c.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 16 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: c.text }}>{a.title}</span>
        {a.body && <span style={{ color: c.text, opacity: 0.85, fontSize: 13, marginLeft: 8 }}>{a.body}</span>}
      </div>
      <button onClick={() => navigate('/admin/notifications')} style={{ background: 'none', border: `1px solid ${c.border}`, color: c.text, borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Detalji</button>
      <button onClick={() => dismissBanner(a.id)} title="Zatvori" style={{ background: 'none', border: 'none', color: c.text, fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>✕</button>
    </div>
  )
}

// Context za proslijeđivanje refresh funkcije dashboard komponentama
export const AdminBadgeContext = createContext({ refreshCounts: () => {} })
export const useAdminBadgeRefresh = () => useContext(AdminBadgeContext)

export const MODULES = [
  {
    key: 'menu',
    label: 'Digitalni meni',
    icon: '🍽️',
    desc: 'Narudžbe, zahtjevi konobara i upravljanje digitalnim menijem',
    path: '/admin/menu',
    active: true,
    perm: 'view_menu',
    interactive: {
      label: 'Digitalni meni',
      links: [
        { label: 'Narudžbe', icon: '🧾', path: '/admin/orders',  perm: 'view_orders' },
        { label: 'Zahtjevi', icon: '🔔', path: '/admin/waiter',  perm: 'view_waiter_req' },
        { label: 'Kuhinja',  icon: '🧑‍🍳', path: '/admin/kitchen', perm: 'view_kitchen_orders' },
        { label: 'Bar',      icon: '🍷', path: '/admin/bar',     perm: 'view_bar_orders' },
      ],
    },
    admin: {
      label: 'Administracija menija',
      links: [
        { label: 'Analitika',         icon: '📊', path: '/admin/menu/analytics' },
        { label: 'Uređivanje menija', icon: '🍽️', path: '/admin/menu',           exact: true },
        { label: 'Postavke menija',   icon: '⚙️', path: '/admin/menu/settings' },
        { label: 'Sajt restorana',    icon: '🌐', path: '/admin/menu/landing' },
        { label: 'QR kod',            icon: '📱', path: '/admin/menu/qr' },
      ],
    },
  },
  {
    key: 'tables',
    label: 'Stolovi',
    icon: '🪑',
    desc: 'Pregled stolova, rezervacije i upravljanje kapacitetom',
    path: '/admin/tables',
    active: true,
    perm: 'view_tables',
    interactive: {
      label: 'Pregled stolova',
      links: [
        { label: 'Pregled stolova', icon: '👁',  path: '/admin/tables/view' },
        { label: 'Rezervacije',     icon: '📅', path: '/admin/reservations' },
      ],
    },
    admin: {
      label: 'Administracija stolova',
      links: [
        { label: 'Analitika',        icon: '📊', path: '/admin/tables/analytics' },
        { label: 'Postavke stolova', icon: '🗺️', path: '/admin/tables', exact: true },
      ],
    },
  },
  {
    key: 'inventory',
    label: 'Zalihe',
    icon: '📦',
    desc: 'Inventar, promjene zaliha i recepture',
    path: '/admin/inventory',
    active: true,
    perm: 'view_inventory',
    interactive: null,
    admin: {
      label: 'Administracija zaliha',
      links: [
        { label: 'Analitika',       icon: '📊', path: '/admin/inventory/analytics' },
        { label: 'Inventar',        icon: '📦', path: '/admin/inventory',             exact: true },
        { label: 'Promjene zaliha', icon: '📋', path: '/admin/inventory/movements' },
        { label: 'Recepture',       icon: '🧪', path: '/admin/inventory/recipes' },
      ],
    },
  },
  {
    key: 'hr',
    label: 'HR',
    icon: '👥',
    desc: 'Rasporedi, dolasci, zarade i izvještaji osoblja',
    path: '/admin/hr',
    active: true,
    perm: 'view_hr',
    interactive: {
      label: 'HR',
      links: [
        { label: 'Dolasci', icon: '🕐', path: '/admin/hr/attendance' },
      ],
    },
    admin: {
      label: 'Administracija HR',
      links: [
        { label: 'Analitika', icon: '📊', path: '/admin/hr/reports' },
        { label: 'Zaposleni',  icon: '👤', path: '/admin/hr/staff' },
        { label: 'Raspored',  icon: '📅', path: '/admin/hr/schedule' },
        { label: 'Zarade',    icon: '💰', path: '/admin/hr/payroll' },
        { label: 'Staff portal', icon: '📱', path: '/admin/hr/staff-portal-info' },
      ],
    },
  },
  {
    key: 'guests',
    label: 'Gosti',
    icon: '🎟️',
    desc: 'Evidencija gostiju, VIP lista, istorija posjeta i potrošnja',
    path: '/admin/guests',
    active: true,
    perm: 'view_analytics',
    interactive: null,
    admin: {
      label: 'Gosti',
      links: [
        { label: 'Lista gostiju', icon: '👤', path: '/admin/guests', exact: true },
      ],
    },
  },
  {
    key: 'analytics',
    label: 'Analitika',
    icon: '📊',
    desc: 'Prihod, najprodavanija jela i najprometniji sati',
    path: '/admin/analytics',
    active: true,
    perm: 'view_analytics',
    interactive: null,
    admin: {
      label: 'Analitika',
      links: [
        { label: 'Pregled', icon: '📊', path: '/admin/analytics', exact: true },
      ],
    },
  },
  {
    key: 'hotel',
    label: 'Hotel',
    icon: '🏨',
    desc: 'Sobe, rezervacije, front desk i folio sistem',
    path: '/admin/hotel',
    active: true,
    addonId: 'hotel_core',
    perm: null,
    interactive: {
      label: 'Hotel operacije',
      links: [
        { label: 'Front Desk',   icon: '🛎️', path: '/admin/hotel/frontdesk' },
        { label: 'Rezervacije', icon: '📅', path: '/admin/hotel/reservations' },
        { label: 'Sobe',        icon: '🛏️', path: '/admin/hotel/rooms' },
        { label: 'Domaćinstvo', icon: '🧹', path: '/admin/hotel/housekeeping' },
        { label: 'Minibar',     icon: '🥤', path: '/admin/hotel/minibar' },
        { label: 'Doručak',     icon: '🍳', path: '/admin/hotel/breakfast' },
        { label: 'Noćni audit', icon: '🌙', path: '/admin/hotel/night-audit' },
      ],
    },
    admin: {
      label: 'Administracija hotela',
      links: [
        { label: 'Dashboard',             icon: '📊', path: '/admin/hotel',                   exact: true },
        { label: 'Upravljanje prihodima', icon: '💹', path: '/admin/hotel/revenue' },
        { label: 'Tipovi soba',           icon: '🪑', path: '/admin/hotel/room-types' },
        { label: 'Cjenovni planovi',      icon: '🏷️', path: '/admin/hotel/rate-plans' },
        { label: 'Online booking',        icon: '🔗', path: '/admin/hotel/booking-settings' },
        { label: 'Plaćanja',              icon: '💳', path: '/admin/hotel/payment' },
        { label: 'Sajt hotela',           icon: '🌐', path: '/admin/hotel/landing' },
      ],
    },
  },
  {
    key: 'spa',
    label: 'Spa & Wellness',
    icon: '💆',
    desc: 'Tretmani, terapeuti, kalendar i booking',
    path: '/admin/spa',
    active: true,
    addonId: 'spa_wellness',
    perm: null,
    interactive: {
      label: 'Spa operacije',
      links: [
        { label: 'Kalendar',    icon: '📅', path: '/admin/spa/calendar' },
        { label: 'Termini',     icon: '🗓️', path: '/admin/spa/appointments' },
      ],
    },
    admin: {
      label: 'Spa administracija',
      links: [
        { label: 'Dashboard',   icon: '📊', path: '/admin/spa',              exact: true },
        { label: 'Tretmani',    icon: '💆', path: '/admin/spa/services' },
        { label: 'Terapeuti',   icon: '👤', path: '/admin/spa/therapists' },
        { label: 'Kabine',      icon: '🚪', path: '/admin/spa/rooms' },
        { label: 'Retail',      icon: '🛍️', path: '/admin/spa/retail' },
        { label: 'Paketi',      icon: '🎁', path: '/admin/spa/packages' },
        { label: 'Analitika',   icon: '📊', path: '/admin/spa/analytics' },
        { label: 'Postavke',    icon: '⚙️', path: '/admin/spa/settings' },
      ],
    },
  },
  {
    key: 'settings',
    label: 'Postavke',
    icon: '⚙️',
    adminOnly: true,
    desc: 'Predlošci, logo i podešavanja restorana',
    path: '/admin/settings',
    active: true,
    perm: null,
    interactive: null,
    admin: {
      label: 'Postavke sistema',
      links: [
        { label: 'Logo',           icon: '🖼️', path: '/admin/settings/logo' },
        { label: 'Osnovni podaci', icon: '📋', path: '/admin/settings/general' },
        { label: 'Pretplata',      icon: '💳', path: '/admin/billing' },
      ],
    },
  },
]

const BOTTOM_NAV = [
  { path: '/admin',          label: 'Početna',  icon: '⊞', exact: true },
  { path: '/admin/orders',   label: 'Narudžbe', icon: '🧾', perm: 'view_orders' },
  { path: '/admin/waiter',   label: 'Zahtjevi', icon: '🔔', perm: 'view_waiter_req' },
  { path: '/admin/kitchen',  label: 'Kuhinja',  icon: '🧑‍🍳', perm: 'view_kitchen_orders' },
  { path: '/admin/tables',   label: 'Stolovi',  icon: '🪑', perm: 'view_tables' },
  { path: '/admin/settings', label: 'Postavke', icon: '⚙️' },
]

export default function AdminLayout({ children }) {
  const { restaurant, logout, isOwner, isSuperAdmin, hasPermission, hasAddon, hasVertical } = usePlatform()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isHub = location.pathname === '/admin'

  const activeModule = MODULES.find(m => {
    if (location.pathname === m.path) return true
    if (location.pathname.startsWith(m.path + '/')) return true
    const allLinks = [...(m.interactive?.links || []), ...(m.admin?.links || [])]
    return allLinks.some(l => l.exact ? location.pathname === l.path : location.pathname.startsWith(l.path + '/'))
  }) || (
    ['/admin/orders', '/admin/waiter', '/admin/kitchen', '/admin/bar'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'menu')
      : ['/admin/settings', '/admin/billing'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'settings')
      : ['/admin/reservations'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'tables')
      : location.pathname.startsWith('/admin/hotel')
      ? MODULES.find(m => m.key === 'hotel')
      : location.pathname.startsWith('/admin/staff')
      ? { key: 'staff', label: 'Role i permisije', path: '/admin/staff', icon: '🔑',
          interactive: null,
          admin: { label: 'Administracija', links: [
            { label: 'Role i permisije', icon: '🔑', path: '/admin/staff/roles', exact: true },
          ]}}
      : null
  )

  const { counts: kitchenCounts, refresh: refreshCounts } = useKitchenCounts(restaurant?.id, hasVertical('hotel'))
  const badges = {
    '/admin/orders':              kitchenCounts.waiter        || 0,
    '/admin/waiter':              kitchenCounts.waiterReq     || 0,
    '/admin/kitchen':             kitchenCounts.kitchen       || 0,
    '/admin/bar':                 kitchenCounts.bar           || 0,
    '/admin/hotel/housekeeping':  (kitchenCounts.housekeeping || 0) + (kitchenCounts.maintOpen || 0),
    '/admin/hotel/reservations':  kitchenCounts.hotelInquiry  || 0,
    '/admin/hotel/frontdesk':     kitchenCounts.hotelFrontDesk || 0,
  }

  const handleLogout = async () => { await logout(); navigate('/') }

  const isActive = (path, exact = false) => exact ? location.pathname === path : location.pathname.startsWith(path)

  const canAccess = (perm) => !perm || isOwner() || isSuperAdmin() || hasPermission(perm)

  const restName = restaurant?.name || 'Admin'
  const restRole = isSuperAdmin() ? 'Super admin' : isOwner() ? 'Vlasnik' : 'Osoblje'

  const renderSegment = (segment, forceExpanded = false, onLinkClick = null) => {
    if (!segment) return null
    const visibleLinks = segment.links.filter(l => canAccess(l.perm))
    if (!visibleLinks.length) return null
    const expanded = forceExpanded || !collapsed
    return (
      <div className={styles.navSegment}>
        {expanded && (
          <div className={styles.navSegmentTitle}>{segment.label}</div>
        )}
        {visibleLinks.map((link, i) => {
          const badge = badges[link.path] || 0
          return (
            <Link
              key={i}
              to={link.path}
              className={`${styles.navItem} ${isActive(link.path, link.exact) ? styles.navItemActive : ''}`}
              title={link.label}
              onClick={onLinkClick}
            >
              <span className={styles.navIcon}>{link.icon}</span>
              {expanded && <span className={styles.navLinkLabel}>{link.label}</span>}
              {badge > 0 && (
                <span className={styles.navBadge}>{badge}</span>
              )}
            </Link>
          )
        })}
      </div>
    )
  }

  if (isHub) {
    return (
      <div className={styles.hubLayout}>
        <header className={styles.hubHeader}>
          <div className={styles.hubRestName}>{restName}</div>
          <div className={styles.hubHeaderRight}>
            {restaurant && hasVertical('restaurant') && (
              <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.hubLiveBtn}>
                👁 Restoran
              </a>
            )}
            {restaurant && hasVertical('hotel') && (
              <a href={`/${restaurant.slug}/hotel`} target="_blank" rel="noreferrer" className={styles.hubLiveBtn}>
                🏨 Hotel sajt
              </a>
            )}
            <div className={styles.hubRestIcon}>
              {restaurant?.logo_url
                ? <img src={restaurant.logo_url} alt={restName} className={styles.hubRestLogo} />
                : restName[0]}
            </div>
            <span className={styles.hubRole}>{restRole}</span>
            <LanguageSwitcher variant="dark" />
            <ThemeToggle variant="dark" />
            <button className={styles.hubLogoutBtn} onClick={handleLogout}>Odjava</button>
          </div>
        </header>
        <AnnouncementBanner />
        <main className={styles.hubMain}>
          <AdminBadgeContext.Provider value={{ refreshCounts }}>
            {children}
          </AdminBadgeContext.Provider>
        </main>
        <footer className={styles.hubFooter}>
          <a href="/" className={styles.hubBrand}>rest.by<span className={styles.green}>.me</span></a>
        </footer>
      </div>
    )
  }

  return (
    <div className={`${styles.layout} ${collapsed ? styles.layoutCollapsed : ''}`}>

      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sbTop}>
          {!collapsed && <Link to="/admin" className={styles.sbRestTitle}>{restName}</Link>}
          <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Otvori sidebar' : 'Zatvori sidebar'}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {!collapsed && (
          <div className={styles.sbRole}>
            <div className={styles.sbRoleIcon}>
              {restaurant?.logo_url
                ? <img src={restaurant.logo_url} alt={restName} className={styles.sbRoleLogoImg} />
                : restName[0]}
            </div>
            <div>
              <div className={styles.sbRoleName}>{restName}</div>
              <div className={styles.sbRoleLabel}>{restRole}</div>
            </div>
          </div>
        )}

        <nav className={styles.nav}>
          <Link to="/admin" className={styles.navBackItem} title="Kontrolna tabla">
            <span className={styles.navIcon}>←</span>
            {!collapsed && <span>Kontrolna tabla</span>}
          </Link>

          <div className={styles.navDivider} />

          {activeModule?.interactive && (
            <>
              {renderSegment(activeModule.interactive)}
              <div className={styles.navDivider} />
            </>
          )}

          {renderSegment(activeModule?.admin)}

          {activeModule && (
            <>
              <div className={styles.navDivider} />
              <Link
                to={`${activeModule.path}/help`}
                className={`${styles.navItem} ${isActive(`${activeModule.path}/help`) ? styles.navItemActive : ''}`}
                title="Uputstvo"
              >
                <span className={styles.navIcon}>❓</span>
                {!collapsed && <span>Uputstvo</span>}
              </Link>
            </>
          )}

          {isSuperAdmin() && (
            <>
              <div className={styles.navDivider} />
              <Link to="/superadmin"
                className={`${styles.navItem} ${isActive('/superadmin') ? styles.navItemActive : ''}`}
                title="Super admin">
                <span className={styles.navIcon}>🔧</span>
                {!collapsed && <span>Super admin</span>}
              </Link>
            </>
          )}
        </nav>

        <div className={styles.sbBottom}>
          {restaurant && !collapsed && (
            <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.viewMenuBtn}>
              👁 Restoran
            </a>
          )}
          {restaurant && !collapsed && hasAddon('hotel_core') && (
            <a href={`/${restaurant.slug}/hotel`} target="_blank" rel="noreferrer" className={styles.viewMenuBtn}>
              🏨 Hotel sajt
            </a>
          )}
          <Link to="/admin/account"
            className={`${styles.navItem} ${isActive('/admin/account') ? styles.navItemActive : ''}`}
            title="Moj nalog">
            <span className={styles.navIcon}>👤</span>
            {!collapsed && <span>Moj nalog</span>}
          </Link>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Odjava">
            {collapsed ? '↩' : 'Odjava'}
          </button>
          {!collapsed && <a href="/" className={styles.sbBrand}>rest.by.me</a>}
        </div>
      </aside>

      <div className={styles.mainWrap}>
        <header className={styles.topbar}>
          {/* Desktop breadcrumb */}
          <div className={styles.breadcrumbDesktop}>
            <Link to="/admin" className={styles.breadcrumbLink}>Kontrolna tabla</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{activeModule ? activeModule.label : 'Admin'}</span>
          </div>

          {/* Mobile topbar */}
          <div className={styles.mobileTopbar}>
            <Link to="/admin" className={styles.mobileBackBtn}>
              ← Nazad
            </Link>
            <span className={styles.mobileModuleTitle}>{activeModule ? activeModule.label : 'Admin'}</span>
            <button
              className={styles.hamburger}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Otvori meni"
            >
              ☰
            </button>
          </div>

          <div className={styles.topbarRight}>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <AnnouncementBanner />
        <TrialBanner />
        <main className={styles.main}>
          <AdminBadgeContext.Provider value={{ refreshCounts }}>
            {children}
          </AdminBadgeContext.Provider>
        </main>
        <footer className={styles.pageFooter}>
          <a href="/" className={styles.pageBrand}>rest.by<span className={styles.green}>.me</span></a>
        </footer>
      </div>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileMenuOpen(false)}>
          <aside className={styles.mobileDrawer} onClick={e => e.stopPropagation()}>
            <div className={styles.mobileDrawerTop}>
              {!collapsed && <Link to="/admin" className={styles.sbRestTitle} onClick={() => setMobileMenuOpen(false)}>{restName}</Link>}
              <button className={styles.mobileDrawerClose} onClick={() => setMobileMenuOpen(false)}>✕</button>
            </div>

            <div className={styles.sbRole} style={{ padding: '12px 16px' }}>
              <div className={styles.sbRoleIcon}>
                {restaurant?.logo_url
                  ? <img src={restaurant.logo_url} alt={restName} className={styles.sbRoleLogoImg} />
                  : restName[0]}
              </div>
              <div>
                <div className={styles.sbRoleName}>{restName}</div>
                <div className={styles.sbRoleLabel}>{restRole}</div>
              </div>
            </div>

            <nav className={styles.nav} style={{ flex: 1, overflowY: 'auto' }}>
              <Link to="/admin" className={styles.navBackItem} onClick={() => setMobileMenuOpen(false)}>
                <span className={styles.navIcon}>←</span>
                <span>Kontrolna tabla</span>
              </Link>
              <div className={styles.navDivider} />

              {activeModule?.interactive && (
                <>
                  {renderSegment(activeModule.interactive, true, () => setMobileMenuOpen(false))}
                  <div className={styles.navDivider} />
                </>
              )}
              {renderSegment(activeModule?.admin, true, () => setMobileMenuOpen(false))}

              {activeModule && (
                <>
                  <div className={styles.navDivider} />
                  <Link to={`${activeModule.path}/help`} className={styles.navItem} onClick={() => setMobileMenuOpen(false)}>
                    <span className={styles.navIcon}>❓</span>
                    <span>Uputstvo</span>
                  </Link>
                </>
              )}
              {isSuperAdmin() && (
                <>
                  <div className={styles.navDivider} />
                  <Link to="/superadmin" className={styles.navItem} onClick={() => setMobileMenuOpen(false)}>
                    <span className={styles.navIcon}>🔧</span>
                    <span>Super admin</span>
                  </Link>
                </>
              )}
            </nav>

            <div className={styles.sbBottom}>
              {restaurant && (
                <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.viewMenuBtn}>
                  👁 Meni uživo
                </a>
              )}
              <LanguageSwitcher variant="dark" />
              <ThemeToggle variant="dark" />
              <button className={styles.logoutBtn} onClick={handleLogout}>Odjava</button>
              <a href="/" className={styles.sbBrand}>rest.by.me</a>
            </div>
          </aside>
        </div>
      )}


    </div>
  )
}
