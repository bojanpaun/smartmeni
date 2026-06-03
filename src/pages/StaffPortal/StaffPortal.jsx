import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import useKitchenCounts from '../../hooks/useKitchenCounts'
import s from './StaffPortal.module.css'
import HomeView from './views/HomeView'
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

const HOME_TAB = { key: 'home', label: 'Početna', icon: '🏠' }

// Merguje tabove više rola — home uvijek prvi, HR uvijek na kraju
const HR_TABS = ['schedule', 'attendance', 'payroll', 'absences']
function mergePortalTabs(roleNames) {
  const types = [...new Set(roleNames.map(detectPortalType))]
  const seen = new Set()
  const tabs = [HOME_TAB]
  seen.add('home')
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
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError]   = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // Forgot password
  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotSent, setForgotSent]     = useState(false)
  const [forgotError, setForgotError]   = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  // Reset password
  const [newPassword, setNewPassword]     = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [resetError, setResetError]       = useState('')
  const [resetLoading, setResetLoading]   = useState(false)
  const [resetDone, setResetDone]         = useState(false)

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

  // Check existing session + PASSWORD_RECOVERY event
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && restaurant) loadStaff(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })
    return () => subscription.unsubscribe()
  }, [restaurant])

  // Hook mora biti PRIJE svih early returns — Rules of Hooks
  const needsCounts = mergedTabs.some(t => ['orders', 'requests', 'kitchen', 'tasks'].includes(t.key))
  const counts = useKitchenCounts(needsCounts ? restaurant?.id : null)

  const loadStaff = async (userId) => {
    if (!restaurant) return

    // Primarno: traži po user_id
    let { data: staffData } = await supabase.from('staff')
      .select('*, role:roles!role_id(name)')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .maybeSingle()

    // Fallback: traži po emailu (za pozvanog zaposlenika koji još nema user_id vezan)
    if (!staffData) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const { data: byEmail } = await supabase.from('staff')
          .select('*, role:roles!role_id(name)')
          .eq('email', user.email.toLowerCase())
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true)
          .maybeSingle()
        if (byEmail) {
          // Automatski veži user_id
          await supabase.from('staff').update({ user_id: userId }).eq('id', byEmail.id)
          staffData = { ...byEmail, user_id: userId }
        }
      }
    }

    if (!staffData) {
      setAuthError('Niste pronađeni kao osoblje ovog objekta.')
      return
    }

    // Učitaj SVE role iz staff_roles junction tabele
    const { data: allRolesData } = await supabase
      .from('staff_roles')
      .select('role:roles!role_id(name)')
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

  const handleForgot = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotLoading(true)
    const redirectTo = `${window.location.origin}/${slug}/staff`
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), { redirectTo })
    setForgotLoading(false)
    if (error) { setForgotError(error.message); return }
    setForgotSent(true)
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setResetError('')
    if (newPassword !== newPasswordConfirm) { setResetError('Lozinke se ne poklapaju.'); return }
    if (newPassword.length < 6) { setResetError('Lozinka mora imati najmanje 6 karaktera.'); return }
    setResetLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setResetLoading(false)
    if (error) { setResetError(error.message); return }
    setResetDone(true)
    // Nakon 2s učitaj portal normalno
    setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) loadStaff(session.user.id)
    }, 2000)
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
          <button type="button" className={s.loginForgotBtn} onClick={() => { setAuthError(''); setMode('forgot') }}>
            Zaboravio/la sam lozinku
          </button>
        </form>
      </div>
    </div>
  )

  // ── Zaboravljena lozinka ──────────────────────────────────────────
  if (mode === 'forgot') return (
    <div className={s.loginPage}>
      <div className={s.loginCard}>
        <div className={s.loginHeader} style={{ background: brand }}>
          {restaurant.logo_url
            ? <img src={restaurant.logo_url} alt={restaurant.name} className={s.loginLogo} />
            : <div className={s.loginLogoPlaceholder}>{restaurant.name[0]}</div>
          }
          <div className={s.loginRestName}>{restaurant.name}</div>
          <div className={s.loginSubtitle}>Resetuj lozinku</div>
        </div>
        {forgotSent ? (
          <div className={s.loginForm}>
            <div className={s.loginSuccess}>
              ✓ Email je poslan! Provjeri inbox i klikni na link za resetovanje lozinke.
            </div>
            <button type="button" className={s.loginForgotBtn} onClick={() => { setForgotSent(false); setMode('login') }}>
              ← Nazad na prijavu
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgot} className={s.loginForm}>
            <p className={s.loginHint}>Unesi svoj email — poslaćemo ti link za resetovanje lozinke.</p>
            <div className={s.loginField}>
              <label>Email</label>
              <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                placeholder="vas@email.com" required autoComplete="email" />
            </div>
            {forgotError && <div className={s.loginError}>{forgotError}</div>}
            <button type="submit" className={s.loginBtn} style={{ background: brand }} disabled={forgotLoading}>
              {forgotLoading ? 'Slanje...' : 'Pošalji link →'}
            </button>
            <button type="button" className={s.loginForgotBtn} onClick={() => setMode('login')}>
              ← Nazad na prijavu
            </button>
          </form>
        )}
      </div>
    </div>
  )

  // ── Nova lozinka (recovery) ───────────────────────────────────────
  if (mode === 'reset') return (
    <div className={s.loginPage}>
      <div className={s.loginCard}>
        <div className={s.loginHeader} style={{ background: brand }}>
          {restaurant.logo_url
            ? <img src={restaurant.logo_url} alt={restaurant.name} className={s.loginLogo} />
            : <div className={s.loginLogoPlaceholder}>{restaurant.name[0]}</div>
          }
          <div className={s.loginRestName}>{restaurant.name}</div>
          <div className={s.loginSubtitle}>Nova lozinka</div>
        </div>
        {resetDone ? (
          <div className={s.loginForm}>
            <div className={s.loginSuccess}>✓ Lozinka je uspješno promijenjena! Prijavljivanje...</div>
          </div>
        ) : (
          <form onSubmit={handleReset} className={s.loginForm}>
            <div className={s.loginField}>
              <label>Nova lozinka</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="najmanje 6 karaktera" required minLength={6} autoComplete="new-password" />
            </div>
            <div className={s.loginField}>
              <label>Potvrdi lozinku</label>
              <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)}
                placeholder="ponovi lozinku" required autoComplete="new-password" />
            </div>
            {resetError && <div className={s.loginError}>{resetError}</div>}
            <button type="submit" className={s.loginBtn} style={{ background: brand }} disabled={resetLoading}>
              {resetLoading ? 'Čuvanje...' : 'Postavi lozinku →'}
            </button>
          </form>
        )}
      </div>
    </div>
  )

  // ── Portal ────────────────────────────────────────────────────────
  const tabs = mergedTabs
  const staffName = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ') || staff?.email || ''

  const TAB_BADGES = {
    orders:   counts.waiter,
    requests: counts.waiterReq,
    kitchen:  counts.kitchen,
    tasks:    counts.housekeeping,
  }

  const renderView = () => {
    if (activeTab === 'home') return <HomeView staffId={staff.id} restaurantId={restaurant.id} staffInfo={staff} brand={brand} />
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

      {/* Pill navigacija */}
      <nav className={s.pillNav}>
        {tabs.map(tab => {
          const badge = TAB_BADGES[tab.key] || 0
          return (
            <button
              key={tab.key}
              className={`${s.pillTab} ${activeTab === tab.key ? s.pillTabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
              style={activeTab === tab.key ? { background: brand, borderColor: brand } : {}}
            >
              <span className={s.pillTabIcon}>{tab.icon}</span>
              <span>{tab.label}</span>
              {badge > 0 && <span className={s.navBadge}>{badge}</span>}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div className={s.content}>
        {renderView()}
        <div className={s.portalFooter}>Powered by <strong>RestByMe</strong></div>
      </div>
    </div>
  )
}
