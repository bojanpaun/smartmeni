// ▶ Zamijeniti: src/layouts/AdminLayout.jsx

import { useState, useEffect, createContext, useContext } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../context/PlatformContext'
import { supabase } from '../lib/supabase'
import styles from './AdminLayout.module.css'
import TrialBanner from '../platform/admin/TrialBanner'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../i18n/LanguageSwitcher'
import useKitchenCounts from '../hooks/useKitchenCounts'
import { useAnnouncements } from '../context/AnnouncementsContext'
import { useSupport } from '../context/SupportContext'
const SEV_BANNER = {
  important: { bg: 'var(--c-danger-bg)',  border: 'var(--c-danger-border)',  text: 'var(--c-danger)',  icon: '⚠️' },
  update:    { bg: 'var(--c-success-bg)', border: 'var(--c-success-border)', text: 'var(--c-success)', icon: '✨' },
  info:      { bg: 'var(--c-info-bg)',    border: 'var(--c-info-border)',    text: 'var(--c-info)',    icon: '📣' },
}

// Banner ispod headera za nepročitane platform najave (jedna po jedna, može da se ugasi)
function AnnouncementBanner() {
  const { t } = useTranslation('admin')
  const { bannerUnread, dismissBanner } = useAnnouncements()
  const navigate = useNavigate()
  if (!bannerUnread?.length) return null
  const a = bannerUnread[0]
  const c = SEV_BANNER[a.severity] || SEV_BANNER.info
  return (
    <div style={{ margin: '14px 20px 0', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 16 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, color: c.text }}>{a.title}</span>
        {a.body && <span style={{ color: c.text, opacity: 0.85, fontSize: 13, marginLeft: 8 }}>{a.body}</span>}
      </div>
      <button onClick={() => navigate('/admin/notifications')} style={{ background: 'none', border: `1px solid ${c.border}`, color: c.text, borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{t('bannerDetails')}</button>
      <button onClick={() => dismissBanner(a.id)} title={t('close')} style={{ background: 'none', border: 'none', color: c.text, fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>✕</button>
    </div>
  )
}

// Context za proslijeđivanje refresh funkcije dashboard komponentama
export const AdminBadgeContext = createContext({ refreshCounts: () => {} })
export const useAdminBadgeRefresh = () => useContext(AdminBadgeContext)

// Nav config — labelKey/descKey se rješavaju kroz t('admin:…') u renderu (Faza 2).
// MODULES je export (čita ga i ControlPanel) — i tamo se labelKey/descKey rješava t-om.
export const MODULES = [
  {
    key: 'menu',
    labelKey: 'modMenu',
    icon: '🍽️',
    descKey: 'descMenu',
    path: '/admin/menu',
    active: true,
    perm: 'view_menu',
    interactive: {
      labelKey: 'modMenu',
      links: [
        { labelKey: 'navOrders', icon: '🧾', path: '/admin/orders',  perm: 'view_orders' },
        { labelKey: 'navWaiterReq', icon: '🔔', path: '/admin/waiter',  perm: 'view_waiter_req' },
        { labelKey: 'navKitchen',  icon: '🧑‍🍳', path: '/admin/kitchen', perm: 'view_kitchen_orders' },
        { labelKey: 'navBar',      icon: '🍷', path: '/admin/bar',     perm: 'view_bar_orders' },
      ],
    },
    admin: {
      labelKey: 'segMenuAdmin',
      links: [
        { labelKey: 'navAnalytics',         icon: '📊', path: '/admin/menu/analytics' },
        { labelKey: 'navMenuEdit', icon: '🍽️', path: '/admin/menu',           exact: true },
        { labelKey: 'navMenuSettings',   icon: '⚙️', path: '/admin/menu/settings' },
        { labelKey: 'navRestaurantSite',    icon: '🌐', path: '/admin/menu/landing' },
        { labelKey: 'navQr',            icon: '📱', path: '/admin/menu/qr' },
      ],
    },
  },
  {
    key: 'tables',
    labelKey: 'modTables',
    icon: '🪑',
    descKey: 'descTables',
    path: '/admin/tables',
    active: true,
    perm: 'view_tables',
    interactive: {
      labelKey: 'segTablesInteractive',
      links: [
        { labelKey: 'navTablesView', icon: '👁',  path: '/admin/tables/view' },
        { labelKey: 'navReservations',     icon: '📅', path: '/admin/reservations' },
        { labelKey: 'navEvents',           icon: '🎉', path: '/admin/tables/events' },
      ],
    },
    admin: {
      labelKey: 'segTablesAdmin',
      links: [
        { labelKey: 'navTableAssignments', icon: '👥', path: '/admin/tables/assignments' },
        { labelKey: 'navAnalytics',        icon: '📊', path: '/admin/tables/analytics' },
        { labelKey: 'navTablesSettings', icon: '🗺️', path: '/admin/tables', exact: true },
      ],
    },
  },
  {
    key: 'inventory',
    labelKey: 'modInventory',
    icon: '📦',
    descKey: 'descInventory',
    path: '/admin/inventory',
    active: true,
    perm: 'view_inventory',
    interactive: null,
    admin: {
      labelKey: 'segInventoryAdmin',
      links: [
        { labelKey: 'navAnalytics',       icon: '📊', path: '/admin/inventory/analytics' },
        { labelKey: 'navInventoryList',        icon: '📦', path: '/admin/inventory',             exact: true },
        { labelKey: 'navStockMovements', icon: '📋', path: '/admin/inventory/movements' },
        { labelKey: 'navSuppliers',     icon: '🚚', path: '/admin/inventory/suppliers' },
        { labelKey: 'navPurchaseOrders', icon: '🧾', path: '/admin/inventory/orders' },
        { labelKey: 'navStockTake',     icon: '🧮', path: '/admin/inventory/stocktake' },
        { labelKey: 'navRecipes',       icon: '🧪', path: '/admin/inventory/recipes' },
      ],
    },
  },
  {
    key: 'hr',
    labelKey: 'modHr',
    icon: '👥',
    descKey: 'descHr',
    path: '/admin/hr',
    active: true,
    perm: 'view_hr',
    interactive: {
      labelKey: 'modHr',
      links: [
        { labelKey: 'navAttendance', icon: '🕐', path: '/admin/hr/attendance' },
      ],
    },
    admin: {
      labelKey: 'segHrAdmin',
      links: [
        { labelKey: 'navAnalytics', icon: '📊', path: '/admin/hr/reports' },
        { labelKey: 'navStaff',  icon: '👤', path: '/admin/hr/staff' },
        { labelKey: 'navSchedule',  icon: '📅', path: '/admin/hr/schedule' },
        { labelKey: 'navPayroll',    icon: '💰', path: '/admin/hr/payroll' },
        { labelKey: 'navStaffPortal', icon: '📱', path: '/admin/hr/staff-portal-info' },
      ],
    },
  },
  {
    key: 'guests',
    labelKey: 'modGuests',
    icon: '🎟️',
    descKey: 'descGuests',
    path: '/admin/guests',
    active: true,
    perm: 'view_analytics',
    interactive: null,
    admin: {
      labelKey: 'modGuests',
      links: [
        { labelKey: 'navGuestList', icon: '👤', path: '/admin/guests', exact: true },
      ],
    },
  },
  {
    key: 'analytics',
    labelKey: 'modAnalytics',
    icon: '📊',
    descKey: 'descAnalytics',
    path: '/admin/analytics',
    active: true,
    perm: 'view_analytics',
    interactive: null,
    admin: {
      labelKey: 'modAnalytics',
      links: [
        { labelKey: 'navOverview', icon: '📊', path: '/admin/analytics', exact: true },
      ],
    },
  },
  {
    key: 'hotel',
    labelKey: 'modHotel',
    icon: '🏨',
    descKey: 'descHotel',
    path: '/admin/hotel',
    active: true,
    addonId: 'hotel_core',
    perm: null,
    interactive: {
      labelKey: 'segHotelInteractive',
      links: [
        { labelKey: 'navFrontDesk',   icon: '🛎️', path: '/admin/hotel/frontdesk' },
        { labelKey: 'navReservations', icon: '📅', path: '/admin/hotel/reservations' },
        { labelKey: 'navRooms',        icon: '🛏️', path: '/admin/hotel/rooms' },
        { labelKey: 'navHousekeeping', icon: '🧹', path: '/admin/hotel/housekeeping' },
        { labelKey: 'navMinibar',     icon: '🥤', path: '/admin/hotel/minibar' },
        { labelKey: 'navBreakfast',     icon: '🍳', path: '/admin/hotel/breakfast' },
        { labelKey: 'navNightAudit', icon: '🌙', path: '/admin/hotel/night-audit' },
      ],
    },
    admin: {
      labelKey: 'segHotelAdmin',
      links: [
        { labelKey: 'navDashboard',             icon: '📊', path: '/admin/hotel',                   exact: true },
        { labelKey: 'navRevenue', icon: '💹', path: '/admin/hotel/revenue' },
        { labelKey: 'navRoomTypes',           icon: '🪑', path: '/admin/hotel/room-types' },
        { labelKey: 'navRatePlans',      icon: '🏷️', path: '/admin/hotel/rate-plans' },
        { labelKey: 'navOnlineBooking',        icon: '🔗', path: '/admin/hotel/booking-settings' },
        { labelKey: 'navPayments',              icon: '💳', path: '/admin/hotel/payment' },
        { labelKey: 'navHotelSite',           icon: '🌐', path: '/admin/hotel/landing' },
      ],
    },
  },
  {
    key: 'spa',
    labelKey: 'modSpa',
    icon: '💆',
    descKey: 'descSpa',
    path: '/admin/spa',
    active: true,
    addonId: 'spa_wellness',
    perm: null,
    interactive: {
      labelKey: 'segSpaInteractive',
      links: [
        { labelKey: 'navCalendar',    icon: '📅', path: '/admin/spa/calendar' },
        { labelKey: 'navAppointments',     icon: '🗓️', path: '/admin/spa/appointments' },
      ],
    },
    admin: {
      labelKey: 'segSpaAdmin',
      links: [
        { labelKey: 'navDashboard',   icon: '📊', path: '/admin/spa',              exact: true },
        { labelKey: 'navTreatments',    icon: '💆', path: '/admin/spa/services' },
        { labelKey: 'navTherapists',   icon: '👤', path: '/admin/spa/therapists' },
        { labelKey: 'navCabins',      icon: '🚪', path: '/admin/spa/rooms' },
        { labelKey: 'navRetail',      icon: '🛍️', path: '/admin/spa/retail' },
        { labelKey: 'navPackages',      icon: '🎁', path: '/admin/spa/packages' },
        { labelKey: 'navAnalytics',   icon: '📊', path: '/admin/spa/analytics' },
        { labelKey: 'navSettings',    icon: '⚙️', path: '/admin/spa/settings' },
      ],
    },
  },
  {
    key: 'rental',
    labelKey: 'modRental',
    icon: '🏖️',
    descKey: 'descRental',
    path: '/admin/rental',
    active: true,
    addonId: 'rental_core',
    perm: null,
    interactive: {
      labelKey: 'segRentalOps',
      links: [
        { labelKey: 'rcTitle', icon: '📅', path: '/admin/rental/calendar' },
        { labelKey: 'rbTitle', icon: '🧾', path: '/admin/rental/bookings' },
      ],
    },
    admin: {
      labelKey: 'segRentalAdmin',
      links: [
        { labelKey: 'navDashboard', icon: '📊', path: '/admin/rental', exact: true },
        { labelKey: 'rdAssets',     icon: '🏠', path: '/admin/rental/assets' },
        { labelKey: 'rpTitle',      icon: '🏷️', path: '/admin/rental/pricing' },
        { labelKey: 'navRentalSite', icon: '🌐', path: '/admin/rental/site' },
        { labelKey: 'navSettings',  icon: '⚙️', path: '/admin/rental/settings' },
      ],
    },
  },
  {
    key: 'settings',
    labelKey: 'modSettings',
    icon: '⚙️',
    adminOnly: true,
    descKey: 'descSettings',
    path: '/admin/settings',
    active: true,
    perm: null,
    interactive: null,
    admin: {
      labelKey: 'segSettingsAdmin',
      links: [
        { labelKey: 'navBrand',          icon: '🖼️', path: '/admin/settings/brand' },
        { labelKey: 'navGeneral', icon: '📋', path: '/admin/settings/general' },
        { labelKey: 'navFiscalization', icon: '🧾', path: '/admin/settings/fiscalization' },
        { labelKey: 'navTheme',  icon: '🎨', path: '/admin/settings/theme' },
        { labelKey: 'navHardware', icon: '🖨️', path: '/admin/settings/hardware' },
        { labelKey: 'navAuditLog', icon: '📜', path: '/admin/settings/audit-log' },
        { labelKey: 'navSubscription',      icon: '💳', path: '/admin/billing' },
      ],
    },
  },
  {
    // Nije kategorisan (RESTAURANT/HOTEL/UPRAVLJANJE/adminOnly) → ne renderuje se kao
    // dashboard kartica; služi da sidebar prikaže linkove kad si na /admin/notifications.
    key: 'notifications',
    labelKey: 'modNotifications',
    icon: '📣',
    descKey: 'descNotifications',
    path: '/admin/notifications',
    active: true,
    perm: null,
    noHelp: true,
    interactive: null,
    admin: {
      labelKey: 'modNotifications',
      links: [
        { labelKey: 'navPlatformAnnounce', icon: '📣', path: '/admin/notifications/najave' },
        { labelKey: 'navBulletinBoard',    icon: '📌', path: '/admin/notifications/tabla' },
      ],
    },
  },
  {
    // Podrška — sidebar Poruke | Česta pitanja. Nije dashboard kartica (postoji Sistem kartica).
    key: 'support',
    labelKey: 'modSupport',
    icon: '💬',
    descKey: 'descSupport',
    path: '/admin/support',
    active: true,
    perm: null,
    noHelp: true,
    interactive: null,
    admin: {
      labelKey: 'modSupport',
      links: [
        { labelKey: 'navMessages', icon: '💬', path: '/admin/support', exact: true },
        { labelKey: 'navFaq',    icon: '📖', path: '/admin/support/faq' },
      ],
    },
  },
  {
    // Superadmin — kompletna navigacija u sidebar-u (na /superadmin* aktivno). Nije dashboard kartica.
    key: 'superadmin',
    labelKey: 'modSuperadmin',
    icon: '🔧',
    descKey: 'descSuperadmin',
    path: '/superadmin',
    active: true,
    perm: null,
    noHelp: true,
    interactive: null,
    admin: {
      labelKey: 'modSuperadmin',
      links: [
        { labelKey: 'navRestaurants',          icon: '🏢', path: '/superadmin', exact: true },
        { labelKey: 'navDashboardConfig',      icon: '🧭', path: '/superadmin/dashboard' },
        { labelKey: 'navSupport',            icon: '💬', path: '/superadmin/podrska' },
        { labelKey: 'navKnowledgeBase',  icon: '📖', path: '/superadmin/faq' },
        { labelKey: 'navNotifications',       icon: '📣', path: '/superadmin/obavestenja' },
        { labelKey: 'navBillingPrices',   icon: '💶', path: '/superadmin/billing' },
        { labelKey: 'navAuditLog',          icon: '📜', path: '/superadmin/audit-log' },
        { labelKey: 'navCustomPalettes',      icon: '🎨', path: '/superadmin/theme' },
        { labelKey: 'navLibraries',         icon: '📚', path: '/superadmin/libraries' },
      ],
    },
  },
]

const BOTTOM_NAV = [
  { path: '/admin',          labelKey: 'navHome',  icon: '⊞', exact: true },
  { path: '/admin/orders',   labelKey: 'navOrders', icon: '🧾', perm: 'view_orders' },
  { path: '/admin/waiter',   labelKey: 'navWaiterReq', icon: '🔔', perm: 'view_waiter_req' },
  { path: '/admin/kitchen',  labelKey: 'navKitchen',  icon: '🧑‍🍳', perm: 'view_kitchen_orders' },
  { path: '/admin/tables',   labelKey: 'modTables',  icon: '🪑', perm: 'view_tables' },
  { path: '/admin/settings', labelKey: 'modSettings', icon: '⚙️' },
]

export default function AdminLayout({ children }) {
  const { t } = useTranslation('admin')
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
      ? { key: 'staff', labelKey: 'modStaff', path: '/admin/staff', icon: '👤',
          interactive: null,
          admin: { labelKey: 'segStaffAdmin', links: [
            { labelKey: 'navRolesPerms', icon: '🔑', path: '/admin/staff/roles', exact: true },
            { labelKey: 'navStaffPortal', icon: '📱', path: '/admin/staff/portal', exact: true },
          ]}}
      : null
  )

  const { counts: kitchenCounts, refresh: refreshCounts } = useKitchenCounts(restaurant?.id, hasVertical('hotel'))
  const { openCount: supportOpen, superOpenCount: supportSuperOpen } = useSupport()
  const badges = {
    '/admin/orders':              kitchenCounts.waiter        || 0,
    '/admin/waiter':              kitchenCounts.waiterReq     || 0,
    '/admin/kitchen':             kitchenCounts.kitchen       || 0,
    '/admin/bar':                 kitchenCounts.bar           || 0,
    '/admin/hotel/housekeeping':  (kitchenCounts.housekeeping || 0) + (kitchenCounts.maintOpen || 0),
    '/admin/hotel/reservations':  kitchenCounts.hotelInquiry  || 0,
    '/admin/hotel/frontdesk':     kitchenCounts.hotelFrontDesk || 0,
    '/admin/support':             supportOpen      || 0,  // vlasnikovi neriješeni tiketi
    '/superadmin/podrska':        supportSuperOpen || 0,  // svi otvoreni tiketi (superadmin)
  }

  const handleLogout = async () => { await logout(); navigate('/') }

  const isActive = (path, exact = false) => exact ? location.pathname === path : location.pathname.startsWith(path)

  const canAccess = (perm) => !perm || isOwner() || isSuperAdmin() || hasPermission(perm)

  const restName = restaurant?.name || t('adminFallback')
  const restRole = isSuperAdmin() ? t('modSuperadmin') : isOwner() ? t('roleOwner') : t('roleStaff')

  const renderSegment = (segment, forceExpanded = false, onLinkClick = null) => {
    if (!segment) return null
    const visibleLinks = segment.links.filter(l => canAccess(l.perm))
    if (!visibleLinks.length) return null
    const expanded = forceExpanded || !collapsed
    return (
      <div className={styles.navSegment}>
        {expanded && (
          <div className={styles.navSegmentTitle}>{t(segment.labelKey)}</div>
        )}
        {visibleLinks.map((link, i) => {
          const badge = badges[link.path] || 0
          return (
            <Link
              key={i}
              to={link.path}
              className={`${styles.navItem} ${isActive(link.path, link.exact) ? styles.navItemActive : ''}`}
              title={t(link.labelKey)}
              onClick={onLinkClick}
            >
              <span className={styles.navIcon}>{link.icon}</span>
              {expanded && <span className={styles.navLinkLabel}>{t(link.labelKey)}</span>}
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
                👁 {t('liveRestaurant')}
              </a>
            )}
            {restaurant && hasVertical('hotel') && (
              <a href={`/${restaurant.slug}/hotel`} target="_blank" rel="noreferrer" className={styles.hubLiveBtn}>
                🏨 {t('liveHotelSite')}
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
            <button className={styles.hubLogoutBtn} onClick={handleLogout}>{t('logout')}</button>
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
            title={collapsed ? t('openSidebar') : t('closeSidebar')}>
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
          <Link to="/admin" className={styles.navBackItem} title={t('controlPanel')}>
            <span className={styles.navIcon}>←</span>
            {!collapsed && <span>{t('controlPanel')}</span>}
          </Link>

          <div className={styles.navDivider} />

          {activeModule?.interactive && (
            <>
              {renderSegment(activeModule.interactive)}
              <div className={styles.navDivider} />
            </>
          )}

          {renderSegment(activeModule?.admin)}

          {activeModule && !activeModule.noHelp && (
            <>
              <div className={styles.navDivider} />
              <Link
                to={`${activeModule.path}/help`}
                className={`${styles.navItem} ${isActive(`${activeModule.path}/help`) ? styles.navItemActive : ''}`}
                title={t('help')}
              >
                <span className={styles.navIcon}>❓</span>
                {!collapsed && <span>{t('help')}</span>}
              </Link>
            </>
          )}

          {isSuperAdmin() && (
            <>
              <div className={styles.navDivider} />
              <Link to="/superadmin"
                className={`${styles.navItem} ${isActive('/superadmin') ? styles.navItemActive : ''}`}
                title={t('modSuperadmin')}>
                <span className={styles.navIcon}>🔧</span>
                {!collapsed && <span>{t('modSuperadmin')}</span>}
              </Link>
            </>
          )}
        </nav>

        <div className={styles.sbBottom}>
          {restaurant && !collapsed && (
            <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.viewMenuBtn}>
              👁 {t('liveRestaurant')}
            </a>
          )}
          {restaurant && !collapsed && hasAddon('hotel_core') && (
            <a href={`/${restaurant.slug}/hotel`} target="_blank" rel="noreferrer" className={styles.viewMenuBtn}>
              🏨 {t('liveHotelSite')}
            </a>
          )}
          <Link to="/admin/account"
            className={`${styles.navItem} ${isActive('/admin/account') ? styles.navItemActive : ''}`}
            title={t('myAccount')}>
            <span className={styles.navIcon}>👤</span>
            {!collapsed && <span>{t('myAccount')}</span>}
          </Link>
          <button className={styles.logoutBtn} onClick={handleLogout} title={t('logout')}>
            {collapsed ? '↩' : t('logout')}
          </button>
          {!collapsed && <a href="/" className={styles.sbBrand}>rest.by.me</a>}
        </div>
      </aside>

      <div className={styles.mainWrap}>
        <header className={styles.topbar}>
          {/* Desktop breadcrumb */}
          <div className={styles.breadcrumbDesktop}>
            <Link to="/admin" className={styles.breadcrumbLink}>{t('controlPanel')}</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{activeModule ? t(activeModule.labelKey) : t('adminFallback')}</span>
          </div>

          {/* Mobile topbar */}
          <div className={styles.mobileTopbar}>
            <Link to="/admin" className={styles.mobileBackBtn}>
              ← {t('back')}
            </Link>
            <span className={styles.mobileModuleTitle}>{activeModule ? t(activeModule.labelKey) : t('adminFallback')}</span>
            <button
              className={styles.hamburger}
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t('openMenu')}
            >
              ☰
            </button>
          </div>

          <div className={styles.topbarRight}>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
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
                <span>{t('controlPanel')}</span>
              </Link>
              <div className={styles.navDivider} />

              {activeModule?.interactive && (
                <>
                  {renderSegment(activeModule.interactive, true, () => setMobileMenuOpen(false))}
                  <div className={styles.navDivider} />
                </>
              )}
              {renderSegment(activeModule?.admin, true, () => setMobileMenuOpen(false))}

              {activeModule && !activeModule.noHelp && (
                <>
                  <div className={styles.navDivider} />
                  <Link to={`${activeModule.path}/help`} className={styles.navItem} onClick={() => setMobileMenuOpen(false)}>
                    <span className={styles.navIcon}>❓</span>
                    <span>{t('help')}</span>
                  </Link>
                </>
              )}
              {isSuperAdmin() && (
                <>
                  <div className={styles.navDivider} />
                  <Link to="/superadmin" className={styles.navItem} onClick={() => setMobileMenuOpen(false)}>
                    <span className={styles.navIcon}>🔧</span>
                    <span>{t('modSuperadmin')}</span>
                  </Link>
                </>
              )}
            </nav>

            <div className={styles.sbBottom}>
              {restaurant && (
                <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer" className={styles.viewMenuBtn}>
                  👁 {t('liveMenu')}
                </a>
              )}
              <LanguageSwitcher variant="dark" />
              <ThemeToggle variant="dark" />
              <button className={styles.logoutBtn} onClick={handleLogout}>{t('logout')}</button>
              <a href="/" className={styles.sbBrand}>rest.by.me</a>
            </div>
          </aside>
        </div>
      )}


    </div>
  )
}
