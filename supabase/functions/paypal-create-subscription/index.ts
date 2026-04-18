import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!
const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')!
const PAYPAL_PLAN_ID = Deno.env.get('PAYPAL_PLAN_ID')!
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getPayPalToken() {
  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth header' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

    // Koristi service role da verifikuje token i dobije korisnika
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (!user || userError) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: userError?.message }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('User authenticated:', user.id)

    // Uzmi restaurant
    const { data: restaurant, error: restError } = await supabaseAdmin
      .from('restaurants')
      .select('id, name, slug')
      .eq('user_id', user.id)
      .single()

    if (!restaurant) {
      console.error('Restaurant error:', restError)
      return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { return_url, cancel_url } = body

    const paypalToken = await getPayPalToken()

    const subscriptionRes = await fetch(`${PAYPAL_BASE}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paypalToken}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `smartmeni-${restaurant.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        plan_id: PAYPAL_PLAN_ID,
        subscriber: { name: { given_name: restaurant.name } },
        application_context: {
          brand_name: 'SmartMeni',
          locale: 'hr-HR',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: return_url || `${Deno.env.get('APP_URL')}/admin/billing/success`,
          cancel_url: cancel_url || `${Deno.env.get('APP_URL')}/admin/billing`,
        },
        custom_id: restaurant.id,
      }),
    })

    const subscription = await subscriptionRes.json()
    console.log('PayPal subscription:', JSON.stringify(subscription))


    if (!subscription.id) {
      return new Response(JSON.stringify({ error: 'Failed to create subscription', detail: subscription }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const approveLink = subscription.links?.find((l: any) => l.rel === 'approve')?.href

    return new Response(JSON.stringify({
      subscription_id: subscription.id,
      approve_url: approveLink,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
