import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { hasAddon } from '../../lib/planUtils'
import useKitchenCounts from '../../hooks/useKitchenCounts'
import LanguageSwitcher from '../../i18n/LanguageSwitcher'
import s from './StaffPortal.module.css'
import HomeView from './views/HomeView'
import ProfileView from './views/ProfileView'
import NotificationsView from './views/NotificationsView'
import HrView from './views/HrView'
import HousekeepingView from './views/HousekeepingView'
import WaiterView from './views/WaiterView'
import NaplataView from './views/NaplataView'
import KitchenView from './views/KitchenView'
import BarView from './views/BarView'
import ReceptionView from './views/ReceptionView'
import SpaView from './views/SpaView'
import MaintenanceView from './views/MaintenanceView'

// Mapira naziv role na tip portala
function detectPortalType(roleName) {
  const n = (roleName || '').toLowerCase()
  if (/sobaric|housekeep|čišćen|ciscen|domaćin|domacinst/.test(n)) return 'housekeeping'
  if (/konobar|waiter|server|kelner/.test(n)) return 'waiter'
  if (/kuhin|kuvar|cook|kitchen|chef|kuhinjsk/.test(n)) return 'kitchen'
  if (/šank|sank|barman|bartender|barista/.test(n)) return 'bar'
  if (/recepci|front.?desk|portir/.test(n)) return 'reception'
  if (/terapeut|spa|masaž|masaz/.test(n)) return 'spa'
  return 'hr'
}

const HOME_TAB    = { key: 'home',    labelKey: 'tabHome', icon: '🏠' }
const NOTIF_TAB   = { key: 'notifications', labelKey: 'tabNotifications', icon: '📢' }
const PROFILE_TAB = { key: 'profile', labelKey: 'tabProfile',   icon: '👤' }

// Merguje tabove više rola — home uvijek prvi, profile uvijek posljednji
const HR_TABS = ['schedule', 'attendance', 'payroll', 'absences']
function mergePortalTabs(roleNames) {
  const types = [...new Set(roleNames.map(detectPortalType))]
  const seen = new Set()
  const tabs = [HOME_TAB]
  seen.add('home')
  for (const type of types) {
    for (const tab of (PORTAL_TABS[type] || [])) {
      if (!seen.has(tab.key) && !HR_TABS.includes(tab.key)) {
        seen.add(tab.key)
        tabs.push(tab)
      }
    }
  }
  for (const tab of PORTAL_TABS.hr) {
    if (!seen.has(tab.key)) { seen.add(tab.key); tabs.push(tab) }
  }
  tabs.push(NOTIF_TAB)
  tabs.push(PROFILE_TAB)
  return tabs
}

// Mapiranje permisije → operativni tabovi koje ta permisija otvara
const PERM_TO_TABS = [
  { perm: 'view_orders',        tabs: [
      { key: 'orders',       labelKey: 'tabOrders',  icon: '🍽️' },
      { key: 'requests',     labelKey: 'tabRequests',  icon: '🔔' },
      { key: 'naplata',      labelKey: 'tabNaplata', icon: '💶' },
  ]},
  { perm: 'view_kitchen_orders', tabs: [{ key: 'kitchen',      labelKey: 'tabKitchen',  icon: '🍳' }] },
  { perm: 'view_bar_orders',     tabs: [{ key: 'bar_orders',   labelKey: 'tabBar',      icon: '🍷' }] },
  { perm: 'view_housekeeping',   tabs: [
      { key: 'tasks',       labelKey: 'tabTasks',     icon: '🧹' },
      { key: 'maintenance', labelKey: 'tabMaintenance', icon: '🔧' },
  ]},
  { perm: 'checkin_checkout',    tabs: [
      { key: 'checkin',      labelKey: 'tabCheckin',  icon: '↓' },
      { key: 'checkout',     labelKey: 'tabCheckout', icon: '↑' },
      { key: 'rooms',        labelKey: 'tabRooms',      icon: '🛏️' },
  ]},
  { perm: 'view_appointments',   tabs: [{ key: 'appointments', labelKey: 'tabAppointments',  icon: '💆' }] },
]

