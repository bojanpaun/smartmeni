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
    desc: 'Stavke, kategorije, narudžbe i zahtjevi konobara',
    path: '/admin/menu',
    active: true,
    perm: 'view_menu',
    links: [
      { label: 'Meni i stavke', icon: '🍽️', path: '/admin/menu',   exact: true },
      { label: 'Narudžbe',      icon: '🧾', path: '/admin/orders',  perm: 'view_orders' },
      { label: 'Zahtjevi',      icon: '🔔', path: '/admin/waiter',  perm: 'view_waiter_req' },
    ],
  },
  {
    key: 'tables',
    label: 'Stolovi',
    icon: '🪑',
    desc: 'Mapa stolova, status u realnom vremenu i rezervacije',
    path: '/admin/tables',
    active: true,
    perm: 'view_tables',
    links: [
      { label: 'Mapa stolova',    icon: '🗺️', path: '/admin/tables',        exact: true },
      { label: 'Prikaz konobara', icon: '👁',  path: '/admin/tables/view' },
      { label: 'Rezervacije',     icon: '📅', path: '/admin/reservations' },
    ],
  },
  {
    key: 'inventory',
    label: 'Zalihe',
    icon: '📦',
    desc: 'Inventar, pokreti zaliha i recepture',
    path: '/admin/inventory',
    active: true,
    perm: 'view_inventory',
    links: [
      { label: 'Inventar',  icon: '📦', path: '/admin/inventory',           exact: true },
      { label: 'Pokreti',   icon: '📋', path: '/admin/inventory/movements' },
      { label: 'Recepture', icon: '🧪', path: '/admin/inventory/recipes' },
    ],
  },
  {
    key: 'staff',
    label: 'Osoblje',
    icon: '👥',
    desc: 'Zaposleni, role i permisije',
    path: '/admin/staff',
    active: true,
    perm: 'view_staff',
    links: [
      { label: 'Zaposleni',        icon: '👤', path: '/admin/staff',       exact: true },
      { label: 'Role i permisije', icon: '🔑', path: '/admin/staff/roles',  perm: 'manage_roles' },
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    icon: '👥',
    desc: 'Rasporedi, dolasci, zarade i izvještaji osoblja',
    path: '/admin/hr',
    active: true,
    perm: 'view_hr',
    links: [
      { label: 'Raspored',   icon: '📅', path: '/admin/hr/schedule' },
      { label: 'Dolasci',    icon: '🕐', path: '/admin/hr/attendance' },
      { label: 'Zarade',     icon: '💰', path: '/admin/hr/payroll' },
      { label: 'Izvještaji', icon: '📊', path: '/admin/hr/reports' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analitika',
    icon: '📊',
    desc: 'Prihod, najprodavanija jela i najprometniji sati',
    path: '/admin/analytics',
    active: true,
    perm: 'view_analytics',
    links: [
      { label: 'Pregled', icon: '📊', path: '/admin/analytics', exact: true },
    ],
  },
  {
    key: 'settings',
    label: 'Postavke',
    icon: '⚙️',
    desc: 'Predlošci, logo i podešavanja restorana',
    path: '/admin/settings',
    active: true,
    perm: null,
    links: [
      { label: 'Predlošci',      icon: '🎨', path: '/admin/settings/templates', exact: true },
      { label: 'Logo',           icon: '🖼️', path: '/admin/settings/logo' },
      { label: 'Opšte postavke', icon: '⚙️', path: '/admin/settings/general' },
      { label: 'Pretplata',      icon: '💳', path: '/admin/billing' },
    ],
  },
]

const BOTTOM_NAV = [
  { path: '/admin',          label: 'Početna',  icon: '⊞', exact: true },
  { path: '/admin/menu',     label: 'Meni',     icon: '🍽️', perm: 'view_menu' },
  { path: '/admin/orders',   label: 'Narudžbe', icon: '🧾', perm: 'view_orders' },
  { path: '/admin/tables',   label: 'Stolovi',  icon: '🪑', perm: 'view_tables' },
  { path: '/admin/settings', label: 'Postavke', icon: '⚙️' },
]

export default function AdminLayout({ children }) {
  const { restaurant, logout, isOwner, isSuperAdmin, hasPermission } = usePlatform()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const isHub = location.pathname === '/admin'

  const activeModule = MODULES.find(m =>
    location.pathname === m.path || location.pathname.startsWith(m.path + '/')
  ) || (
    ['/admin/orders', '/admin/waiter', '/admin/kitchen'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'menu')
      : ['/admin/settings', '/admin/billing'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'settings')
      : ['/admin/reservations'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'tables')
      : ['/admin/staff/roles'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'staff')
      : null
  )

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  const canAccess = (perm) => {
    if (!perm) return true
    return isOwner() || isSuperAdmin() || hasPermission(perm)
  }

  const restName = restaurant?.name || 'Admin'
  const restRole = isSuperAdmin() ? 'Super admin' : isOwner() ? 'Vlasnik' : 'Osoblje'

  // ── Kontrolna tabla — bez sidebara ──
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
                : restName[0]
              }
            </div>
            <span className={styles.hubRole}>{restRole}</span>
            <button className={styles.hubLogoutBtn} onClick={handleLogout}>Odjava</button>
          </div>
        </header>

        <main className={styles.hubMain}>
          {children}
        </main>

        <footer className={styles.hubFooter}>
          <a href="/" className={styles.hubBrand}>
            smart<span className={styles.green}>meni</span>.me
          </a>
        </footer>
      </div>
    )
  }

  // ── Modul stranica — sa sidebarom ──
  return (
    <div className={`${styles.layout} ${collapsed ? styles.layoutCollapsed : ''}`}>

      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>

        <div className={styles.sbTop}>
          {!collapsed && (
            <Link to="/admin" className={styles.sbRestTitle}>
              {restName}
            </Link>
          )}
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Otvori sidebar' : 'Zatvori sidebar'}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        {!collapsed && (
          <div className={styles.sbRole}>
            <div className={styles.sbRoleIcon}>
              {restaurant?.logo_url
                ? <img src={restaurant.logo_url} alt={restName} className={styles.sbRoleLogoImg} />
                : restName[0]
              }
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

          {!collapsed && activeModule && (
            <div className={styles.navModuleTitle}>
              {activeModule.icon} {activeModule.label}
            </div>
          )}

          {activeModule?.links.map((link, i) => {
            if (!canAccess(link.perm)) return null
            return (
              <Link
                key={i}
                to={link.path}
                className={`${styles.navItem} ${isActive(link.path, link.exact) ? styles.navItemActive : ''}`}
                title={link.label}
              >
                <span className={styles.navIcon}>{link.icon}</span>
                {!collapsed && <span>{link.label}</span>}
              </Link>
            )
          })}

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
              <Link
                to="/superadmin"
                className={`${styles.navItem} ${isActive('/superadmin') ? styles.navItemActive : ''}`}
                title="Super admin"
              >
                <span className={styles.navIcon}>🔧</span>
                {!collapsed && <span>Super admin</span>}
              </Link>
            </>
          )}
        </nav>

        <div className={styles.sbBottom}>
          {restaurant && !collapsed && (
            <a
              href={`/${restaurant.slug}`}
              target="_blank"
              rel="noreferrer"
              className={styles.viewMenuBtn}
            >
              👁 Meni uživo
            </a>
          )}
          <Link
            to="/admin/account"
            className={`${styles.navItem} ${isActive('/admin/account') ? styles.navItemActive : ''}`}
            title="Moj nalog"
          >
            <span className={styles.navIcon}>👤</span>
            {!collapsed && <span>Moj nalog</span>}
          </Link>

          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Odjava"
          >
            {collapsed ? '↩' : 'Odjava'}
          </button>

          {!collapsed && (
            <a href="/" className={styles.sbBrand}>
              smartmeni.me
            </a>
          )}
        </div>
      </aside>

      <div className={styles.mainWrap}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            <Link to="/admin" className={styles.breadcrumbLink}>Kontrolna tabla</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>
              {activeModule ? activeModule.label : 'Admin'}
            </span>
          </div>
        </header>

        <TrialBanner />
        <main className={styles.main}>
          {children}
        </main>
        <footer className={styles.pageFooter}>
          <a href="/" className={styles.pageBrand}>
            smart<span className={styles.green}>meni</span>.me
          </a>
        </footer>
      </div>

      <nav className={styles.bottomNav}>
        {BOTTOM_NAV.map((item, i) => {
          if (!canAccess(item.perm)) return null
          return (
            <Link
              key={i}
              to={item.path}
              className={`${styles.bottomNavItem} ${isActive(item.path, item.exact) ? styles.bottomNavItemActive : ''}`}
            >
              <span className={styles.bottomNavIcon}>{item.icon}</span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </Link>
          )
        })}
      </nav>

    </div>
  )
}
