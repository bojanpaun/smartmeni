import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hasAddon } from '../lib/planUtils'

const PlatformContext = createContext(null)

export function PlatformProvider({ children }) {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
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
    // Sve tri query-je pokrenuti paralelno — eliminišemo waterfall od 3-5 round-tripova
    const [{ data: profile }, { data: ownerRest }, { data: staff }] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('restaurants').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('staff').select('*, role:roles(*)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    ])

    if (profile?.is_superadmin) {
      setStaffProfile({ ...profile, role: 'superadmin' })
      setPermissions(['*'])
      if (ownerRest) {
        setRestaurant(ownerRest)
        await loadSubscription(ownerRest.id)
      }
      setLoading(false)
      return
    }

    if (ownerRest) {
      setRestaurant(ownerRest)
      setPermissions(['*'])
      await loadSubscription(ownerRest.id)
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

  const loadSubscription = async (restaurantId) => {
    const { data } = await supabase
      .from('subscriptions').select('*').eq('restaurant_id', restaurantId).maybeSingle()
    setSubscription(data ?? null)
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

  return (
    <PlatformContext.Provider value={{
      user, restaurant, setRestaurant,
      subscription, setSubscription,
      staffProfile, permissions,
      loading, hasPermission,
      isSuperAdmin, isOwner, isStaff,
      hasAddon: checkAddon,
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
