import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import { MODULES } from '../../layouts/AdminLayout'
import OnboardingWizard from './OnboardingWizard'
import styles from './ControlPanel.module.css'

const RESTAURANT_KEYS  = ['menu', 'tables']
const HOTEL_KEYS       = ['hotel', 'spa']
const UPRAVLJANJE_KEYS = ['hr', 'inventory', 'guests', 'analytics']

function useDashboardData(restaurant, hasHotel, hasSpa) {
  const [kpi, setKpi]       = useState({ ordersToday: null, revenueToday: null, checkinsToday: null, spaToday: null, occupancy: null, freeRooms: null })
  const [badges, setBadges] = useState({ waiter: 0, kitchen: 0, bar: 0, waiterReq: 0 })

  useEffect(() => {
    if (!restaurant?.id) return
    const rid  = restaurant.id
    const today = new Date().toISOString().split('T')[0]

    async function load() {
      const base = [
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).gte('created_at', `${today}T00:00:00.000Z`),
        supabase.from('orders').select('total')
          .eq('restaurant_id', rid).gte('created_at', `${today}T00:00:00.000Z`)
          .not('status', 'in', '(cancelled,closed)'),
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).in('status', ['pending', 'received', 'ready']),
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).eq('kitchen_status', 'preparing')
          .not('status', 'in', '("served","closed")'),
        supabase.from('orders').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).eq('bar_status', 'preparing')
          .not('status', 'in', '("served","closed")'),
        supabase.from('waiter_requests').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).eq('is_resolved', false),
      ]
      if (hasHotel) base.push(
        supabase.from('hotel_reservations').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).eq('check_in_date', today).in('status', ['confirmed', 'checked_in']),
        supabase.from('hotel_reservations').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).eq('status', 'checked_in'),
        supabase.from('rooms').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid),
        supabase.from('rooms').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).eq('status', 'available'),
      )
      if (hasSpa) base.push(
        supabase.from('spa_appointments').select('id', { count: 'exact', head: true })
          .eq('restaurant_id', rid).eq('appointment_date', today)
          .not('status', 'in', '("cancelled","no_show")')
      )

      const [ordersR, revenueR, waiterR, kitchenR, barR, waiterReqR, ...rest] = await Promise.all(base)

      let hotelIdx = 0
      const checkinsToday = hasHotel ? (rest[hotelIdx++]?.count ?? 0) : null
      const checkedInNow  = hasHotel ? (rest[hotelIdx++]?.count ?? 0) : null
      const totalRooms    = hasHotel ? (rest[hotelIdx++]?.count ?? 0) : null
      const freeRooms     = hasHotel ? (rest[hotelIdx++]?.count ?? 0) : null
      const spaToday      = hasSpa   ? (rest[hotelIdx]?.count  ?? 0) : null

      const occupancy = (hasHotel && totalRooms > 0)
        ? Math.round((checkedInNow / totalRooms) * 100)
        : null

      setKpi({
        ordersToday:   ordersR.count ?? 0,
        revenueToday:  (revenueR.data || []).reduce((s, o) => s + (Number(o.total) || 0), 0),
        checkinsToday,
        spaToday,
        occupancy,
        freeRooms,
      })
      setBadges({
        waiter:    waiterR.count    || 0,
        kitchen:   kitchenR.count   || 0,
        bar:       barR.count       || 0,
        waiterReq: waiterReqR.count || 0,
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
  const { restaurant, hasPermission, isOwner, isSuperAdmin, hasAddon } = usePlatform()
  const navigate = useNavigate()
  const [showOnboarding, setShowOnboarding] = useState(
    restaurant && !restaurant.onboarding_completed
  )

  const hasHotel = hasAddon('hotel_core')
  const hasSpa   = hasAddon('spa_wellness')
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

  const restaurantMods  = MODULES.filter(m => RESTAURANT_KEYS.includes(m.key)  && canSee(m.perm))
  const hotelMods       = MODULES.filter(m => HOTEL_KEYS.includes(m.key))
  const upravljanjeMods = MODULES.filter(m => UPRAVLJANJE_KEYS.includes(m.key) && canSee(m.perm))
  const adminMods       = MODULES.filter(m => m.adminOnly)

  const QUICK = [
    { label: 'Narudžbe', icon: '🧾', path: '/admin/orders',  badge: badges.waiter,    perm: 'view_orders' },
    { label: 'Kuhinja',  icon: '🧑‍🍳', path: '/admin/kitchen', badge: badges.kitchen,   perm: 'view_orders' },
    { label: 'Bar',      icon: '🍷', path: '/admin/bar',     badge: badges.bar,       perm: 'view_orders' },
    { label: 'Zahtjevi', icon: '🔔', path: '/admin/waiter',  badge: badges.waiterReq, perm: 'view_waiter_req' },
    ...(hasHotel ? [{ label: 'Front Desk', icon: '🛎️', path: '/admin/hotel/frontdesk', badge: kpi.checkinsToday || 0 }] : []),
    ...(hasSpa   ? [{ label: 'Spa danas',  icon: '💆', path: '/admin/spa/appointments', badge: kpi.spaToday || 0 }] : []),
  ]

  const renderCard = (mod) => {
    const accessible = canSee(mod.perm)
    const active     = addonOn(mod)
    return (
      <button
        key={mod.key}
        className={`${styles.card} ${mod.active ? styles.cardActive : styles.cardSoon} ${!accessible ? styles.cardLocked : ''} ${!active ? styles.cardAddon : ''}`}
        onClick={() => handleMod(mod)}
        disabled={!mod.active || !accessible}
      >
        <div className={styles.cardIcon}>{mod.icon}</div>
        <div className={styles.cardBody}>
          <div className={styles.cardName}>{mod.label}</div>
          <div className={styles.cardDesc}>{mod.desc}</div>
        </div>
        <div className={styles.cardStatus}>
          {!accessible ? <span className={`${styles.badge} ${styles.badgeLocked}`}>Nema pristup</span>
            : !active  ? <span className={`${styles.badge} ${styles.badgeAddon}`}>Addon →</span>
            : mod.active ? <span className={`${styles.badge} ${styles.badgeActive}`}>Aktivan</span>
            : <span className={`${styles.badge} ${styles.badgeSoon}`}>Uskoro</span>}
        </div>
      </button>
    )
  }

  return (
    <div className={styles.page}>
      {showOnboarding && (
        <OnboardingWizard onComplete={() => setShowOnboarding(false)} onSkip={() => setShowOnboarding(false)} />
      )}

      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>{restaurant ? restaurant.name : 'Kontrolna tabla'}</h1>
        <p className={styles.subtitle}>Pregled i brzi pristup svim modulima</p>
      </div>

      {/* ── KPI row ── */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>🧾</div>
          <div>
            <div className={styles.kpiValue}>{kpi.ordersToday ?? '—'}</div>
            <div className={styles.kpiLabel}>Narudžbe danas</div>
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIcon}>💰</div>
          <div>
            <div className={styles.kpiValue}>{fmtRevenue(kpi.revenueToday)}</div>
            <div className={styles.kpiLabel}>Prihod danas</div>
          </div>
        </div>
        {hasHotel && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>🏨</div>
            <div>
              <div className={styles.kpiValue}>{kpi.checkinsToday ?? '—'}</div>
              <div className={styles.kpiLabel}>Check-in danas</div>
            </div>
          </div>
        )}
        {hasHotel && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>📊</div>
            <div>
              <div className={styles.kpiValue}>{kpi.occupancy !== null ? `${kpi.occupancy}%` : '—'}</div>
              <div className={styles.kpiLabel}>Popunjenost</div>
            </div>
          </div>
        )}
        {hasHotel && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>🛏️</div>
            <div>
              <div className={styles.kpiValue}>{kpi.freeRooms ?? '—'}</div>
              <div className={styles.kpiLabel}>Slobodne sobe</div>
            </div>
          </div>
        )}
        {hasSpa && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiIcon}>💆</div>
            <div>
              <div className={styles.kpiValue}>{kpi.spaToday ?? '—'}</div>
              <div className={styles.kpiLabel}>Spa termini danas</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Quick actions ── */}
      <div className={styles.quickRow}>
        {QUICK.filter(a => canSee(a.perm)).map(a => (
          <button key={a.path} className={styles.quickBtn} onClick={() => navigate(a.path)}>
            <span className={styles.quickIcon}>{a.icon}</span>
            <span className={styles.quickLabel}>{a.label}</span>
            {a.badge > 0 && <span className={styles.quickBadge}>{a.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Restoran vertical ── */}
      <div className={styles.section}>
        <div className={styles.verticalHead}>
          <span className={styles.verticalEmoji}>🍽️</span>
          <div>
            <div className={styles.verticalTitle}>Restoran</div>
            <div className={styles.verticalSub}>Digitalni meni i stolovi</div>
          </div>
        </div>
        <div className={styles.grid}>{restaurantMods.map(renderCard)}</div>
      </div>

      {/* ── Hotel vertical ── */}
      {hasHotel && (
        <div className={styles.section}>
          <div className={styles.verticalHead}>
            <span className={styles.verticalEmoji}>🏨</span>
            <div>
              <div className={styles.verticalTitle}>Hotel</div>
              <div className={styles.verticalSub}>Sobe, rezervacije i spa</div>
            </div>
          </div>
          <div className={styles.grid}>{hotelMods.map(renderCard)}</div>
        </div>
      )}

      {/* ── Upravljanje (dijeljeni moduli) ── */}
      {upravljanjeMods.length > 0 && (
        <div className={styles.section}>
          <div className={styles.verticalHead}>
            <span className={styles.verticalEmoji}>📋</span>
            <div>
              <div className={styles.verticalTitle}>Upravljanje</div>
              <div className={styles.verticalSub}>HR, zalihe, gosti i analitika — zajednički za restoran i hotel</div>
            </div>
          </div>
          <div className={styles.grid}>{upravljanjeMods.map(renderCard)}</div>
        </div>
      )}

      {/* ── Sistem ── */}
      {(isOwner() || isSuperAdmin()) && (
        <div className={styles.section}>
          <div className={styles.sysTitle}>Sistem</div>
          <div className={`${styles.grid} ${styles.gridSys}`}>
            <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/admin/staff/roles')}>
              <div className={styles.cardIcon}>🔑</div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>Role i permisije</div>
                <div className={styles.cardDesc}>Upravljanje rolama i pristupima osoblja</div>
              </div>
            </button>
            {adminMods.map(renderCard)}
            {isSuperAdmin() && (
              <button className={`${styles.card} ${styles.cardSys} ${styles.cardActive}`} onClick={() => navigate('/superadmin')}>
                <div className={styles.cardIcon}>🔧</div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>Super admin panel</div>
                  <div className={styles.cardDesc}>Upravljanje restoranima, planovima i temama</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
