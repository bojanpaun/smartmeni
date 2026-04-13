import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PlatformContext = createContext(null)

export function PlatformProvider({ children }) {
  const [user, setUser] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user)
        loadProfile(session.user)
      } else {
        setUser(null)
        setRestaurant(null)
        setStaffProfile(null)
        setPermissions([])
        setLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadProfile = async (user) => {
    // Check if superadmin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile?.is_superadmin) {
      setStaffProfile({ ...profile, role: 'superadmin' })
      setPermissions(['*']) // superadmin has all permissions
      setLoading(false)
      return
    }

    // Check if restaurant owner
    const { data: rest } = await supabase
      .from('restaurants')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (rest) {
      setRestaurant(rest)
      setPermissions(['*']) // owner has all permissions for their restaurant
      setLoading(false)
      return
    }

    // Check if staff member
    const { data: staff } = await supabase
      .from('staff')
      .select(`*, role:roles(*)`)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (staff) {
      setStaffProfile(staff)
      // Load restaurant for this staff member
      const { data: staffRest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', staff.restaurant_id)
        .single()
      setRestaurant(staffRest)

      // Collect all permissions from all roles
      const allPerms = []
      if (staff.role?.permissions) {
        allPerms.push(...staff.role.permissions)
      }
      setPermissions(allPerms)
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
  }

  return (
    <PlatformContext.Provider value={{
      user, restaurant, setRestaurant,
      staffProfile, permissions,
      loading, hasPermission,
      isSuperAdmin, isOwner, isStaff,
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
