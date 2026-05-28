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

// Provjera da li tenant ima određeni addon modul aktivan
export function hasAddon(subscription, addonId) {
  if (!subscription) return false
  if (subscription.plan === 'enterprise') return true
  const addons = subscription.addons
  if (!Array.isArray(addons)) return false
  return addons.includes(addonId)
}

// Trial za addon — provjera da li je addon u trial periodu
export function addonTrialDaysLeft(subscription, addonId) {
  if (!subscription?.addon_trials) return null
  const trial = subscription.addon_trials[addonId]
  if (!trial) return null
  return Math.max(0, Math.ceil(
    (new Date(trial) - new Date()) / (1000 * 60 * 60 * 24)
  ))
}
