// PAY-5 — payments-create-session
// Router koji bira aktivnog payment provajdera za tenant i kreira checkout sesiju
// Vraća redirectUrl + upisuje pending red u payment_transactions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, getActiveTenantConfig, getCredentials } from '../_shared/payments/registry.ts'
import type { SessionCtx } from '../_shared/payments/types.ts'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function errResp(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const {
      restaurantId,
      sourceType,           // 'booking' | 'folio' | 'order' | 'spa'
      sourceId,             // rezervacija/folio ID (može biti null za booking koji se kreira tek na webhookу)
      amountMinor,          // u centima (npr. 10000 = 100.00 EUR)
      currency = 'EUR',
      idempotencyKey,       // unique string koji sprečava duplu naplatu
      successUrl,
      cancelUrl,
      description,
      metadata,
    } = await req.json()

    // Validacija
    if (!restaurantId || !sourceType || !amountMinor || !idempotencyKey || !successUrl || !cancelUrl) {
      return errResp(400, 'Nedostaju obavezna polja: restaurantId, sourceType, amountMinor, idempotencyKey, successUrl, cancelUrl')
    }
    if (!['booking', 'folio', 'order', 'spa'].includes(sourceType)) {
      return errResp(400, `Nepoznat sourceType: ${sourceType}`)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Dohvati aktivan/default payment config za tenant
    const config = await getActiveTenantConfig(supabase, restaurantId)
    if (!config) {
      return errResp(422, 'Nema aktivnog payment provajdera. Admin mora konfigurisati plaćanja na /admin/hotel/payment.')
    }

    // 2. Dohvati kredencijale iz payment_credentials (service_role — bypass RLS)
    const credentials = await getCredentials(supabase, config.id)
    if (!credentials.secret_key && !credentials.merchant_key) {
      return errResp(422, 'Payment kredencijali nisu postavljeni za ovog provajdera.')
    }

    // 3. Kreiraj checkout sesiju preko provajdera
    const provider = getProvider(config, credentials)
    const ctx: SessionCtx = {
      restaurantId,
      sourceType,
      sourceId:       sourceId ?? '',
      amountMinor:    Number(amountMinor),
      currency,
      idempotencyKey,
      successUrl,
      cancelUrl,
      description,
      metadata,
    }

    const session = await provider.createCheckoutSession(ctx)

    // 4. Upiši pending transakciju — UPSERT na idempotency_key (sigurno pri retry-u)
    const { error: txError } = await supabase
      .from('payment_transactions')
      .upsert(
        {
          restaurant_id:   restaurantId,
          provider:        config.provider,
          provider_ref:    session.providerRef,
          idempotency_key: idempotencyKey,
          source_type:     sourceType,
          source_id:       sourceId ?? null,
          amount_minor:    Number(amountMinor),
          currency,
          status:          'pending',
        },
        { onConflict: 'restaurant_id,idempotency_key', ignoreDuplicates: false },
      )

    if (txError) {
      // Nije fatalno — transakcija se može kreirati pri webhookу ako insert ovdje zakaže
      console.error('[create-session] tx upsert error:', txError.message)
    }

    return new Response(
      JSON.stringify({
        redirectUrl:  session.redirectUrl,
        clientSecret: session.clientSecret,
        formPost:     session.formPost,   // Monri: POST auto-submit; Stripe: undefined
        providerRef:  session.providerRef,
        provider:     config.provider,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error('[create-session] error:', err.message)
    return errResp(500, err.message)
  }
})
