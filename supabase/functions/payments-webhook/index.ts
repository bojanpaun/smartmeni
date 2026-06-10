// PAY-7 — payments-webhook
// Unified webhook handler za sve payment provajdere
// URL: /functions/v1/payments-webhook?provider=stripe|monri
//
// Idempotency: isti event ne pravi duplu transakciju ni duplu rezervaciju
// Signature: verifikacija se vrši u provajder implementaciji (StripeProvider, MonriProvider)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, getActiveTenantConfig, getCredentials } from '../_shared/payments/registry.ts'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Pročitaj raw body PRIJE parsiranja — potreban za signature verifikaciju
  const rawBody = await req.text()

  const url      = new URL(req.url)
  const provider = url.searchParams.get('provider') ?? 'stripe'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // Pre-parse — izvuci provider_ref i (ako ga ima) restaurant_id
    // Stripe: JSON metadata.restaurant_id + object.id
    // Monri:  form-encoded order_number (restaurant_id razrješavamo iz DB-a)
    let restaurantId: string | null = null
    let providerRefFromBody: string | null = null
    try {
      if (provider === 'monri') {
        const p = new URLSearchParams(rawBody)
        providerRefFromBody = p.get('order_number')
        restaurantId        = p.get('custom_attribute_1') // legacy/opciono
      } else {
        const preEvent      = JSON.parse(rawBody)
        restaurantId        = preEvent.data?.object?.metadata?.restaurant_id ?? null
        providerRefFromBody = preEvent.data?.object?.id ?? null
      }
    } catch { /* obradi niže */ }

    // Monri: routing NE oslanjamo na custom_attributes (format varira po banci) —
    // restaurant_id razrješavamo preko payment_transactions po provider_ref (order_number).
    if (!restaurantId && providerRefFromBody) {
      const { data: tx } = await supabase
        .from('payment_transactions')
        .select('restaurant_id')
        .eq('provider_ref', providerRefFromBody)
        .maybeSingle()
      restaurantId = tx?.restaurant_id ?? null
    }

    if (!restaurantId) {
      console.warn('[webhook] Nema restaurant_id (ni payload ni provider_ref), ignorišemo event')
      return new Response('ok', { status: 200 })
    }

    // Dohvati aktivan config za ovaj tenant i provajder
    const config = await getActiveTenantConfig(supabase, restaurantId)
    if (!config) {
      console.warn('[webhook] Nema aktivnog payment config-a za restaurant:', restaurantId)
      return new Response('ok', { status: 200 })
    }

    // Provjeri da config odgovara provajderu iz query params
    if (config.provider !== provider) {
      console.warn(`[webhook] Config provajder '${config.provider}' != query provajder '${provider}'`)
      return new Response('ok', { status: 200 })
    }

    const credentials    = await getCredentials(supabase, config.id)
    const paymentProvider = getProvider(config, credentials)

    // Verifikuj potpis i parsiraj event — baca grešku pri neispravnom potpisu
    const event = await paymentProvider.verifyAndParseWebhook(rawBody, req.headers)

    console.log(`[webhook] ${provider} | ref: ${event.providerRef} | status: ${event.status}`)

    // ── Idempotency check ────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('payment_transactions')
      .select('id, status, source_type, source_id')
      .eq('restaurant_id', restaurantId)
      .eq('provider_ref', event.providerRef)
      .maybeSingle()

    if (existing?.status === event.status) {
      console.log('[webhook] Duplikat event — već obrađeno:', event.providerRef)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ── Ažuriraj payment_transactions ───────────────────────────────
    if (existing) {
      await supabase
        .from('payment_transactions')
        .update({
          status:      event.status,
          raw_payload: event.rawPayload,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      // Fallback: transakcija nije kreirana u create-session (retry scenarij)
      // Pokušaj je kreirati iz webhook podataka
      const idempKey = (event.rawPayload as Record<string, unknown>)
        ?.data?.object?.metadata?.idempotency_key as string | undefined

      await supabase
        .from('payment_transactions')
        .upsert(
          {
            restaurant_id:   restaurantId,
            provider,
            provider_ref:    event.providerRef,
            idempotency_key: idempKey ?? `webhook_${event.providerRef}`,
            source_type:     (event.rawPayload as Record<string, unknown>)
                               ?.data?.object?.metadata?.source_type ?? 'booking',
            source_id:       (event.rawPayload as Record<string, unknown>)
                               ?.data?.object?.metadata?.source_id ?? null,
            amount_minor:    event.amountMinor ?? 0,
            currency:        event.currency ?? 'EUR',
            status:          event.status,
            raw_payload:     event.rawPayload,
          },
          { onConflict: 'restaurant_id,idempotency_key', ignoreDuplicates: false },
        )
    }

    // ── Ažuriraj source (rezervacija, folio, spa...) ─────────────────
    const sourceType = existing?.source_type ??
      ((event.rawPayload as Record<string, unknown>)?.data?.object?.metadata?.source_type as string | undefined)
    const sourceId   = existing?.source_id ??
      ((event.rawPayload as Record<string, unknown>)?.data?.object?.metadata?.source_id as string | undefined)

    if (sourceType && sourceId && event.status === 'paid') {
      await updateSource(supabase, sourceType, sourceId, event.amountMinor)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error('[webhook] error:', err.message)

    // Greške potpisa → 400 (Stripe ne retry-a)
    // Ostale greške → 500 (Stripe će retry-ati)
    const isSignatureError = err.message.includes('potpis') || err.message.includes('timestamp') || err.message.includes('Signature')
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status:  isSignatureError ? 400 : 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    )
  }
})

// ── Source update helper ────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function updateSource(supabase: any, sourceType: string, sourceId: string, amountMinor?: number) {
  try {
    if (sourceType === 'booking') {
      // Potvrdi rezervaciju — ne mijenjaj ako je već checked_in/out
      await supabase
        .from('hotel_reservations')
        .update({ payment_status: 'paid', status: 'confirmed' })
        .eq('id', sourceId)
        .in('status', ['pending', 'inquiry', 'pending_payment'])
    } else if (sourceType === 'folio') {
      const paidEur = amountMinor != null ? amountMinor / 100 : undefined
      await supabase
        .from('folios')
        .update({
          ...(paidEur != null ? { paid_amount: paidEur } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceId)
    } else if (sourceType === 'spa') {
      await supabase
        .from('spa_appointments')
        .update({ payment_status: 'paid' })
        .eq('id', sourceId)
    }
    console.log(`[webhook] updateSource: ${sourceType}/${sourceId} → paid`)
  } catch (err) {
    console.error('[webhook] updateSource error:', err.message)
  }
}
