import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import { MODULES } from '../../layouts/AdminLayout'
import OnboardingWizard from './OnboardingWizard'
import HotelOnboardingWizard from './HotelOnboardingWizard'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import { useSupport } from '../../context/SupportContext'
import styles from './ControlPanel.module.css'

// Mali numerički badge za kartice komunikacije
function CardBadge({ n }) {
  if (!n) return null
  return (
    <span style={{ marginLeft: 8, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--c-danger)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }}>
      {n > 9 ? '9+' : n}
    </span>
  )
}

const RESTAURANT_KEYS  = ['menu', 'tables']
const HOTEL_KEYS       = ['hotel', 'spa']
const UPRAVLJANJE_KEYS = ['hr', 'inventory', 'guests', 'analytics']

function useDashboardData(restaurant, hasHotel, hasSpa) {
  const [kpi, setKpi]       = useState({ ordersToday: null, revenueToday: null, checkinsToday: null, spaToday: null, occupancy: null, freeRooms: null })
  const [badges, setBadges] = useState({ waiter: 0, kitchen: 0, bar: 0, waiterReq: 0 })

  useEffect(() => {
    if (!restaurant?.id) return
    const rid  = restaurant.id

    // Sve KPI/badge brojke u jednom RPC pozivu (ranije ~11 zasebnih count-upita).
    async function load() {
      const { data } = await supabase.rpc('get_admin_overview', { p_restaurant_id: rid })
      if (!data) return
      setKpi({
        ordersToday:   data.orders_today || 0,
        revenueToday:  Number(data.revenue_today) || 0,
        checkinsToday: hasHotel ? (data.checkins_today || 0) : null,
        spaToday:      hasSpa   ? (data.spa_today || 0) : null,
        occupancy:     (hasHotel && data.total_rooms > 0)
          ? Math.round((data.checked_in_now / data.total_rooms) * 100) : null,
        freeRooms:     hasHotel ? (data.free_rooms || 0) : null,
      })
      setBadges({
        waiter:    data.waiter     || 0,
        kitchen:   data.kitchen    || 0,
        bar:       data.bar        || 0,
        waiterReq: data.waiter_req || 0,
      })
    }

    load()
    const ch = supabase.channel(`cp-${rid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders',          filter: `restaurant_id=eq.${rid}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_requests', filter: `restaurant_id=eq.${rid}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurant?.id, hasHotel, hasSpa])

  return { kpi, badges }
}

export default function ControlPanel() {
  const { t } = useTranslation('admin')
  const { restaurant, setRestaurant, hasPermission, isOwner, isSuperAdmin, hasAddon, hasVertical } = usePlatform()
  const { unread: unreadAnn } = useAnnouncements()
  const { unreadCount: unreadSupport } = useSupport()
  const navigate = useNavigate()
  // Hotel-only tenant (izabrao samo hotel pri registraciji) dobija HOTEL wizard
  // automatski; restoran/oba → restoranski (kao i dosad). Koristi isti
  // onboarding_completed flag (hotel wizard ga markira kad je auto-prikazan).
  const hotelOnly = !!restaurant && hasVertical('hotel') && !hasVertical('restaurant')
  const needsOnboarding = restaurant && !restaurant.onboarding_completed
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding && !hotelOnly)
  const [showHotelOnboarding, setShowHotelOnboarding] = useState(needsOnboarding && hotelOnly)
  const [hotelAuto, setHotelAuto] = useState(needsOnboarding && hotelOnly) // auto-prikaz → markiraj completed

  // Hotel/spa KPI upiti se rade SAMO ako tenant ima tu vertikalu (ne na osnovu
  // addona — beta mod ga svima postavlja na true, pa bi se hotel_reservations/rooms
  // upiti nepotrebno slali i restoranu-only nalogu).
  const hasHotel = hasVertical('hotel')
  const hasSpa   = hasVertical('hotel') && hasAddon('spa_wellness')
  const { kpi, badges } = useDashboardData(restaurant, hasHotel, hasSpa)

  const canSee    = (perm) => !perm || isOwner() || isSuperAdmin() || hasPermission(perm)
  const addonOn   = (mod)  => !mod.addonId || hasAddon(mod.addonId)

  const handleMod = (mod) => {
    if (!mod.active) return
    if (!addonOn(mod)) { navigate('/admin/billing'); return }
    navigate(mod.path)
  }

  const fmtRevenue = (v) => {
    if (v === null) return '—'
    if (v >= 1000) return `€${(v / 1000).toFixed(1)}k`
    return `€${Math.round(v)}`
  }

  // 2b/Faza: dodavanje biznisa (vertikale) naknadno. Restoran besplatno (odmah);
  // hotel plaćeno (aktivira vertikalu pa vodi na pretplatu).
  const ALL_VERTICALS = [
    { key: 'restaurant', emoji: '🍽️', titleKey: 'liveRestaurant', descKey: 'vertRestaurantDesc' },
    { key: 'hotel',      emoji: '🏨', titleKey: 'modHotel',        descKey: 'vertHotelDesc' },
  ]
  const missingVerticals = ALL_VERTICALS.filter(v => !hasVertical(v.key))
  const addVertical = async (v) => {
    if (!restaurant) return
    const next = Array.from(new Set([...(restaurant.active_verticals || ['restaurant']), v]))
    const { error } = await supabase.from('restaurants')
      .update({ active_verticals: next }).eq('id', restaurant.id)
    if (error) return
    setRestaurant({ ...restaurant, active_verticals: next })
    if (v === 'hotel') navigate('/admin/billing') // plaćeno → pretplata na hotel
  }

  const restaurantMods  = MODULES.filter(m => RESTAURANT_KEYS.includes(m.key)  && canSee(m.perm))
  const hotelMods       = MODULES.filter(m => HOTEL_KEYS.includes(m.key))
  const upravljanjeMods = MODULES.filter(m => UPRAVLJANJE_KEYS.includes(m.key) && canSee(m.perm))
  const adminMods       = MODULES.filter(m => m.adminOnly)

  const QUICK = [
    { labelKey: 'navOrders', icon: '🧾', path: '/admin/orders',  badge: badges.waiter,    perm: 'view_orders' },
    { labelKey: 'navKitchen',  icon: '🧑‍🍳', path: '/admin/kitchen', badge: badges.kitchen,   perm: 'view_orders' },
    { labelKey: 'navBar',      icon: '🍷', path: '/admin/bar',     badge: badges.bar,       perm: 'view_orders' },
    { labelKey: 'navWaiterReq', icon: '🔔', path: '/admin/waiter',  badge: badges.waiterReq, perm: 'view_waiter_req' },
    ...(hasHotel ? [{ labelKey: 'navFrontDesk', icon: '🛎️', path: '/admin/hotel/frontdesk', badge: kpi.checkinsToday || 0 }] : []),
    ...(hasSpa   ? [{ labelKey: 'quickSpaToday',  icon: '💆', path: '/admin/spa/appointments', badge: kpi.spaToday || 0 }] : []),
  ]
  const quickItems = QUICK.filter(a => canSee(a.perm))

  const renderCard = (mod) => {
    const accessible = canSee(mod.perm)
    const active     = addonOn(mod)
    const isSys      = !!mod.adminOnly
    return (
      <button
        key={mod.key}
        className={[
          styles.card,
          isSys ? styles.cardSys : '',
          mod.active ? styles.cardActive : styles.cardSoon,
          !accessible ? styles.cardLocked : '',
          !active ? styles.cardAddon : '',
        ].filter(Boolean).join(' ')}
        onClick={() => handleMod(mod)}
        disabled={!mod.active || !accessible}
      >
        <div className={styles.cardIcon}>{mod.icon}</div>
        <div className={styles.cardBody}>
          <div className={styles.cardName}>{t(mod.labelKey)}</div>
          <div className={styles.cardDesc}>{t(mod.descKey)}</div>
        </div>
        {!isSys && (
          <div className={styles.cardStatus}>
            {!accessible ? <span className={`${styles.badge} ${styles.badgeLocked}`}>{t('badgeNoAccess')}</span>
              : !active  ? <span className={`${styles.badge} ${styles.badgeAddon}`}>{t('badgeAddon')} →</span>
              : mod.active ? <span className={`${styles.badge} ${styles.badgeActive}`}>{t('badgeActive')}</span>
              : <span className={`${styles.badge} ${styles.badgeSoon}`}>{t('badgeSoon')}</span>}
          </div>
        )}
      </button>
    )
  }

  return (
    <div className={styles.page}>
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} onSkip={() => setShowOnboarding(false)} />
      )}
      {showHotelOnboarding && (
        <HotelOnboardingWizard markComplete={hotelAuto} onComplete={() => setShowHotelOnboarding(false)} onSkip={() => setShowHotelOnboarding(false)} />
      )}

      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>{restaurant ? restaurant.name : t('controlPanel')}</h1>
        <p className={styles.subtitle}>{t('cpSubtitle')}</p>
      </div>

      {/* ── KPI row ── */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>🧾</div>
          <div>
            <div className={styles.kpiValue}>{kpi.ordersToday ?? '—'}</div>
            <div className={styles.kpiLabel}>{t('kpiOrdersToday')}</div>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>💰</div>
          <div>
            <div className={styles.kpiValue}>{fmtRevenue(kpi.revenueToday)}</div>
            <div className={styles.kpiLabel}>{t('kpiRevenueToday')}</div>
          </div>
        </div>
        {hasHotel && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>🏨</div>
            <div>
              <div className={styles.kpiValue}>{kpi.checkinsToday ?? '—'}</div>
              <div className={styles.kpiLabel}>{t('kpiCheckinsToday')}</div>
            </div>
          </div>
        )}
        {hasHotel && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>📊</div>
            <div>
              <div className={styles.kpiValue}>{kpi.occupancy !== null ? `${kpi.occupancy}%` : '—'}</div>
              <div className={styles.kpiLabel}>{t('kpiOccupancy')}</div>
            </div>
          </div>
        )}
        {hasHotel && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>🛏️</div>
            <div>
              <div className={styles.kpiValue}>{kpi.freeRooms ?? '—'}</div>
              <div className={styles.kpiLabel}>{t('kpiFreeRooms')}</div>
            </div>
          </div>
        )}
        {hasSpa && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>💆</div>
            <div>
              <div className={styles.kpiValue}>{kpi.spaToday ?? '—'}</div>
              <div className={styles.kpiLabel}>{t('kpiSpaToday')}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick actions ── */}
      {quickItems.length > 0 && (
        <>
          <div className={styles.quickHead}>
            <span className={styles.quickHeadTitle}>⚡ {t('cpQuickTitle')}</span>
            <span className={styles.quickHeadHint}>{t('cpQuickHint')}</span>
          </div>
          <div className={styles.quickRow}>
            {quickItems.map(a => (
              <button key={a.path} className={styles.quickBtn} onClick={() => navigate(a.path)}>
                <span className={styles.quickIcon}>{a.icon}</span>
                <span className={styles.quickLabel}>{t(a.labelKey)}</span>
                {a.badge > 0 && <span className={styles.quickBadge}>{a.badge}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Restoran vertical ── */}
      {hasVertical('restaurant') && (
        <div className={styles.section}>
          <div className={styles.verticalHead}>
            <span className={styles.verticalEmoji}>🍽️</span>
            <div>
              <div className={styles.verticalTitle}>{t('liveRestaurant')}</div>
              <div className={styles.verticalSub}>{t('vertRestaurantSub')}</div>
            </div>
            {(isOwner() || isSuperAdmin()) && (
              <button onClick={() => setShowOnboarding(true)}
                style={{ marginLeft: 12, alignSelf: 'center', background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                📋 {t('guide')} →
              </button>
            )}
          </div>
          <div className={styles.grid}>{restaurantMods.map(renderCard)}</div>
        </div>
      )}

      {/* ── Hotel vertical (vidljivost po izabranoj vertikali; stranice iza
              hotel_core paywalla) ── */}
      {hasVertical('hotel') && (
        <div className={styles.section}>
          <div className={styles.verticalHead}>
            <span className={styles.verticalEmoji}>🏨</span>
            <div>
              <div className={styles.verticalTitle}>{t('modHotel')}</div>
              <div className={styles.verticalSub}>{t('vertHotelSub')}</div>
            </div>
            {(isOwner() || isSuperAdmin()) && (
              <button onClick={() => { setHotelAuto(false); setShowHotelOnboarding(true) }}
                style={{ marginLeft: 12, alignSelf: 'center', background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                📋 {t('guide')} →
              </button>
            )}
          </div>
          <div className={styles.grid}>{hotelMods.map(renderCard)}</div>
        </div>
      )}

      {/* ── Upravljanje (dijeljeni moduli) ── */}
      {(upravljanjeMods.length > 0 || isOwner() || isSuperAdmin()) && (
        <div className={styles.section}>
          <div className={styles.verticalHead}>
            <span className={styles.verticalEmoji}>📋</span>
            <div>
              <div className={styles.verticalTitle}>{t('vertManage')}</div>
              <div className={styles.verticalSub}>{t('vertManageSub')}</div>
            </div>
          </div>
          <div className={styles.grid}>
            {upravljanjeMods.map(renderCard)}
            {(isOwner() || isSuperAdmin()) && (
              <button className={`${styles.card} ${styles.cardActive}`} onClick={() => navigate('/admin/notifications')}>
                <div className={styles.cardIcon}>📣</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{t('modNotifications')} <CardBadge n={unreadAnn.length} /></div>
                  <div className={styles.cardDesc}>{t('annDesc')}</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Dodaj biznis (naknadno dodavanje vertikale) ── */}
      {isOwner() && missingVerticals.length > 0 && (
        <div className={styles.section}>
          <div className={styles.verticalHead}>
            <span className={styles.verticalEmoji}>➕</span>
            <div>
              <div className={styles.verticalTitle}>{t('addBusiness')}</div>
              <div className={styles.verticalSub}>{t('addBusinessSub')}</div>
            </div>
          </div>
          <div className={styles.grid}>
            {missingVerticals.map(v => (
              <button key={v.key} className={`${styles.card} ${styles.cardActive}`} onClick={() => addVertical(v.key)}>
                <div className={styles.cardIcon}>{v.emoji}</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{t('add')} {t(v.titleKey)}</div>
                  <div className={styles.cardDesc}>{t(v.descKey)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Sistem ── */}
      {(isOwner() || isSuperAdmin()) && (
        <div className={styles.section}>
          <div className={styles.sysTitle}>{t('sysTitle')}</div>
          <div className={`${styles.grid} ${styles.gridSys}`}>
            <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/admin/staff/roles')}>
              <div className={styles.cardIcon}>🔑</div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{t('navRolesPerms')}</div>
                <div className={styles.cardDesc}>{t('rolesDesc')}</div>
              </div>
            </button>
            {(isOwner() || isSuperAdmin()) && (
              <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/admin/support')}>
                <div className={styles.cardIcon}>💬</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{t('modSupport')} <CardBadge n={unreadSupport} /></div>
                  <div className={styles.cardDesc}>{t('supportDesc')}</div>
                </div>
              </button>
            )}
            {adminMods.map(renderCard)}
            {isSuperAdmin() && (
              <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/superadmin')}>
                <div className={styles.cardIcon}>🔧</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{t('superadminPanel')}</div>
                  <div className={styles.cardDesc}>{t('superadminPanelDesc')}</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