// Gradi tabove na osnovu stvarnih permisija — radi za svaku rolu, uključujući menadžere
function tabsFromPermissions(allPermissions) {
  const seen = new Set(['home'])
  const tabs = [HOME_TAB]
  for (const { perm, tabs: permTabs } of PERM_TO_TABS) {
    if (allPermissions.includes(perm)) {
      for (const tab of permTabs) {
        if (!seen.has(tab.key)) { seen.add(tab.key); tabs.push(tab) }
      }
    }
  }
  for (const tab of PORTAL_TABS.hr) {
    if (!seen.has(tab.key)) { seen.add(tab.key); tabs.push(tab) }
  }
  tabs.push(NOTIF_TAB)
  tabs.push(PROFILE_TAB)
  return tabs
}

const PORTAL_TABS = {
  housekeeping: [
    { key: 'tasks',       labelKey: 'tabTasks',     icon: '🧹' },
    { key: 'maintenance', labelKey: 'tabMaintenance', icon: '🔧' },
    { key: 'schedule',    labelKey: 'tabSchedule',   icon: '📅' },
  ],
  waiter: [
    { key: 'orders',   labelKey: 'tabOrders', icon: '🍽️' },
    { key: 'requests', labelKey: 'tabRequests', icon: '🔔' },
    { key: 'naplata',  labelKey: 'tabNaplata', icon: '💶' },
    { key: 'schedule', labelKey: 'tabSchedule', icon: '📅' },
  ],
  kitchen: [
    { key: 'kitchen',    labelKey: 'tabKitchen',  icon: '🍳' },
    { key: 'schedule',   labelKey: 'tabSchedule', icon: '📅' },
  ],
  bar: [
    { key: 'bar_orders', labelKey: 'tabBar',      icon: '🍷' },
    { key: 'schedule',   labelKey: 'tabSchedule', icon: '📅' },
  ],
  reception: [
    { key: 'checkin',  labelKey: 'tabCheckin',  icon: '↓' },
    { key: 'checkout', labelKey: 'tabCheckout', icon: '↑' },
    { key: 'rooms',    labelKey: 'tabRooms',      icon: '🛏️' },
    { key: 'schedule', labelKey: 'tabSchedule',  icon: '📅' },
  ],
  spa: [
    { key: 'appointments', labelKey: 'tabAppointments', icon: '💆' },
    { key: 'schedule',     labelKey: 'tabSchedule', icon: '📅' },
  ],
  hr: [
    { key: 'schedule',   labelKey: 'tabSchedule', icon: '📅' },
    { key: 'attendance', labelKey: 'tabAttendance',  icon: '🕐' },
    { key: 'payroll',    labelKey: 'tabPayroll',   icon: '💰' },
    { key: 'absences',   labelKey: 'tabAbsences', icon: '🏖️' },
  ],
}

