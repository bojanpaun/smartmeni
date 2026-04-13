import { usePlatform } from '../context/PlatformContext'

// Provjeri jednu permisiju
export const usePermission = (perm) => {
  const { hasPermission } = usePlatform()
  return hasPermission(perm)
}

// Provjeri više permisija odjednom
export const usePermissions = (perms = []) => {
  const { hasPermission } = usePlatform()
  const result = {}
  perms.forEach(p => { result[p] = hasPermission(p) })
  return result
}

// Guard komponenta — renderuje children samo ako ima permisiju
export function PermissionGate({ perm, fallback = null, children }) {
  const { hasPermission } = usePlatform()
  if (!hasPermission(perm)) return fallback
  return children
}

// Guard za rolu
export function RoleGate({ roles = [], fallback = null, children }) {
  const { isSuperAdmin, isOwner, isStaff, staffProfile } = usePlatform()

  const hasRole = roles.some(role => {
    if (role === 'superadmin') return isSuperAdmin()
    if (role === 'owner') return isOwner()
    if (role === 'staff') return isStaff()
    return staffProfile?.role?.name === role
  })

  if (!hasRole) return fallback
  return children
}
