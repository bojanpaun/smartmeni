import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import s from './StaffPortal.module.css'
import HrView from './views/HrView'
import HousekeepingView from './views/HousekeepingView'
import WaiterView from './views/WaiterView'
import KitchenView from './views/KitchenView'
import ReceptionView from './views/ReceptionView'
import SpaView from './views/SpaView'

// Mapira naziv role na tip portala
function detectPortalType(roleName) {
  const n = (roleName || '').toLowerCase()
  if (/sobaric|housekeep|čišćen|ciscen|domaćin|domacinst/.test(n)) return 'housekeeping'
  if (/konobar|waiter|server|kelner|šank|sank/.test(n)) return 'waiter'
  if (/kuhin|kuvar|cook|kitchen|chef|kuhinjsk/.test(n)) return 'kitchen'
  if (/recepci|front.?desk|portir/.test(n)) return 'reception'
  if (/terapeut|spa|masaž|masaz/.test(n)) return 'spa'
  return 'hr'
}

// Merguje tabove više rola — operativni tabovi prvi, HR uvijek na kraju
const HR_TABS = ['schedule', 'attendance', 'payroll', 'absences']
function mergePortalTabs(roleNames) {
  const types = [...new Set(roleNames.map(detectPortalType))]
  const seen = new Set()
  const tabs = []
  // Operativni tabovi (non-HR)
  for (const type of types) {
    for (const tab of (PORTAL_TABS[type] || [])) {
      if (!seen.has(tab.key) && !HR_TABS.includes(tab.key)) {
        seen.add(tab.key)
        tabs.push(tab)
      }
    }
  }
  // HR tabovi uvijek na kraju
  for (const tab of PORTAL_TABS.hr) {
    if (!seen.has(tab.key)) {
      seen.add(tab.key)
      tabs.push(tab)
    }
  }
  return tabs
}

const PORTAL_TABS = {
  housekeeping: [
    { key: 'tasks',    label: 'Zadaci',   icon: '🧹' },
    { key: 'schedule', label: 'Raspored', icon: '📅' },
  ],
  waiter: [
    { key: 'orders',   label: 'Narudžbe', icon: '🍽️' },
    { key: 'requests', label: 'Zahtjevi', icon: '🔔' },
    { key: 'schedule', label: 'Raspored', icon: '📅' },
  ],
  kitchen: [
    { key: 'kitchen',  label: 'Kuhinja',  icon: '🍳' },
    { key: 'schedule', label: 'Raspored', icon: '📅' },
  ],
  reception: [
    { key: 'checkin',  label: 'Check-in',  icon: '↓' },
    { key: 'checkout', label: 'Check-out', icon: '↑' },
    { key: 'rooms',    label: 'Sobe',      icon: '🛏️' },
    { key: 'schedule', label: 'Raspored',  icon: '📅' },
  ],
  spa: [
    { key: 'appointments', label: 'Termini', icon: '💆' },
    { key: 'schedule',     label: 'Raspored', icon: '📅' },
  ],
  hr: [
    { key: 'schedule',   label: 'Raspored', icon: '📅' },
    { key: 'attendance', label: 'Dolasci',  icon: '🕐' },
    { key: 'payroll',    label: 'Zarada',   icon: '💰' },
    { key: 'absences',   label: 'Odsustva', icon: '🏖️' },
  ],
}

