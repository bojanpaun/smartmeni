// booking-finalize — PAY-10
// Poziva se na success redirect od Stripe/Monri
// 1. Verifikuje da je plaćanje stvarno završeno (getStatus)
// 2. Provjerava idempotency (nije li webhook već kreirao rezervaciju)
// 3. Kreira rezervaciju via create_booking_direct RPC
// 4. Ažurira payment_transactions.source_id
// 5. Šalje email potvrde

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
      session_id,        // Stripe Checkout Session ID (cs_...)
      idempotency_key,   // iz sessionStorage — za idempotency lookup
      restaurant_id,
      room_type_id,
      rate_plan_id,
      package_name,
      check_in,
      check_out,
      adults,
      children,
      guest_name,
      guest_email,
      guest_phone,
      special_requests,
      price_per_night,
      total_amount,
      booking_mode,
    } = await req.json()

    if (!session_id || !restaurant_id) {
      return errResp(400, 'Nedostaju obavezna polja: session_id, restaurant_id')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── 1. Provjera payment statusa ─────────────────────────────────
    const config = await getActiveTenantConfig(supabase, restaurant_id)
    if (!config) return errResp(422, 'Nema aktivnog payment provajdera')

    const credentials = await getCredentials(supabase, config.id)
    const provider    = getProvider(config, credentials)
    const status      = await provider.getStatus(session_id)

    if (status !== 'paid') {
      return errResp(402, `Plaćanje nije završeno (status: ${status})`)
    }

    // ── 2. Idempotency — provjeri da li je rezervacija već kreirana ──
    // Webhook može prethoditi redirect-u — ne kreirati duplikate
    if (idempotency_key) {
      const { data: existing } = await supabase
        .from('payment_transactions')
        .select('source_id, status')
        .eq('restaurant_id', restaurant_id)
        .eq('idempotency_key', idempotency_key)
        .maybeSingle()

      if (existing?.source_id) {
        // Webhook je već kreirao rezervaciju — vrati podatke o njoj
        const { data: res } = await supabase
          .from('hotel_reservations')
          .select('id, guest_name, guest_email, check_in_date, check_out_date, total_amount, room_type_id')
          .eq('id', existing.source_id)
          .single()

        const { data: rt } = await supabase
          .from('room_types').select('name').eq('id', res?.room_type_id).single()

        return new Response(JSON.stringify({
          reservation_id:   res?.id,
          guest_name:       res?.guest_name,
          guest_email:      res?.guest_email,
          room_type_name:   rt?.name ?? '',
          check_in:         res?.check_in_date,
          check_out:        res?.check_out_date,
          total_amount:     res?.total_amount,
          booking_mode:     'immediate',
        }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
    }

    // ── 3. Kreiraj rezervaciju ──────────────────────────────────────
    const reservationStatus = (booking_mode === 'manual') ? 'inquiry' : 'confirmed'

    const { data: reservation, error: resError } = await supabase.rpc('create_booking_direct', {
      p_restaurant_id:    restaurant_id,
      p_room_type_id:     room_type_id,
      p_rate_plan_id:     rate_plan_id ?? null,
      p_package_name:     package_name ?? null,
      p_check_in:         check_in,
      p_check_out:        check_out,
      p_adults:           adults ?? 1,
      p_children:         children ?? 0,
      p_guest_name:       guest_name,
      p_guest_email:      guest_email,
      p_guest_phone:      guest_phone ?? null,
      p_special_requests: special_requests ?? null,
      p_price_per_night:  price_per_night,
      p_total_amount:     total_amount,
      p_status:           reservationStatus,
    })

    if (resError || !reservation?.reservation_id) {
      console.error('[finalize] create_booking_direct error:', resError)
      return errResp(500, resError?.message ?? 'Greška pri kreiranju rezervacije')
    }

    const reservationId = reservation.reservation_id

    // ── 4. Ažuriraj payment_transaction sa source_id ────────────────
    await supabase
      .from('payment_transactions')
      .update({
        status:     'paid',
        source_id:  reservationId,
        updated_at: new Date().toISOString(),
      })
      .eq('restaurant_id', restaurant_id)
      .or(
        idempotency_key
          ? `idempotency_key.eq.${idempotency_key}`
          : `provider_ref.eq.${session_id}`,
      )

    // ── 5. Ažuriraj payment_status na rezervaciji ───────────────────
    await supabase
      .from('hotel_reservations')
      .update({ payment_status: 'paid', paid_amount: total_amount })
      .eq('id', reservationId)

    // ── 6. Email potvrde (fire-and-forget) ──────────────────────────
    const emailType = booking_mode === 'manual' ? 'received' : 'confirmed'
    fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-booking-email`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reservation_id: reservationId, type: emailType }),
      },
    ).catch(e => console.warn('[finalize] email error (non-critical):', e))

    // Dohvati naziv tipa sobe za potvrdu
    const { data: rt } = await supabase
      .from('room_types').select('name').eq('id', room_type_id).single()

    return new Response(JSON.stringify({
      reservation_id: reservationId,
      guest_name,
      guest_email,
      room_type_name: rt?.name ?? '',
      check_in,
      check_out,
      total_amount,
      booking_mode: booking_mode ?? 'immediate',
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[finalize] error:', err.message)
    return errResp(500, err.message)
  }
})
