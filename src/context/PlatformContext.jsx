import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hasAddon } from '../lib/planUtils'

const PlatformContext = createContext(null)

// 2b/Faza 2: account/billing polja su izvor istine u `tenants`. Spajamo ih na
// `restaurant` objekat koji app već koristi (restaurant.plan, isPro(restaurant)…),
// pa komponente ostaju nepromijenjene dok izvor postaje tenant.
const ACCOUNT_FIELDS = [
  'plan', 'trial_ends_at', 'plan_expires_at', 'suspended_at',
  'is_complimentary', 'complimentary_note', 'admin_theme',
  'onboarding_completed', 'subscription_id', 'paypal_customer_id',
]
function withTenant(rest, tenant) {
  if (!rest || !tenant) return rest
  const merged = { ...rest }
  for (const f of ACCOUNT_FIELDS) merged[f] = tenant[f]
  return merged
}

export function PlatformProvider({ children }) {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [tenant, setTenant] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [staffProfile, setStaffProfile] = useState(null)
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  // Billing/beta: globalni "beta-free" prekidač + addon katalog (cijene + per-addon
  // beta_free) + plan cijene — izvor istine je DB (superadmin ih uređuje na
  // /superadmin/billing). Dok je beta aktivna, gating (checkAddon) propušta sve
  // besplatno; vertikale (hasVertical) i dalje ograničavaju ŠTA tenant vidi.
  const [betaGlobal, setBetaGlobal] = useState(false)
  const [addonCatalog, setAddonCatalog] = useState([])
  const [plans, setPlans] = useState([])
  // Spriječi višestruko pokretanje loadProfile-a: getSession + INITIAL_SESSION se
  // oboje okidaju na startu, a SIGNED_IN se re-fira na fokus taba. Učitaj profil
  // tačno jednom po korisniku (8 upita po pozivu — inače se gomilaju).
  const loadedUserIdRef = useRef(null)

  useEffect(() => {
    // Učitaj profil samo ako se korisnik promijenio u odnosu na zadnji put.
    const maybeLoad = (session) => {
      const uid = session?.user?.id
      if (!uid) return
      if (loadedUserIdRef.current === uid) return // već učitano za ovog korisnika
      loadedUserIdRef.current = uid
      setUser(session.user)
      loadProfile(session.user)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) maybeLoad(data.session)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) maybeLoad(session)
      } else if (event === 'SIGNED_OUT') {
        loadedUserIdRef.current = null
        setUser(null)
        setRestaurant(null)
        setTenant(null)
        setSubscription(null)
        setStaffProfile(null)
        setPermissions([])
        setBetaGlobal(false)
        setAddonCatalog([])
        setPlans([])
        setLoading(false)
      }
      // TOKEN_REFRESHED i ponovni SIGNED_IN za istog korisnika (fokus taba) se ignorišu.
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadProfile = async (user) => {
    // Sve query-je paralelno — uklj. subscription vlasnika (embedded join na
    // restaurants.user_id), pa nema dodatnog round-tripa nakon prve grupe.
    const [{ data: profile }, { data: ownerRest }, { data: staff }, { data: ownerSub }, { data: ownerTenant }, { data: settings }, { data: addonRows }, { data: planRows }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('restaurants').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('staff').select('*, role:roles(*)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('subscriptions').select('*, restaurants!inner(user_id)').eq('restaurants.user_id', user.id).maybeSingle(),
      supabase.from('tenants').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('platform_settings').select('beta_free_mode').limit(1).maybeSingle(),
      supabase.from('addon_catalog').select('id, name, category, description, features, price_monthly, price_yearly, beta_free'),
      supabase.from('plans').select('id, name, description, features, color, includes, is_popular, coming_soon, price_monthly, price_annual_per_month, price_annual_total, is_active, sort_order, paypal_plan_id'),
    ])

    // Billing config je globalan (isti za sve tenante) — postavi prije bilo koje grane.
    setBetaGlobal(!!settings?.beta_free_mode)
    setAddonCatalog(addonRows ?? [])
    setPlans(planRows ?? [])

    if (profile?.is_superadmin) {
      setStaffProfile({ ...profile, role: 'superadmin' })
      setPermissions(['*'])
      if (ownerRest) {
        setTenant(ownerTenant ?? null)
        setRestaurant(withTenant(ownerRest, ownerTenant))
        setSubscription(ownerSub ?? null)
      }
      setLoading(false)
      return
    }

    if (ownerRest) {
      setTenant(ownerTenant ?? null)
      setRestaurant(withTenant(ownerRest, ownerTenant))
      setPermissions(['*'])
      setSubscription(ownerSub ?? null)
      setLoading(false)
      return
    }

    if (staff) {
      setStaffProfile(staff)
      const allPerms = staff.role?.permissions ? [...staff.role.permissions] : []
      setPermissions(allPerms)
      // Restaurant i subscription za staffa — paralelno
      const [{ data: staffRest }, { data: sub }] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', staff.restaurant_id).maybeSingle(),
        supabase.from('subscriptions').select('plan, addons, addon_trials').eq('restaurant_id', staff.restaurant_id).maybeSingle(),
      ])
      setRestaurant(staffRest)
      setSubscription(sub ?? null)
    }

    setLoading(false)
  }

  const hasPermission = (perm) => {
    if (permissions.includes('*')) return true
    return permissions.includes(perm)
  }

  const isSuperAdmin = () => staffProfile?.role === 'superadmin'
  const isOwner = () => !staffProfile && !!restaurant
  const isStaff = () => !!staffProfile && staffProfile.role !== 'superadmin'

  const logout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // Gating addona: beta mod (globalni ili per-addon) propušta sve besplatno;
  // inače standardna provjera plana/individualnih addona. (Server-side ogledalo:
  // public.is_beta_free() — koriste ga DB RPC-ovi za isti rezultat.)
  const isBetaFree = (addonId) =>
    betaGlobal || !!addonCatalog.find((a) => a.id === addonId)?.beta_free
  // Uključenja plana: izvor je DB `plans.includes` (omogućava superadmin-kreirane
  // planove). Fallback na konstantu ako plans nije učitan (vidi hasAddon).
  const checkAddon = (addonId) => {
    if (isBetaFree(addonId)) return true
    const map = plans.length
      ? Object.fromEntries(plans.map((p) => [p.id, p.includes ?? null]))
      : null
    return hasAddon(subscription, addonId, map)
  }

  // Cijena addona iz DB kataloga (za UpgradePrompt). Fallback na prosljeđenu cijenu.
  const addonPrice = (addonId, fallback = null) =>
    addonCatalog.find((a) => a.id === addonId)?.price_yearly ?? fallback

  // 2b/Faza 4c: koje vertikale tenant koristi — izvor je restaurants.active_verticals
  // (javno čitljiv → radi i za staff i za guest sajt). Fallback ['restaurant'].
  const hasVertical = (v) => (restaurant?.active_verticals ?? ['restaurant']).includes(v)

  return (
    <PlatformContext.Provider value={{
      user, restaurant, setRestaurant,
      tenant, setTenant,
      subscription, setSubscription,
      staffProfile, permissions,
      loading, hasPermission,
      isSuperAdmin, isOwner, isStaff,
      hasAddon: checkAddon,
      betaMode: betaGlobal,
      addonCatalog, addonPrice, plans,
      hasVertical,
      logout, loadProfile
    }}>
      {children}
    </PlatformContext.Provider>
  )
}

export const usePlatform = () => {
  const ctx = useContext(PlatformContext)
  if (!ctx) throw new Error('usePlatform must be used inside PlatformProvider')
  return ctx
}
