import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!
const PAYPAL_SECRET    = Deno.env.get('PAYPAL_SECRET')!
const PAYPAL_BASE      = 'https://api-m.paypal.com' // produkcija

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

// Verifikacija PayPal webhook signature (preporučeno za produkciju)
async function verifyWebhookSignature(req: Request, body: string): Promise<boolean> {
  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')
  if (!webhookId) return true // skip u dev modu ako nije konfigurisan

  const token = await getPayPalToken()
  const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo:         req.headers.get('paypal-auth-algo'),
      cert_url:          req.headers.get('paypal-cert-url'),
      transmission_id:   req.headers.get('paypal-transmission-id'),
      transmission_sig:  req.headers.get('paypal-transmission-sig'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      webhook_id:        webhookId,
      webhook_event:     JSON.parse(body),
    }),
  })
  const data = await res.json()
  return data.verification_status === 'SUCCESS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const rawBody = await req.text()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const valid = await verifyWebhookSignature(req, rawBody)
    if (!valid) {
      console.error('PayPal webhook signature invalid')
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = JSON.parse(rawBody)
    const eventType = body.event_type
    const resource  = body.resource

    console.log('PayPal webhook:', eventType, resource?.id)

    switch (eventType) {

      // Subscription aktivirana — postavi na Pro
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const restaurantId = resource.custom_id
        if (!restaurantId) break

        const periodEnd = new Date()
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)

        await supabase.from('subscriptions').upsert({
          restaurant_id:         restaurantId,
          paypal_subscription_id: resource.id,
          plan:                  'pro',
          status:                'active',
          trial_ends_at:         null,
          current_period_start:  new Date().toISOString(),
          current_period_end:    periodEnd.toISOString(),
          updated_at:            new Date().toISOString(),
        }, { onConflict: 'restaurant_id' })

        console.log(`Restaurant ${restaurantId} → Pro (PayPal ${resource.id})`)
        break
      }

      // Plaćanje uspješno — obnovi period
      case 'PAYMENT.SALE.COMPLETED': {
        const subscriptionId = resource.billing_agreement_id
        if (!subscriptionId) break

        const periodEnd = new Date()
        periodEnd.setFullYear(periodEnd.getFullYear() + 1)

        await supabase.from('subscriptions')
          .update({
            status:               'active',
            plan:                 'pro',
            current_period_start: new Date().toISOString(),
            current_period_end:   periodEnd.toISOString(),
            updated_at:           new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subscriptionId)

        console.log(`Subscription ${subscriptionId} renewed`)
        break
      }

      // Subscription otkazana ili istekla
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        await supabase.from('subscriptions')
          .update({
            plan:                  'starter',
            status:                'cancelled',
            paypal_subscription_id: null,
            current_period_end:    null,
            updated_at:            new Date().toISOString(),
          })
          .eq('paypal_subscription_id', resource.id)

        console.log(`Subscription ${resource.id} cancelled → Starter`)
        break
      }

      // Plaćanje neuspješno
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        await supabase.from('subscriptions')
          .update({
            status:     'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', resource.id)

        console.log(`Subscription ${resource.id} → past_due`)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
