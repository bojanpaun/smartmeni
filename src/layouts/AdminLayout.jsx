import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { usePlatform } from '../context/PlatformContext'
import { PermissionGate } from '../hooks/usePermission'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  {
    label: 'Digitalni meni', icon: '🍽️', section: true,
    items: [
      { path: '/admin/menu', label: 'Meni', perm: 'view_menu' },
      { path: '/admin/orders', label: 'Narudžbe', perm: 'view_orders' },
      { path: '/admin/waiter', label: 'Zahtjevi', perm: 'view_waiter_req' },
    ]
  },
  {
    label: 'Stolovi', icon: '🪑', section: true,
    items: [
      { path: '/admin/tables', label: 'Mapa stolova', perm: 'view_tables' },
      { path: '/admin/reservations', label: 'Rezervacije', perm: 'view_reservations' },
    ]
  },
  {
    label: 'Zalihe', icon: '📦', section: true,
    items: [
      { path: '/admin/inventory', label: 'Inventar', perm: 'view_inventory' },
    ]
  },
  {
    label: 'Upravljanje', icon: '⚙️', section: true,
    items: [
      { path: '/admin/staff', label: 'Osoblje i role', perm: 'view_staff' },
      { path: '/admin/analytics', label: 'Analitika', perm: 'view_analytics' },
      { path: '/admin/settings', label: 'Postavke' },
    ]
  },
]

export default function AdminLayout({ children }) {
  const { restaurant, user, logout, isOwner, isSuperAdmin } = usePlatform()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.sbTop}>
          <div className={styles.sbLogo}>
            {!collapsed && <><span>smart</span><span className={styles.green}>meni</span></>}
            {collapsed && <span className={styles.green}>S</span>}
          </div>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {restaurant && !collapsed && (
          <div className={styles.sbRest}>
            <div className={styles.sbRestIcon}>{restaurant.name[0]}</div>
            <div className={styles.sbRestInfo}>
              <div className={styles.sbRestName}>{restaurant.name}</div>
              <div className={styles.sbRestRole}>
                {isSuperAdmin() ? 'Super admin' : isOwner() ? 'Vlasnik' : 'Osoblje'}
              </div>
            </div>
          </div>
        )}

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className={styles.navSection}>
                  {!collapsed && (
                    <div className={styles.navSectionLabel}>
                      {item.icon} {item.label}
                    </div>
                  )}
                  {item.items.map((sub, j) => {
                    const navItem = (
                      <Link
                        key={j}
                        to={sub.path}
                        className={`${styles.navItem} ${isActive(sub.path) ? styles.navItemActive : ''}`}
                        title={collapsed ? sub.label : ''}
                      >
                        {collapsed ? '·' : sub.label}
                      </Link>
                    )
                    if (sub.perm) {
                      return (
                        <PermissionGate key={j} perm={sub.perm}>
                          {navItem}
                        </PermissionGate>
                      )
                    }
                    return navItem
                  })}
                </div>
              )
            }
            return (
              <Link
                key={i}
                to={item.path}
                className={`${styles.navItem} ${styles.navItemMain} ${isActive(item.path, item.exact) ? styles.navItemActive : ''}`}
              >
                {item.icon} {!collapsed && item.label}
              </Link>
            )
          })}

          {isSuperAdmin() && (
            <div className={styles.navSection}>
              {!collapsed && <div className={styles.navSectionLabel}>🔧 Platforma</div>}
              <Link to="/superadmin" className={`${styles.navItem} ${isActive('/superadmin') ? styles.navItemActive : ''}`}>
                {collapsed ? '🔧' : 'Super admin panel'}
              </Link>
            </div>
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
          <button className={styles.logoutBtn} onClick={handleLogout}>
            {collapsed ? '↩' : 'Odjava'}
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
