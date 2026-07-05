import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import { MODULES } from '../../layouts/AdminLayout'
import OnboardingWizard from './OnboardingWizard'
import HotelOnboardingWizard from './HotelOnboardingWizard'
import TaskBar from './TaskBar'
import OnboardingChecklist, { selectAvailableSteps } from './OnboardingChecklist'
import { useChecklistSteps } from './useChecklistSteps'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import { useSupport } from '../../context/SupportContext'
import RoadmapTicker from '../../components/shared/RoadmapTicker'
import ActiveLayoutBanner from '../../components/shared/ActiveLayoutBanner'
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
const RENTAL_KEYS      = ['rental']
const UPRAVLJANJE_KEYS = ['hr', 'inventory', 'guests', 'analytics']

// Katalog KPI-eva koje admin može izabrati na dashboard. `field` = polje iz
// get_admin_overview (default = key). `vertical`/`addon` = uslov dostupnosti.
// fmt: int | money | pct. avg_order/occupancy se računaju iz drugih polja.
const KPI_CATALOG = [
  { key: 'orders_today',       group: 'menu',      icon: '🧾', labelKey: 'kpiOrdersToday',      fmt: 'int',   vertical: 'restaurant' },
  { key: 'revenue_today',      group: 'menu',      icon: '💰', labelKey: 'kpiRevenueToday',     fmt: 'money', vertical: 'restaurant' },
  { key: 'avg_order',          group: 'menu',      icon: '🧮', labelKey: 'kpiAvgOrder',         fmt: 'money', vertical: 'restaurant' },
  { key: 'pending_orders',     group: 'menu',      icon: '⏳', labelKey: 'kpiPendingOrders',    fmt: 'int',   vertical: 'restaurant', field: 'waiter' },
  { key: 'revenue_week',       group: 'menu',      icon: '📈', labelKey: 'kpiRevenueWeek',      fmt: 'money', vertical: 'restaurant' },
  { key: 'reservations_today', group: 'tables',    icon: '📅', labelKey: 'kpiReservationsToday', fmt: 'int',  vertical: 'restaurant' },
  { key: 'waiter_req',         group: 'tables',    icon: '🔔', labelKey: 'kpiWaiterReq',        fmt: 'int',   vertical: 'restaurant' },
  { key: 'new_guests_today',   group: 'guests',    icon: '🆕', labelKey: 'kpiNewGuests',        fmt: 'int' },
  { key: 'total_guests',       group: 'guests',    icon: '👥', labelKey: 'kpiTotalGuests',      fmt: 'int' },
  { key: 'low_stock',          group: 'inventory', icon: '⚠️', labelKey: 'kpiLowStock',         fmt: 'int' },
  { key: 'checkins_today',     group: 'hotel',     icon: '🏨', labelKey: 'kpiCheckinsToday',    fmt: 'int',   vertical: 'hotel' },
  { key: 'checkouts_today',    group: 'hotel',     icon: '🧳', labelKey: 'kpiCheckoutsToday',   fmt: 'int',   vertical: 'hotel', field: 'hotel_departures' },
  { key: 'occupancy',          group: 'hotel',     icon: '📊', labelKey: 'kpiOccupancy',        fmt: 'pct',   vertical: 'hotel' },
  { key: 'free_rooms',         group: 'hotel',     icon: '🛏️', labelKey: 'kpiFreeRooms',        fmt: 'int',   vertical: 'hotel' },
  { key: 'checked_in_now',     group: 'hotel',     icon: '🟢', labelKey: 'kpiInHouse',          fmt: 'int',   vertical: 'hotel' },
  { key: 'hotel_inquiry',      group: 'hotel',     icon: '✉️', labelKey: 'kpiInquiries',        fmt: 'int',   vertical: 'hotel' },
  { key: 'housekeeping',       group: 'hotel',     icon: '🧹', labelKey: 'kpiHousekeeping',     fmt: 'int',   vertical: 'hotel' },
  { key: 'maint_open',         group: 'hotel',     icon: '🔧', labelKey: 'kpiMaintOpen',        fmt: 'int',   vertical: 'hotel' },
  { key: 'spa_today',          group: 'spa',       icon: '💆', labelKey: 'kpiSpaToday',         fmt: 'int',   vertical: 'hotel', addon: 'spa_wellness' },
]
// Podrazumijevani set (kad korisnik nije prilagodio) — čuva dosadašnje ponašanje;
// nedostupni (po vertikali/addonu) se filtriraju pri renderu.
const DEFAULT_KPIS = ['orders_today', 'revenue_today', 'checkins_today', 'occupancy', 'free_rooms', 'spa_today']

