// ▶ Zamijeniti: src/layouts/AdminLayout.jsx

import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePlatform } from '../context/PlatformContext'
import styles from './AdminLayout.module.css'
import TrialBanner from '../platform/admin/TrialBanner'

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
        { label: 'Narudžbe', icon: '🧾', path: '/admin/orders', perm: 'view_orders' },
        { label: 'Zahtjevi', icon: '🔔', path: '/admin/waiter', perm: 'view_waiter_req' },
      ],
    },
    admin: {
      label: 'Administracija menija',
      links: [
        { label: 'Analitika',             icon: '📊', path: '/admin/menu/analytics' },
        { label: 'Uređivanje menija',     icon: '🍽️', path: '/admin/menu',         exact: true },
        { label: 'Opšte postavke menija', icon: '⚙️', path: '/admin/menu/settings' },
        { label: 'QR kod',                icon: '📱', path: '/admin/menu/qr' },
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
        { label: 'Portal zaposlenika', icon: '📱', path: '/admin/hr/staff-portal-info' },
      ],
    },
  },
  {
    key: 'guests',
    label: 'Gosti',
    icon: '🎟️',
    desc: 'Evidencija gostiju, VIP lista, historija posjeta i potrošnja',
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
        { label: 'Predlošci',      icon: '🎨', path: '/admin/settings/templates', exact: true },
        { label: 'Logo',           icon: '🖼️', path: '/admin/settings/logo' },
        { label: 'Opšte postavke', icon: '⚙️', path: '/admin/settings/general' },
        { label: 'Pretplata',      icon: '💳', path: '/admin/billing' },
      ],
    },
  },
]

const BOTTOM_NAV = [
  { path: '/admin',          label: 'Početna',  icon: '⊞', exact: true },
  { path: '/admin/orders',   label: 'Narudžbe', icon: '🧾', perm: 'view_orders' },
  { path: '/admin/waiter',   label: 'Zahtjevi', icon: '🔔', perm: 'view_waiter_req' },
  { path: '/admin/tables',   label: 'Stolovi',  icon: '🪑', perm: 'view_tables' },
  { path: '/admin/settings', label: 'Postavke', icon: '⚙️' },
]

export default function AdminLayout({ children }) {
  const { restaurant, logout, isOwner, isSuperAdmin, hasPermission } = usePlatform()
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
    ['/admin/orders', '/admin/waiter', '/admin/kitchen'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'menu')
      : ['/admin/settings', '/admin/billing'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'settings')
      : ['/admin/reservations'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'tables')
      : location.pathname.startsWith('/admin/staff')
      ? { key: 'staff', label: 'Role i permisije', path: '/admin/staff', icon: '🔑',
          interactive: null,
          admin: { label: 'Administracija', links: [
            { label: 'Role i permisije', icon: '🔑', path: '/admin/staff/roles', exact: true },
          ]}}
      : null
  )

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
        {visibleLinks.map((link, i) => (
          <Link
            key={i}
            to={link.path}
            className={`${styles.navItem} ${isActive(link.path, link.exact) ? styles.navItemActive : ''}`}
            title={link.label}
            onClick={onLinkClick}
          >
            <span className={styles.navIcon}>{link.icon}</span>
            {expanded && <span>{link.label}</span>}
          </Link>
        ))}
      </div>
    )
  }

  if (isHub) {
    return (
      <div className={styles.hubLayout}>
        <header className={styles.hubHeader}>
          <div className={styles.hubRestName}>{restName}</div>
          <div className={styles.hubHeaderRight}>
            {restaurant && (
              <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.hubLiveBtn}>
                👁 Meni uživo
              </a>
            )}
            <div className={styles.hubRestIcon}>
              {restaurant?.logo_url
                ? <img src={restaurant.logo_url} alt={restName} className={styles.hubRestLogo} />
                : restName[0]}
            </div>
            <span className={styles.hubRole}>{restRole}</span>
            <button className={styles.hubLogoutBtn} onClick={handleLogout}>Odjava</button>
          </div>
        </header>
        <main className={styles.hubMain}>{children}</main>
        <footer className={styles.hubFooter}>
          <a href="/" className={styles.hubBrand}>smart<span className={styles.green}>meni</span>.me</a>
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
              👁 Meni uživo
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
          {!collapsed && <a href="/" className={styles.sbBrand}>smartmeni.me</a>}
        </div>
      </aside>

      <div className={styles.mainWrap}>
        <header className={styles.topbar}>
          <button
            className={styles.hamburger}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Otvori meni"
          >
            ☰
          </button>
          <div className={styles.breadcrumb}>
            <Link to="/admin" className={styles.breadcrumbLink}>Kontrolna tabla</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{activeModule ? activeModule.label : 'Admin'}</span>
          </div>
        </header>
        <TrialBanner />
        <main className={styles.main}>{children}</main>
        <footer className={styles.pageFooter}>
          <a href="/" className={styles.pageBrand}>smart<span className={styles.green}>meni</span>.me</a>
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
              <button className={styles.logoutBtn} onClick={handleLogout}>Odjava</button>
              <a href="/" className={styles.sbBrand}>smartmeni.me</a>
            </div>
          </aside>
        </div>
      )}


    </div>
  )
}