export default function StaffPortal() {
  const { slug } = useParams()
  const { t } = useTranslation('staffportal')

  const [restaurant, setRestaurant] = useState(null)
  const [subscription, setSubscription] = useState(null)
  // Beta-free za hotel: StaffPortal ne ide kroz PlatformContext, pa beta provjeru
  // radimo preko DB helpera is_beta_free (isti izvor kao server/Context gating).
  const [hotelBetaFree, setHotelBetaFree] = useState(false)
  const [fiscalBetaFree, setFiscalBetaFree] = useState(false)
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
  const [staff, setStaff]                   = useState(null)
  const [portalType, setPortalType]         = useState('hr')
  const [activeTab, setActiveTab]           = useState(null)
  const [mergedTabs, setMergedTabs]         = useState(PORTAL_TABS.hr)

  useEffect(() => {
    supabase.from('restaurants')
      .select('id, name, slug, logo_url, color, template, rejection_messages, currency')
      .ilike('slug', slug)
      .maybeSingle()
      .then(async ({ data }) => {
        if (data?.id) {
          const [{ data: msgs }, { data: sub }, { data: betaHotel }, { data: betaFiscal }] = await Promise.all([
            supabase.rpc('get_restaurant_rejection_messages', { p_restaurant_id: data.id }),
            supabase.from('subscriptions').select('plan, addons, addon_trials').eq('restaurant_id', data.id).maybeSingle(),
            supabase.rpc('is_beta_free', { p_addon_id: 'hotel_core' }),
            supabase.rpc('is_beta_free', { p_addon_id: 'fiscalization' }),
          ])
          if (Array.isArray(msgs) && msgs.length > 0) data.rejection_messages = msgs
          setSubscription(sub ?? null)
          setHotelBetaFree(!!betaHotel)
          setFiscalBetaFree(!!betaFiscal)
        }
        setRestaurant(data)
        setLoadingRest(false)
      })
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

  // Kanal se kreira tek nakon logina — anon sesija ne može primati realtime evente
  const { counts, refresh: refreshCounts } = useKitchenCounts(mode === 'portal' ? restaurant?.id : null)

  const loadStaff = async (userId) => {
    if (!restaurant) return

    // Primarno: traži po user_id
    let { data: staffData } = await supabase.from('staff')
      .select('*, role:roles!role_id(name, permissions)')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .maybeSingle()

    // Fallback: traži po emailu (za pozvanog zaposlenika koji još nema user_id vezan)
    if (!staffData) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        const { data: byEmail } = await supabase.from('staff')
          .select('*, role:roles!role_id(name, permissions)')
          .eq('email', user.email.toLowerCase())
          .eq('restaurant_id', restaurant.id)
          .eq('is_active', true)
          .maybeSingle()
        if (byEmail) {
          await supabase.from('staff').update({ user_id: userId }).eq('id', byEmail.id)
          staffData = { ...byEmail, user_id: userId }
        }
      }
    }

    if (!staffData) {
      setAuthError(t('errNotStaff'))
      return
    }

    // Učitaj SVE role iz staff_roles junction tabele (sa permisijama)
    const { data: allRolesData } = await supabase
      .from('staff_roles')
      .select('role:roles!role_id(name, permissions)')
      .eq('staff_id', staffData.id)

    const roleNames = [
      ...(allRolesData?.map(r => r.role?.name).filter(Boolean) || []),
      staffData.role?.name,
    ].filter(Boolean)

    // Spoji sve permisije iz svih rola
    const allPermissions = [...new Set([
      ...(allRolesData?.flatMap(r => r.role?.permissions || []) || []),
      ...(staffData.role?.permissions || []),
    ])]

    // Tabs: permission-based (ispravno za menadžere) s fallbackom na name detection
    const tabs = allPermissions.length > 0
      ? tabsFromPermissions(allPermissions)
      : mergePortalTabs(roleNames.length > 0 ? roleNames : ['hr'])
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
      setAuthError(t('errBadCredentials'))
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
    if (newPassword !== newPasswordConfirm) { setResetError(t('errPasswordMismatch')); return }
    if (newPassword.length < 6) { setResetError(t('errPasswordShort')); return }
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
  if (!restaurant) return <div className={s.loadWrap}><p className={s.notFound}>{t('notFound')}</p></div>

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
          <div className={s.loginSubtitle}>{t('staffPortal')}</div>
          <LanguageSwitcher variant="dark" />
        </div>
        <form onSubmit={handleLogin} className={s.loginForm}>
          <div className={s.loginField}>
            <label>{t('email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="vas@email.com" required autoComplete="email" />
          </div>
          <div className={s.loginField}>
            <label>{t('password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoComplete="current-password" />
          </div>
          {authError && <div className={s.loginError}>{authError}</div>}
          <button type="submit" className={s.loginBtn} style={{ background: brand }} disabled={authLoading}>
            {authLoading ? t('loggingIn') : t('loginBtn')}
          </button>
          <button type="button" className={s.loginForgotBtn} onClick={() => { setAuthError(''); setMode('forgot') }}>
            {t('forgotPassword')}
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
          <div className={s.loginSubtitle}>{t('resetPassword')}</div>
          <LanguageSwitcher variant="dark" />
        </div>
        {forgotSent ? (
          <div className={s.loginForm}>
            <div className={s.loginSuccess}>
              {t('forgotSent')}
            </div>
            <button type="button" className={s.loginForgotBtn} onClick={() => { setForgotSent(false); setMode('login') }}>
              {t('backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgot} className={s.loginForm}>
            <p className={s.loginHint}>{t('forgotHint')}</p>
            <div className={s.loginField}>
              <label>{t('email')}</label>
              <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                placeholder="vas@email.com" required autoComplete="email" />
            </div>
            {forgotError && <div className={s.loginError}>{forgotError}</div>}
            <button type="submit" className={s.loginBtn} style={{ background: brand }} disabled={forgotLoading}>
              {forgotLoading ? t('sending') : t('sendLinkBtn')}
            </button>
            <button type="button" className={s.loginForgotBtn} onClick={() => setMode('login')}>
              {t('backToLogin')}
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
          <div className={s.loginSubtitle}>{t('newPassword')}</div>
          <LanguageSwitcher variant="dark" />
        </div>
        {resetDone ? (
          <div className={s.loginForm}>
            <div className={s.loginSuccess}>{t('resetDone')}</div>
          </div>
        ) : (
          <form onSubmit={handleReset} className={s.loginForm}>
            <div className={s.loginField}>
              <label>{t('newPassword')}</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder={t('phMin6')} required minLength={6} autoComplete="new-password" />
            </div>
            <div className={s.loginField}>
              <label>{t('confirmPassword')}</label>
              <input type="password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)}
                placeholder={t('phRepeatPassword')} required autoComplete="new-password" />
            </div>
            {resetError && <div className={s.loginError}>{resetError}</div>}
            <button type="submit" className={s.loginBtn} style={{ background: brand }} disabled={resetLoading}>
              {resetLoading ? t('saving') : t('setPasswordBtn')}
            </button>
          </form>
        )}
      </div>
    </div>
  )

  // ── Portal ────────────────────────────────────────────────────────
  const tabs     = mergedTabs
  const staffName = [staff?.first_name, staff?.last_name].filter(Boolean).join(' ') || staff?.email || ''

  const TAB_BADGES = {
    orders:      counts.waiter,
    requests:    counts.waiterReq,
    kitchen:     counts.kitchen,
    bar_orders:  counts.bar,
    tasks:       counts.housekeeping,
    maintenance: counts.maintOpen,
  }

  // Podjela tabova u sekcije
  const WORK_KEYS     = new Set(['orders','requests','naplata','kitchen','bar_orders','tasks','maintenance','checkin','checkout','rooms','appointments'])
  const PERSONAL_KEYS = new Set(['schedule','attendance','payroll','absences','notifications','profile'])

  const workTabs     = tabs.filter(t => WORK_KEYS.has(t.key))
  const personalTabs = tabs.filter(t => PERSONAL_KEYS.has(t.key))
  const hasWork      = workTabs.length > 0

  const activeSection = activeTab === 'home'          ? 'home'
                      : WORK_KEYS.has(activeTab)      ? 'work'
                      : 'personal'

  const subTabs   = activeSection === 'work'     ? workTabs
                  : activeSection === 'personal' ? personalTabs
                  : []

  const workBadge = workTabs.reduce((sum, t) => sum + (TAB_BADGES[t.key] || 0), 0)

  const goHome     = () => setActiveTab('home')
  const goWork     = () => workTabs[0] && setActiveTab(workTabs[0].key)
  const goPersonal = () => personalTabs[0] && setActiveTab(personalTabs[0].key)

  const renderView = () => {
    if (activeTab === 'home') return <HomeView staffId={staff.id} restaurantId={restaurant.id} staffInfo={staff} brand={brand} />
    if (['schedule', 'attendance', 'payroll', 'absences'].includes(activeTab)) {
      return <HrView staffId={staff.id} activeTab={activeTab} currency={restaurant?.currency} />
    }
    if (activeTab === 'tasks')       return <HousekeepingView staffId={staff.id} restaurantId={restaurant.id} onRefresh={refreshCounts} />
    if (activeTab === 'maintenance') return <MaintenanceView  staffId={staff.id} restaurantId={restaurant.id} onRefresh={refreshCounts} />
    if (activeTab === 'orders' || activeTab === 'requests') return <WaiterView restaurant={restaurant} activeTab={activeTab} onRefresh={refreshCounts} hotelEnabled={hotelBetaFree || hasAddon(subscription, 'hotel_core')} fiscalEnabled={fiscalBetaFree || hasAddon(subscription, 'fiscalization')} />
    if (activeTab === 'naplata')  return <NaplataView restaurant={restaurant} />
    if (activeTab === 'kitchen')     return <KitchenView    restaurantId={restaurant.id} onRefresh={refreshCounts} />
    if (activeTab === 'bar_orders')  return <BarView        restaurantId={restaurant.id} onRefresh={refreshCounts} />
    if (['checkin', 'checkout', 'rooms'].includes(activeTab)) return <ReceptionView restaurantId={restaurant.id} activeTab={activeTab} onRefresh={refreshCounts} />
    if (activeTab === 'appointments') return <SpaView     staffId={staff.id} restaurantId={restaurant.id} onRefresh={refreshCounts} />
    if (activeTab === 'notifications') return <NotificationsView restaurantId={restaurant.id} userId={staff?.user_id} />
    if (activeTab === 'profile')      return <ProfileView staffId={staff.id} staff={staff} brand={brand} />
    return null
  }

  return (
    <div className={s.portalPage} style={{ '--sp-brand': brand }}>
      {/* Header */}
      <div className={s.portalHeader} style={{ background: brand }}>
        <div className={s.portalAvatar}>
          {staffName ? staffName[0].toUpperCase() : '?'}
        </div>
        <div className={s.portalHeaderInfo}>
          <div className={s.portalName}>{staffName}</div>
          <div className={s.portalRoleLabel}>{staff?.role?.name || t('roleFallback')} · {restaurant.name}</div>
        </div>
        <LanguageSwitcher variant="dark" />
        <button className={s.portalLogout} onClick={handleLogout}>{t('logout')}</button>
      </div>

      {/* Content — sub-pills su unutar scroll areala, wrappaju se u više redova */}
      <div className={s.content}>
        {subTabs.length > 1 && (
          <nav className={s.subPillNav}>
            {subTabs.map(tab => {
              const badge = TAB_BADGES[tab.key] || 0
              return (
                <button
                  key={tab.key}
                  className={`${s.subPill} ${activeTab === tab.key ? s.subPillActive : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  style={activeTab === tab.key ? { background: brand, borderColor: brand } : {}}
                >
                  <span>{tab.icon}</span>
                  <span>{t(tab.labelKey)}</span>
                  {badge > 0 && <span className={s.navBadge}>{badge}</span>}
                </button>
              )
            })}
          </nav>
        )}
        {renderView()}
        <div className={s.portalFooter}>Powered by <strong>RestByMe</strong></div>
      </div>

      {/* Bottom bar */}
      <nav className={s.bottomBar}>
        <button
          className={`${s.bottomBtn} ${activeSection === 'home' ? s.bottomBtnActive : ''}`}
          onClick={goHome}
          style={activeSection === 'home' ? { color: brand } : {}}
        >
          <span className={s.bottomIcon}>🏠</span>
          <span className={s.bottomLabel}>{t('navHome')}</span>
        </button>

        {hasWork && (
          <button
            className={`${s.bottomBtn} ${activeSection === 'work' ? s.bottomBtnActive : ''}`}
            onClick={goWork}
            style={activeSection === 'work' ? { color: brand } : {}}
          >
            <span className={s.bottomIcon}>⚡</span>
            <span className={s.bottomLabel}>{t('navWork')}</span>
            {workBadge > 0 && <span className={s.bottomBadge}>{workBadge}</span>}
          </button>
        )}

        <button
          className={`${s.bottomBtn} ${activeSection === 'personal' ? s.bottomBtnActive : ''}`}
          onClick={goPersonal}
          style={activeSection === 'personal' ? { color: brand } : {}}
        >
          <span className={s.bottomIcon}>👤</span>
          <span className={s.bottomLabel}>{t('navMe')}</span>
        </button>
      </nav>
    </div>
  )
}