function kpiVal(kpi, d) {
  if (kpi.key === 'avg_order') {
    const o = d.orders_today || 0
    return o > 0 ? (Number(d.revenue_today) || 0) / o : 0
  }
  if (kpi.key === 'occupancy') {
    return d.total_rooms > 0 ? Math.round((d.checked_in_now / d.total_rooms) * 100) : null
  }
  return d[kpi.field || kpi.key]
}

function useDashboardData(restaurant) {
  const [data, setData] = useState({})

  useEffect(() => {
    if (!restaurant?.id) return
    const rid  = restaurant.id

    // Sve KPI brojke u jednom RPC pozivu (ranije ~11 zasebnih count-upita).
    async function load() {
      const { data: d } = await supabase.rpc('get_admin_overview', { p_restaurant_id: rid })
      if (!d) return
      setData(d)
    }

    load()
    const ch = supabase.channel(`cp-${rid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${rid}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurant?.id])

  return { data }
}

// Modal za izbor KPI-eva (per-korisnik). Prima već filtriran (dostupan) katalog.
function KpiPicker({ catalog, selected, onSave, onClose, t }) {
  const [draft, setDraft] = useState(() => new Set(selected))
  const toggle = (key) => setDraft(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
  })
  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', zIndex: 1000, overflowY: 'auto' }
  const modal = { background: 'var(--c-surface)', borderRadius: 14, width: '100%', maxWidth: 460, padding: 20, boxShadow: 'var(--c-shadow-modal)' }
  const row = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer' }
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>⚙️ {t('cpKpiTitle')}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--c-text-muted)' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 14 }}>{t('cpKpiHint')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '52vh', overflowY: 'auto' }}>
          {catalog.map(k => {
            const on = draft.has(k.key)
            return (
              <label key={k.key} style={{ ...row, background: on ? 'var(--c-primary-light)' : 'transparent' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(k.key)} style={{ accentColor: 'var(--c-primary)', width: 16, height: 16 }} />
                <span style={{ fontSize: 16 }}>{k.icon}</span>
                <span style={{ fontSize: 14, color: 'var(--c-text)' }}>{t(k.labelKey)}</span>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', cursor: 'pointer' }}>{t('cancel')}</button>
          <button onClick={() => onSave(catalog.filter(k => draft.has(k.key)).map(k => k.key))}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--c-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t('save')}</button>
        </div>
      </div>
    </div>
  )
}

export default function ControlPanel() {
  const { t } = useTranslation('admin')
  const { user, restaurant, setRestaurant, hasPermission, isOwner, isSuperAdmin, hasAddon, hasVertical } = usePlatform()
  const { unread: unreadAnn } = useAnnouncements()
  const { openCount: supportOpen, superOpenCount: supportSuperOpen } = useSupport()
  const navigate = useNavigate()
  // Hotel-only tenant (izabrao samo hotel pri registraciji) dobija HOTEL wizard
  // automatski; restoran/oba → restoranski (kao i dosad). Koristi isti
  // onboarding_completed flag (hotel wizard ga markira kad je auto-prikazan).
  const hotelOnly = !!restaurant && hasVertical('hotel') && !hasVertical('restaurant')
  const needsOnboarding = restaurant && !restaurant.onboarding_completed
  const [showOnboarding, setShowOnboarding] = useState(needsOnboarding && !hotelOnly)
  const [showHotelOnboarding, setShowHotelOnboarding] = useState(needsOnboarding && hotelOnly)
  const [hotelAuto, setHotelAuto] = useState(needsOnboarding && hotelOnly) // auto-prikaz → markiraj completed

  const { data } = useDashboardData(restaurant)

  const canSee    = (perm) => !perm || isOwner() || isSuperAdmin() || hasPermission(perm)
  const addonOn   = (mod)  => !mod.addonId || hasAddon(mod.addonId)

  // „Početni koraci" stanje (hook jednom ovdje; prosljeđuje se kartici). Link za vraćanje
  // (uz KPI red) se nudi samo kad je korisnik karticu sakrio a ima dostupnih koraka.
  const checklist = useChecklistSteps(user?.id)
  const checklistAvailable = useMemo(
    () => selectAvailableSteps(checklist.steps, { hasVertical, hasAddon, canSee }),
    [checklist.steps, hasVertical, hasAddon, hasPermission, isOwner, isSuperAdmin],
  )
  const showChecklistRestore = checklist.loaded && (isOwner() || isSuperAdmin())
    && checklist.dismissed && checklistAvailable.length > 0

  // Prilagodljivi KPI-evi (per-korisnik, user_profiles.dashboard_kpis).
  const [profileKpis, setProfileKpis] = useState(null)
  const [showKpiPicker, setShowKpiPicker] = useState(false)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    supabase.from('user_profiles').select('dashboard_kpis').eq('id', user.id).maybeSingle()
      .then(({ data: p }) => { if (!cancelled) setProfileKpis(p?.dashboard_kpis ?? null) })
    return () => { cancelled = true }
  }, [user?.id])

  const kpiAvailable = (k) => (!k.vertical || hasVertical(k.vertical)) && (!k.addon || hasAddon(k.addon))
  const availableKpis = KPI_CATALOG.filter(kpiAvailable)
  const selectedKeys  = profileKpis ?? DEFAULT_KPIS
  const shownKpis     = availableKpis.filter(k => selectedKeys.includes(k.key))
  const saveKpis = async (keys) => {
    setProfileKpis(keys)
    setShowKpiPicker(false)
    if (user?.id) await supabase.from('user_profiles').update({ dashboard_kpis: keys }).eq('id', user.id)
  }

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
  const fmtKpi = (k) => {
    const v = kpiVal(k, data)
    if (v === null || v === undefined) return '—'
    if (k.fmt === 'money') return fmtRevenue(Number(v))
    if (k.fmt === 'pct') return `${v}%`
    return v
  }

  // 2b/Faza: dodavanje biznisa (vertikale) naknadno. Restoran besplatno (odmah);
  // hotel plaćeno (aktivira vertikalu pa vodi na pretplatu).
  const ALL_VERTICALS = [
    { key: 'restaurant', emoji: '🍽️', titleKey: 'liveRestaurant', descKey: 'vertRestaurantDesc' },
    { key: 'hotel',      emoji: '🏨', titleKey: 'modHotel',        descKey: 'vertHotelDesc' },
    { key: 'rental',     emoji: '🏖️', titleKey: 'modRental',       descKey: 'vertRentalDesc' },
  ]
  const missingVerticals = ALL_VERTICALS.filter(v => !hasVertical(v.key))
  const addVertical = async (v) => {
    if (!restaurant) return
    const next = Array.from(new Set([...(restaurant.active_verticals || ['restaurant']), v]))
    const { error } = await supabase.from('restaurants')
      .update({ active_verticals: next }).eq('id', restaurant.id)
    if (error) return
    setRestaurant({ ...restaurant, active_verticals: next })
    if (v === 'hotel' || v === 'rental') navigate('/admin/billing') // plaćeno → pretplata
  }

  const restaurantMods  = MODULES.filter(m => RESTAURANT_KEYS.includes(m.key)  && canSee(m.perm))
  const hotelMods       = MODULES.filter(m => HOTEL_KEYS.includes(m.key))
  const rentalMods      = MODULES.filter(m => RENTAL_KEYS.includes(m.key))
  const upravljanjeMods = MODULES.filter(m => UPRAVLJANJE_KEYS.includes(m.key) && canSee(m.perm))
  const adminMods       = MODULES.filter(m => m.adminOnly)

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

      {/* §8.5 — upozorenje ako aktivan raspored stolova nije standardni */}
      <ActiveLayoutBanner />

      {/* ── Roadmap ticker (Šta razvijamo) — diskretno, bez dismiss-a ── */}
      <RoadmapTicker />

      {/* ── Task traka („Šta želite da uradite?") — cilj-orijentisane prečice
              (dashboard_tasks; superadmin kurira na /superadmin/dashboard) ── */}
      <TaskBar />

      {/* ── Početni koraci (onboarding checklist; čestitka kad su svi done, ručno sakriva) ── */}
      <div data-tour="checklist">
      <OnboardingChecklist
        data={data}
        steps={checklist.steps}
        manualDone={checklist.manualDone}
        markDone={checklist.markDone}
        dismissed={checklist.dismissed}
        setDismissed={checklist.setDismissed}
        loaded={checklist.loaded}
      />
      </div>

      {/* ── KPI row (prilagodljiv, per-korisnik) ── */}
      <div className={styles.kpiHead}>
        <button className={styles.kpiCustomizeBtn} onClick={() => setShowKpiPicker(true)}>
          ⚙️ {t('cpCustomize')}
        </button>
        {showChecklistRestore && (
          <button className={styles.checklistRestoreBtn} onClick={() => checklist.setDismissed(false)}>
            🚀 {t('checklistRestore')}
          </button>
        )}
      </div>
      <div className={styles.kpiRow} data-tour="kpis">
        {shownKpis.map(k => (
          <div key={k.key} className={styles.kpiCard}>
            <div className={styles.kpiIcon}>{k.icon}</div>
            <div>
              <div className={styles.kpiValue}>{fmtKpi(k)}</div>
              <div className={styles.kpiLabel}>{t(k.labelKey)}</div>
            </div>
          </div>
        ))}
        {shownKpis.length === 0 && (
          <button className={styles.kpiEmpty} onClick={() => setShowKpiPicker(true)}>+ {t('cpCustomize')}</button>
        )}
      </div>
      {showKpiPicker && (
        <KpiPicker catalog={availableKpis} selected={selectedKeys} onSave={saveKpis} onClose={() => setShowKpiPicker(false)} t={t} />
      )}

      {/* ── Restoran vertical ── */}
      {hasVertical('restaurant') && (
        <div className={styles.section} data-tour="sec-restaurant">
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
        <div className={styles.section} data-tour="sec-hotel">
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

      {/* ── Rental vertical (najam; stranice iza rental_core paywalla) ── */}
      {hasVertical('rental') && (
        <div className={styles.section}>
          <div className={styles.verticalHead}>
            <span className={styles.verticalEmoji}>🏖️</span>
            <div>
              <div className={styles.verticalTitle}>{t('modRental')}</div>
              <div className={styles.verticalSub}>{t('vertRentalSub')}</div>
            </div>
          </div>
          <div className={styles.grid}>{rentalMods.map(renderCard)}</div>
        </div>
      )}

      {/* ── Upravljanje (dijeljeni moduli) ── */}
      {(upravljanjeMods.length > 0 || isOwner() || isSuperAdmin()) && (
        <div className={styles.section} data-tour="sec-manage">
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
            <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/admin/staff/portal')}>
              <div className={styles.cardIcon}>📱</div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{t('cpStaffPortal')}</div>
                <div className={styles.cardDesc}>{t('cpStaffPortalDesc')}</div>
              </div>
            </button>
            <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/admin/settings/hardware')}>
              <div className={styles.cardIcon}>🖨️</div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{t('navHardware')}</div>
                <div className={styles.cardDesc}>{t('hwCardDesc')}</div>
              </div>
            </button>
            {(isOwner() || isSuperAdmin()) && (
              <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/admin/support')}>
                <div className={styles.cardIcon}>💬</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{t('modSupport')} <CardBadge n={supportOpen} /></div>
                  <div className={styles.cardDesc}>{t('supportDesc')}</div>
                </div>
              </button>
            )}
            {adminMods.map(renderCard)}
            {isSuperAdmin() && (
              <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/superadmin')}>
                <div className={styles.cardIcon}>🔧</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{t('superadminPanel')} <CardBadge n={supportSuperOpen} /></div>
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
