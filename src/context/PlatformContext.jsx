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
    // Check if superadmin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.is_superadmin) {
      setStaffProfile({ ...profile, role: 'superadmin' })
      setPermissions(['*'])

      // Super admin može imati i vlastiti restoran — učitaj ga ako postoji
      const { data: adminRest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (adminRest) {
        setRestaurant(adminRest)
        await loadSubscription(adminRest.id)
      }

      setLoading(false)
      return
    }

    // Check if restaurant owner
    const { data: rest } = await supabase
      .from('restaurants')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (rest) {
      setRestaurant(rest)
      setPermissions(['*'])
      await loadSubscription(rest.id)
      setLoading(false)
      return
    }

    // Check if staff member
    const { data: staff } = await supabase
      .from('staff')
      .select(`*, role:roles(*)`)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (staff) {
      setStaffProfile(staff)
      const { data: staffRest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', staff.restaurant_id)
        .maybeSingle()
      setRestaurant(staffRest)
      if (staffRest) await loadSubscription(staffRest.id)

      const allPerms = []
      if (staff.role?.permissions) {
        allPerms.push(...staff.role.permissions)
      }
      setPermissions(allPerms)
    }

    setLoading(false)
  }

  const loadSubscription = async (restaurantId) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
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
