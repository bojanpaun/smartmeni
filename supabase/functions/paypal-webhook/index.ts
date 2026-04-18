import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!
const PAYPAL_SECRET = Deno.env.get('PAYPAL_SECRET')!
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getPayPalToken() {
  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const eventType = body.event_type
    const resource = body.resource

    console.log('PayPal webhook:', eventType, resource?.id)

    switch (eventType) {

      // Subscription aktivirana — postavi na Pro
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const restaurantId = resource.custom_id
        if (!restaurantId) break

        await supabase.from('restaurants').update({
          plan: 'pro',
          subscription_id: resource.id,
          plan_expires_at: null,
          suspended_at: null,
          trial_ends_at: null,
        }).eq('id', restaurantId)

        console.log(`Restaurant ${restaurantId} upgraded to Pro`)
        break
      }

      // Plaćanje uspješno — obnovi godišnju pretplatu
      case 'PAYMENT.SALE.COMPLETED': {
        const subscriptionId = resource.billing_agreement_id
        if (!subscriptionId) break

        // Nađi restaurant po subscription_id
        const { data: rest } = await supabase
          .from('restaurants')
          .select('id')
          .eq('subscription_id', subscriptionId)
          .single()

        if (rest) {
          // Produlji za godinu
          const expiresAt = new Date()
          expiresAt.setFullYear(expiresAt.getFullYear() + 1)

          await supabase.from('restaurants').update({
            plan: 'pro',
            plan_expires_at: expiresAt.toISOString(),
            suspended_at: null,
          }).eq('id', rest.id)

          console.log(`Restaurant ${rest.id} subscription renewed`)
        }
        break
      }

      // Subscription otkazana
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        const { data: rest } = await supabase
          .from('restaurants')
          .select('id')
          .eq('subscription_id', resource.id)
          .single()

        if (rest) {
          await supabase.from('restaurants').update({
            plan: 'starter',
            subscription_id: null,
            plan_expires_at: null,
          }).eq('id', rest.id)

          console.log(`Restaurant ${rest.id} downgraded to Starter`)
        }
        break
      }

      // Plaćanje neuspješno — suspenduj nalog
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const { data: rest } = await supabase
          .from('restaurants')
          .select('id')
          .eq('subscription_id', resource.id)
          .single()

        if (rest) {
          await supabase.from('restaurants').update({
            suspended_at: new Date().toISOString(),
          }).eq('id', rest.id)

          console.log(`Restaurant ${rest.id} suspended due to payment failure`)
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
