import { createContext, useContext, useEffect, useState } from 'react'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        loadProfile(data.session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session) {
          setUser(session.user)
          loadProfile(session.user)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setRestaurant(null)
        setTenant(null)
        setSubscription(null)
        setStaffProfile(null)
        setPermissions([])
        setLoading(false)
      }
      // TOKEN_REFRESHED i ostale akcije ne pokrecu loadProfile ponovo
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadProfile = async (user) => {
    // Sve query-je paralelno — uklj. subscription vlasnika (embedded join na
    // restaurants.user_id), pa nema dodatnog round-tripa nakon prve grupe.
    const [{ data: profile }, { data: ownerRest }, { data: staff }, { data: ownerSub }, { data: ownerTenant }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('restaurants').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('staff').select('*, role:roles(*)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('subscriptions').select('*, restaurants!inner(user_id)').eq('restaurants.user_id', user.id).maybeSingle(),
      supabase.from('tenants').select('*').eq('user_id', user.id).maybeSingle(),
    ])

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

  const checkAddon = (addonId) => hasAddon(subscription, addonId)

  // 2b/Faza 3: koje vertikale tenant koristi. Fallback ['restaurant'] (zatečeno
  // ponašanje + staff koji ne čita tenants po RLS-u) → restoran uvijek vidljiv
  // dok se eksplicitno ne isključi.
  const hasVertical = (v) => (tenant?.active_verticals ?? ['restaurant']).includes(v)

  return (
    <PlatformContext.Provider value={{
      user, restaurant, setRestaurant,
      tenant, setTenant,
      subscription, setSubscription,
      staffProfile, permissions,
      loading, hasPermission,
      isSuperAdmin, isOwner, isStaff,
      hasAddon: checkAddon,
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
