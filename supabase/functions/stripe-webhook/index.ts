// supabase/functions/stripe-webhook/index.ts
// Stripe webhook handler za subscription evente
// Aktivira se kada se doda Stripe kao payment provider (Faza 1 billing)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Ako Stripe nije konfigurisan, vrati grešku
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe not configured', { status: 503 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Dinamički import Stripe-a (izbjegava grešku ako modul nije dostupan)
  let event
  try {
    const Stripe = (await import('https://esm.sh/stripe@14')).default
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Record<string, any>
        const restaurantId = sub.metadata?.restaurant_id

        if (!restaurantId) {
          console.error('No restaurant_id in subscription metadata')
          break
        }

        // Izvuci addon IDs iz subscription item metadatae
        const addons = (sub.items?.data ?? [])
          .map((item: any) => item.price?.metadata?.addon_id)
          .filter(Boolean)

        await supabase.from('subscriptions').upsert({
          restaurant_id: restaurantId,
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer,
          plan: sub.metadata?.plan ?? 'starter',
          addons,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          trial_ends_at: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' })

        console.log(`Subscription upserted for restaurant ${restaurantId}`, { addons, status: sub.status })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Record<string, any>
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', addons: [], updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)

        console.log(`Subscription cancelled: ${sub.id}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Record<string, any>
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Record<string, any>
        if (invoice.subscription) {
          await supabase
            .from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Error processing webhook:', err)
    return new Response('Internal error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
})