export default function StaffPortal() {
  const { slug } = useParams()

  const [restaurant, setRestaurant] = useState(null)
  const [loadingRest, setLoadingRest] = useState(true)

  // Auth
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Staff
  const [staff, setStaff]           = useState(null)
  const [portalType, setPortalType] = useState('hr')
  const [activeTab, setActiveTab]   = useState(null)
  const [mergedTabs, setMergedTabs] = useState(PORTAL_TABS.hr)

  useEffect(() => {
    supabase.from('restaurants')
      .select('id, name, slug, logo_url, color, template')
      .ilike('slug', slug)
      .maybeSingle()
      .then(({ data }) => { setRestaurant(data); setLoadingRest(false) })
  }, [slug])

  // Check existing session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && restaurant) loadStaff(session.user.id)
    })
  }, [restaurant])

  const loadStaff = async (userId) => {
    if (!restaurant) return
    const { data: staffData } = await supabase.from('staff')
      .select('*, role:roles(name)')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!staffData) {
      setAuthError('Niste pronađeni kao osoblje ovog objekta.')
      return
    }

    // Učitaj SVE role iz staff_roles junction tabele
    const { data: allRolesData } = await supabase
      .from('staff_roles')
      .select('role:roles(name)')
      .eq('staff_id', staffData.id)

    const roleNames = [
      ...(allRolesData?.map(r => r.role?.name).filter(Boolean) || []),
      staffData.role?.name, // primarna rola kao fallback
    ].filter(Boolean)

    const tabs = mergePortalTabs(roleNames.length > 0 ? roleNames : ['hr'])
    setStaff(staffData)
    setPortalType(detectPortalType(roleNames[0] || ''))
    setActiveTab(tabs[0].key)
    setMergedTabs(tabs)
    setMode('portal')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      setAuthError('Pogrešan email ili lozinka.')
      setAuthLoading(false)
      return
    }
    await loadStaff(data.user.id)
    setAuthLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setStaff(null)
    setMode('login')
    setEmail('')
    setPassword('')
    setAuthError('')
  }

  if (loadingRest) return <div className={s.loadWrap}><div className={s.spinner} /></div>
  if (!restaurant) return <div className={s.loadWrap}><p className={s.notFound}>Objekat nije pronađen.</p></div>

  const brand = restaurant.color || '#0d7a52'

  // ── Login ─────────────────────────────────────────────────────────
  if (mode === 'login') return (
    <div className={s.loginPage}>
      <div className={s.loginCard}>
        <div className={s.loginHeader} style={{ background: brand }}>
          {restaurant.logo_url
            ? <img src={restaurant.logo_url} alt={restaurant.name} className={s.loginLogo} />
            : <div className={s.loginLogoPlaceholder}>{restaurant.name[0]}</div>
          }
          <div className={s.loginRestName}>{restaurant.name}</div>
          <div className={s.loginSubtitle}>Portal za osoblje</div>
        </div>
        <form onSubmit={handleLogin} className={s.loginForm}>
          <div className={s.loginField}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="vas@email.com" required autoComplete="email" />
          </div>
          <div className={s.loginField}>
            <label>Lozinka</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {authError && <div className={s.loginError}>{authError}</div>}
          <button type="submit" className={s.loginBtn} style={{ background: brand }} disabled={authLoading}>
            {authLoading ? 'Prijava...' : 'Prijavi se →'}
          </button>
        </form>
      </div>
    </div>
  )

  // ── Portal ────────────────────────────────────────────────────────
  const tabs = mergedTabs
  const staffName = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ') || staff?.email || ''

  const renderView = () => {
    // HR tabs (shared across all roles)
    if (['schedule', 'attendance', 'payroll', 'absences'].includes(activeTab)) {
      return <HrView staffId={staff.id} activeTab={activeTab} />
    }
    if (activeTab === 'tasks') return <HousekeepingView staffId={staff.id} restaurantId={restaurant.id} />
    if (activeTab === 'orders' || activeTab === 'requests') return <WaiterView restaurantId={restaurant.id} activeTab={activeTab} />
    if (activeTab === 'kitchen') return <KitchenView restaurantId={restaurant.id} />
    if (['checkin', 'checkout', 'rooms'].includes(activeTab)) return <ReceptionView restaurantId={restaurant.id} activeTab={activeTab} />
    if (activeTab === 'appointments') return <SpaView staffId={staff.id} restaurantId={restaurant.id} />
    return null
  }

  return (
    <div className={s.portalPage}>
      {/* Header */}
      <div className={s.portalHeader} style={{ background: brand }}>
        <div className={s.portalAvatar}>
          {staffName ? staffName[0].toUpperCase() : '?'}
        </div>
        <div className={s.portalHeaderInfo}>
          <div className={s.portalName}>{staffName}</div>
          <div className={s.portalRoleLabel}>{staff?.role?.name || 'Osoblje'} · {restaurant.name}</div>
        </div>
        <button className={s.portalLogout} onClick={handleLogout}>Odjava</button>
      </div>

      {/* Content */}
      <div className={s.content}>
        {renderView()}
        <div className={s.portalFooter}>Powered by <strong>RestByMe</strong></div>
      </div>

      {/* Bottom navigation */}
      <nav className={s.bottomNav}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`${s.bottomNavItem} ${activeTab === tab.key ? s.active : ''}`}
            onClick={() => setActiveTab(tab.key)}
            style={activeTab === tab.key ? { color: brand } : {}}
          >
            <span className={s.bottomNavIcon}>{tab.icon}</span>
            <span className={s.bottomNavLabel}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
