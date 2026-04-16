import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePlatform } from '../context/PlatformContext'
import styles from './AdminLayout.module.css'

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
      { label: 'Dashboard',  icon: '📊', path: '/admin/menu',          exact: true },
      { label: 'Meni',       icon: '🍽️', path: '/admin/menu/items',    perm: 'edit_menu' },
      { label: 'Narudžbe',   icon: '🧾', path: '/admin/orders',        perm: 'view_orders' },
      { label: 'Zahtjevi',   icon: '🔔', path: '/admin/waiter',        perm: 'view_waiter_req' },
      { label: 'QR kod',     icon: '📱', path: '/admin/menu/qr' },
    ],
  },
  {
    key: 'tables',
    label: 'Stolovi',
    icon: '🪑',
    desc: 'Mapa stolova, status i rezervacije',
    path: '/admin/tables',
    active: false,
    perm: 'view_tables',
    links: [
      { label: 'Mapa stolova',  icon: '🗺️', path: '/admin/tables',       exact: true },
      { label: 'Rezervacije',   icon: '📅', path: '/admin/reservations', perm: 'view_reservations' },
    ],
  },
  {
    key: 'inventory',
    label: 'Zalihe',
    icon: '📦',
    desc: 'Inventar, dobavljači i izvještaji potrošnje',
    path: '/admin/inventory',
    active: false,
    perm: 'view_inventory',
    links: [
      { label: 'Inventar', icon: '📦', path: '/admin/inventory', exact: true },
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
      { label: 'Zaposleni',       icon: '👤', path: '/admin/staff',       exact: true },
      { label: 'Role i permisije',icon: '🔑', path: '/admin/staff/roles', perm: 'manage_roles' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analitika',
    icon: '📊',
    desc: 'Promet, najprodavanija jela, izvještaji',
    path: '/admin/analytics',
    active: false,
    perm: 'view_analytics',
    links: [
      { label: 'Pregled',     icon: '📊', path: '/admin/analytics',         exact: true },
      { label: 'Izvještaji',  icon: '📈', path: '/admin/analytics/reports', perm: 'view_reports' },
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
    ],
  },
]

const BOTTOM_NAV = [
  { path: '/admin',        label: 'Početna',  icon: '⊞', exact: true },
  { path: '/admin/menu',   label: 'Meni',     icon: '🍽️', perm: 'view_menu' },
  { path: '/admin/orders', label: 'Narudžbe', icon: '🧾', perm: 'view_orders' },
  { path: '/admin/staff',  label: 'Osoblje',  icon: '👥', perm: 'view_staff' },
  { path: '/admin/settings',label: 'Postavke',icon: '⚙️' },
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
      : ['/admin/settings'].some(p => location.pathname.startsWith(p))
      ? MODULES.find(m => m.key === 'settings')
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
          {/* Naziv restorana umjesto brenda */}
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

        {/* Diskretan brend link na dnu */}
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

        {/* Top — naziv restorana + collapse dugme */}
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

        {/* Role korisnika — samo kad je otvoren */}
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

        {/* Navigacija */}
        <nav className={styles.nav}>

          {/* ← Kontrolna tabla */}
          <Link
            to="/admin"
            className={styles.navBackItem}
            title="Kontrolna tabla"
          >
            <span className={styles.navIcon}>←</span>
            {!collapsed && <span>Kontrolna tabla</span>}
          </Link>

          <div className={styles.navDivider} />

          {/* Naziv aktivnog modula */}
          {!collapsed && activeModule && (
            <div className={styles.navModuleTitle}>
              {activeModule.icon} {activeModule.label}
            </div>
          )}

          {/* Linkovi modula */}
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

          {/* Uputstvo */}
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

        {/* Dno — meni uživo, odjava, brend */}
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
          <button
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Odjava"
          >
            {collapsed ? '↩' : 'Odjava'}
          </button>

          {/* Diskretan brend na dnu */}
          {!collapsed && (
            <a href="/" className={styles.sbBrand}>
              smartmeni.me
            </a>
          )}
        </div>
      </aside>

      {/* Main */}
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

        <main className={styles.main}>
          {children}
        </main>
        <footer className={styles.pageFooter}>
          <a href="/" className={styles.pageBrand}>
            smart<span className={styles.green}>meni</span>.me
          </a>
        </footer>
      </div>

      {/* Mobile bottom nav */}
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
