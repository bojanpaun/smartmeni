import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')!
const PAYPAL_SECRET    = Deno.env.get('PAYPAL_SECRET')!
const PAYPAL_BASE      = 'https://api-m.sandbox.paypal.com'

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getToken() {
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  return (await res.json()).access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const {
      paypal_order_id,
      restaurant_id, room_type_id,
      check_in, check_out,
      adults, children,
      guest_name, guest_email, guest_phone,
      special_requests,
      price_per_night, total_amount,
      booking_mode = 'immediate',
    } = body

    const isManual = booking_mode === 'manual'
    const reservationStatus = isManual ? 'inquiry' : 'confirmed'
    const emailType = isManual ? 'received' : 'confirmed'

    if (!paypal_order_id || !restaurant_id || !room_type_id) {
      return new Response(JSON.stringify({ error: 'Nedostaju obavezna polja' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const token = await getToken()

    // Capture the PayPal order
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypal_order_id}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    const capture = await captureRes.json()
    console.log('PayPal capture:', JSON.stringify(capture))

    if (capture.status !== 'COMPLETED') {
      return new Response(JSON.stringify({ error: 'Plaćanje nije uspjelo', detail: capture }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const captureId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Get room_type name for confirmation
    const { data: rt } = await supabase
      .from('room_types')
      .select('id, name')
      .eq('id', room_type_id)
      .single()

    // Auto-assign soba — sprečava duplo bukiranje
    const { data: autoRoom } = await supabase
      .rpc('fn_auto_assign_room', {
        p_restaurant_id: restaurant_id,
        p_room_type_id:  room_type_id,
        p_check_in:      check_in,
        p_check_out:     check_out,
      })

    if (!autoRoom) {
      // Race condition: PayPal naplata prošla ali nema slobodnih soba
      // Log upozorenje — admin mora ručno dodijeliti sobu
      console.warn('WARN: auto_assign_room vratio null — nema slobodnih soba, room_id ostaje null')
    }

    // Kreirati rezervaciju — status zavisi od booking_mode
    const { data: reservation, error: resError } = await supabase
      .from('hotel_reservations')
      .insert({
        restaurant_id,
        room_type_id,
        room_id: autoRoom ?? null,
        guest_name,
        guest_email,
        guest_phone: guest_phone || null,
        adults: adults ?? 1,
        children: children ?? 0,
        check_in_date: check_in,
        check_out_date: check_out,
        rate_per_night: price_per_night,
        total_amount,
        paid_amount: total_amount,
        payment_status: 'paid',
        status: reservationStatus,
        source: 'online',
        special_requests: special_requests || null,
      })
      .select('id')
      .single()

    if (resError || !reservation) {
      console.error('Reservation insert error:', resError)
      return new Response(JSON.stringify({ error: 'Greška pri kreiranju rezervacije', detail: resError?.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Record the payment
    await supabase.from('booking_payments').insert({
      reservation_id: reservation.id,
      restaurant_id,
      paypal_order_id,
      paypal_capture_id: captureId,
      amount: total_amount,
      currency: 'EUR',
      status: 'completed',
      payload: capture,
    })

    // Pošalji email (fire-and-forget) — tip zavisi od booking_mode
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-booking-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reservation_id: reservation.id, type: emailType }),
    }).catch(e => console.warn('Email send failed (non-critical):', e))

    return new Response(JSON.stringify({
      reservation_id: reservation.id,
      guest_name,
      guest_email,
      room_type_name: rt?.name ?? '',
      check_in,
      check_out,
      total_amount,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
