// supabase/functions/activate-addon/index.ts
// Aktivira addon modul sa 14-dnevnim trial periodom (bez plaćanja)
// Kada se doda Stripe, ovdje se dodaje payment check prije aktivacije

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // Autentifikacija korisnika
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  })

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Dohvati restaurant ovog korisnika
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!restaurant) {
    return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  const { addon_id } = await req.json()

  if (!addon_id || typeof addon_id !== 'string') {
    return new Response(JSON.stringify({ error: 'addon_id is required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Provjeri da addon postoji u katalogu
  const { data: addonDef } = await supabase
    .from('addon_catalog')
    .select('id, depends_on')
    .eq('id', addon_id)
    .eq('is_active', true)
    .single()

  if (!addonDef) {
    return new Response(JSON.stringify({ error: 'Addon not found' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Dohvati ili kreiraj subscription
  let { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .single()

  const currentAddons: string[] = sub?.addons ?? []
  const currentTrials: Record<string, string> = sub?.addon_trials ?? {}

  // Provjeri da addon već nije aktivan
  if (currentAddons.includes(addon_id)) {
    return new Response(JSON.stringify({ error: 'Addon already active' }), {
      status: 409, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Provjeri dependencije
  const missingDeps = (addonDef.depends_on ?? []).filter(
    (dep: string) => !currentAddons.includes(dep)
  )
  if (missingDeps.length > 0) {
    return new Response(JSON.stringify({
      error: `Missing required addons: ${missingDeps.join(', ')}`
    }), {
      status: 422, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }

  // Trial: 14 dana od danas
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 14)

  const newAddons = [...currentAddons, addon_id]
  const newTrials = { ...currentTrials, [addon_id]: trialEnd.toISOString() }

  if (sub) {
    await supabase
      .from('subscriptions')
      .update({
        addons: newAddons,
        addon_trials: newTrials,
        updated_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurant.id)
  } else {
    await supabase
      .from('subscriptions')
      .insert({
        restaurant_id: restaurant.id,
        plan: 'starter',
        addons: newAddons,
        addon_trials: newTrials,
        status: 'trialing',
      })
  }

  return new Response(JSON.stringify({
    success: true,
    addon_id,
    trial_ends_at: trialEnd.toISOString(),
  }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
  })
})
