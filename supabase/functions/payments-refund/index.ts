// PAY-12 — payments-refund
// Pun ili djelimičan refund za Stripe (Monri stub — zahtijeva merchant API pristup)
//
// Može se pozivati:
//   - po transactionId (direktno iz admin UI)
//   - po sourceType + sourceId (folio, booking, spa)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, getActiveTenantConfig, getCredentials } from '../_shared/payments/registry.ts'

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
      transactionId,   // direktno po ID-u transakcije
      sourceType,      // 'booking' | 'folio' | 'spa' — alternativa za lookup
      sourceId,        // folio_id, reservation_id, ...
      amountMinor,     // undefined = pun refund; broj = djelimičan refund
      reason = 'Refund',
    } = await req.json()

    if (!restaurantId) return errResp(400, 'Nedostaje restaurantId')
    if (!transactionId && !(sourceType && sourceId)) {
      return errResp(400, 'Potreban transactionId ili sourceType+sourceId')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 1. Pronađi transakciju ──────────────────────────────────────
    let query = supabase
      .from('payment_transactions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid')  // samo plaćene se mogu refundovati

    if (transactionId) {
      query = query.eq('id', transactionId)
    } else {
      query = query.eq('source_type', sourceType).eq('source_id', sourceId)
    }

    const { data: tx, error: txErr } = await query.maybeSingle()

    if (txErr || !tx) {
      return errResp(404, 'Plaćena transakcija nije pronađena')
    }

    // ── 2. Validacija iznosa ────────────────────────────────────────
    const refundMinor = amountMinor ?? tx.amount_minor
    if (refundMinor <= 0 || refundMinor > tx.amount_minor) {
      return errResp(400, `Iznos refunda mora biti između 1 i ${tx.amount_minor} centi`)
    }

    // ── 3. Dohvati provajdera i kredencijale ────────────────────────
    const config = await getActiveTenantConfig(supabase, restaurantId)
    if (!config) return errResp(422, 'Nema aktivnog payment provajdera')

    const credentials = await getCredentials(supabase, config.id)
    const provider    = getProvider(config, credentials)

    // ── 4. Izvrši refund ────────────────────────────────────────────
    const result = await provider.refund(tx.provider_ref, refundMinor)

    if (!result.success) {
      return errResp(502, 'Refund nije uspio kod payment provajdera')
    }

    // ── 5. Ažuriraj payment_transactions ───────────────────────────
    const isPartial    = refundMinor < tx.amount_minor
    const newTxStatus  = isPartial ? 'partially_refunded' : 'refunded'

    await supabase
      .from('payment_transactions')
      .update({ status: newTxStatus, updated_at: new Date().toISOString() })
      .eq('id', tx.id)

    // ── 6. Ažuriraj source ──────────────────────────────────────────
    if (tx.source_type === 'booking' && tx.source_id) {
      await supabase
        .from('hotel_reservations')
        .update({
          payment_status: isPartial ? 'partially_refunded' : 'refunded',
          ...(isPartial ? {} : { status: 'cancelled' }),
        })
        .eq('id', tx.source_id)

      // Vrati dostupnost sobe ako je puni refund (otkazivanje)
      if (!isPartial) {
        const { data: res } = await supabase
          .from('hotel_reservations')
          .select('room_type_id, check_in_date, check_out_date')
          .eq('id', tx.source_id)
          .single()

        if (res?.room_type_id) {
          // Povećaj available_rooms za svaki datum rezervacije
          const dates: string[] = []
          const d = new Date(res.check_in_date)
          const end = new Date(res.check_out_date)
          while (d < end) {
            dates.push(d.toISOString().slice(0, 10))
            d.setDate(d.getDate() + 1)
          }
          for (const date of dates) {
            await supabase.rpc('fn_restore_room_availability', {
              p_room_type_id: res.room_type_id,
              p_date: date,
            }).catch(() => {}) // non-critical — loguj ali nastavi
          }
        }
      }
    } else if (tx.source_type === 'folio' && tx.source_id) {
      const refundEur = result.amountMinor / 100
      const { data: folio } = await supabase
        .from('folios').select('paid_amount').eq('id', tx.source_id).single()
      const newPaid = Math.max(0, (parseFloat(folio?.paid_amount ?? 0)) - refundEur)
      await supabase
        .from('folios')
        .update({ paid_amount: newPaid, updated_at: new Date().toISOString() })
        .eq('id', tx.source_id)
    } else if (tx.source_type === 'spa' && tx.source_id) {
      await supabase
        .from('spa_appointments')
        .update({ payment_status: isPartial ? 'partially_refunded' : 'refunded' })
        .eq('id', tx.source_id)
    }

    console.log(`[refund] OK: ${tx.provider_ref} | ${refundMinor} centi | ${newTxStatus}`)

    return new Response(
      JSON.stringify({
        success:         true,
        refundedMinor:   result.amountMinor,
        refundedEur:     (result.amountMinor / 100).toFixed(2),
        transactionStatus: newTxStatus,
        providerRef:     result.providerRef,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error('[refund] error:', err.message)
    return errResp(500, err.message)
  }
})
