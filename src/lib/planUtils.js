// ── Plan → uključeni addoni ────────────────────────────────────
// Svaki viši plan uključuje sve addone nižeg + vlastite
const PLAN_INCLUDES = {
  restaurant: [
    'analytics_pro', 'hr_pro', 'inventory_pro', 'loyalty',
  ],
  hotel: [
    'analytics_pro', 'hr_pro', 'inventory_pro', 'loyalty',
    'hotel_core', 'booking_engine', 'housekeeping', 'revenue_mgmt',
  ],
  hotel_pro: [
    'analytics_pro', 'hr_pro', 'inventory_pro', 'loyalty',
    'hotel_core', 'booking_engine', 'housekeeping', 'revenue_mgmt',
    'spa_wellness',
  ],
  enterprise: null, // null = sve
}

// Normalizuje stare plan nazive
function normalizePlan(plan) {
  if (plan === 'pro') return 'restaurant' // backward compat
  return plan || 'starter'
}

export function isPro(restaurant) {
  if (!restaurant) return false
  if (restaurant.is_complimentary) return true
  const plan = normalizePlan(restaurant.plan)
  return plan !== 'starter'
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
  const plan = normalizePlan(restaurant.plan)
  if (plan !== 'starter') return plan
  const days = trialDaysLeft(restaurant)
  if (days !== null && days > 0) return 'trial'
  if (days === 0) return 'expired'
  return 'starter'
}

// Provjera da li tenant ima određeni addon aktivan
// Provjerava i bundle plan I individualne addonе (trial/grandfathered).
// `planIncludesOverride` (opciono): mapa { planId: addonId[] | null } iz DB tabele
// `plans` — kad je proslijeđena, izvor uključenja je DB (omogućava superadmin-
// kreirane planove). null vrijednost = "sve uključeno" (enterprise). Bez override-a
// pada na hardkodirani PLAN_INCLUDES (rezilijentno ako DB nije učitan).
export function hasAddon(subscription, addonId, planIncludesOverride = null) {
  if (!subscription) return false
  const plan = normalizePlan(subscription.plan)

  if (plan === 'enterprise') return true

  // Izvor uključenja: DB override (ako ima taj plan) ili konstanta.
  const included = (planIncludesOverride && plan in planIncludesOverride)
    ? planIncludesOverride[plan]
    : PLAN_INCLUDES[plan]
  if (included === null) return true            // null = sve (enterprise/custom)
  if (included?.includes(addonId)) return true

  // Provjeri individualne addonе (trial, grandfathered)
  const addons = subscription.addons
  if (Array.isArray(addons) && addons.includes(addonId)) return true

  return false
}

// Trial za addon
export function addonTrialDaysLeft(subscription, addonId) {
  if (!subscription?.addon_trials) return null
  const trial = subscription.addon_trials[addonId]
  if (!trial) return null
  return Math.max(0, Math.ceil(
    (new Date(trial) - new Date()) / (1000 * 60 * 60 * 24)
  ))
}

// Pricing konstante
export const PLAN_PRICING = {
  restaurant: { monthly: 29, annual_per_month: 23, annual_total: 276 },
  hotel:      { monthly: 79, annual_per_month: 63, annual_total: 756 },
  hotel_pro:  { monthly: 119, annual_per_month: 95, annual_total: 1140 },
}

export const ANNUAL_DISCOUNT = 20 // %

// 2b: account/billing polja žive u `tenants` (izvor istine). Ova lista služi da
// se NE pišu u `restaurants` kroz "full object" update-ove postavki (koje uzimaju
// {...restaurant}, gdje su account polja spojena iz tenanta) — inače bi mirror
// trigger vratio (potencijalno stale) vrijednosti u tenants.
export const ACCOUNT_FIELDS = [
  'plan', 'trial_ends_at', 'plan_expires_at', 'suspended_at',
  'is_complimentary', 'complimentary_note', 'admin_theme', 'admin_language',
  'onboarding_completed', 'subscription_id', 'paypal_customer_id',
]
export function stripAccountFields(obj) {
  const out = { ...obj }
  for (const f of ACCOUNT_FIELDS) delete out[f]
  return out
}
