// ▶ Kopirati u: src/lib/planUtils.js  (novi fajl)

export function isPro(restaurant) {
  if (!restaurant) return false
  if (restaurant.is_complimentary) return true
  if (restaurant.plan === 'pro') return true
  return false
}

export function isSuspended(restaurant) {
  if (!restaurant) return false
  if (restaurant.is_complimentary) return false
  return !!restaurant.suspended_at
}

export function trialDaysLeft(restaurant) {
  if (!restaurant) return null
  if (restaurant.is_complimentary) return null
  if (!restaurant.trial_ends_at) return null
  return Math.max(0, Math.ceil(
    (new Date(restaurant.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)
  ))
}

export function planStatus(restaurant) {
  if (!restaurant) return 'starter'
  if (restaurant.is_complimentary) return 'complimentary'
  if (isSuspended(restaurant)) return 'suspended'
  if (restaurant.plan === 'pro') return 'pro'
  const days = trialDaysLeft(restaurant)
  if (days !== null && days > 0) return 'trial'
  if (days === 0) return 'expired'
  return 'starter'
}
