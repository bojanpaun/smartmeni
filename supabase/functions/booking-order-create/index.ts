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
      restaurant_id, room_type_id,
      check_in, check_out, adults,
      guest_name, guest_email,
      total_amount, return_url, cancel_url,
    } = body

    if (!restaurant_id || !room_type_id || !check_in || !check_out || !total_amount) {
      return new Response(JSON.stringify({ error: 'Nedostaju obavezna polja' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Verify restaurant exists and room_type belongs to it
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: rt } = await supabase
      .from('room_types')
      .select('id, name')
      .eq('id', room_type_id)
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .single()

    if (!rt) {
      return new Response(JSON.stringify({ error: 'Tip sobe nije dostupan' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const nights = Math.ceil(
      (new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000
    )

    const token = await getToken()

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `booking-${restaurant_id}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `${room_type_id}|${check_in}|${check_out}`,
          description: `${rt.name} · ${nights} noći · ${check_in} — ${check_out}`,
          custom_id: JSON.stringify({ restaurant_id, room_type_id, check_in, check_out, adults, guest_email }),
          amount: {
            currency_code: 'EUR',
            value: Number(total_amount).toFixed(2),
          },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'SmartMeni',
              locale: 'hr-HR',
              landing_page: 'NO_PREFERENCE',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'PAY_NOW',
              return_url: return_url,
              cancel_url: cancel_url,
            },
          },
        },
      }),
    })

    const order = await orderRes.json()

    if (!order.id) {
      console.error('PayPal order error:', JSON.stringify(order))
      return new Response(JSON.stringify({ error: 'Greška pri kreiranju PayPal narudžbe', detail: order }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const approveLink = order.links?.find((l: any) => l.rel === 'payer-action')?.href
      || order.links?.find((l: any) => l.rel === 'approve')?.href

    return new Response(JSON.stringify({
      order_id: order.id,
      approve_url: approveLink,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
