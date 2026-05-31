import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'RestByMe Booking <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildHtml(data: {
  hotelName: string
  guestName: string
  type: 'confirmed' | 'cancelled' | 'checkin' | 'checkout'
  checkIn: string
  checkOut: string
  nights: number
  roomType: string
  totalAmount: number
  reservationId: string
  logoUrl?: string
  guestAppUrl?: string | null
  guestCode?: string
}) {
  const { hotelName, guestName, type, checkIn, checkOut, nights, roomType, totalAmount, reservationId, logoUrl, guestAppUrl, guestCode } = data

  const bannerColor: Record<string, string> = {
    confirmed: '#0d7a52',
    cancelled: '#c0392b',
    checkin:   '#2563eb',
    checkout:  '#7c3aed',
  }

  const bannerText: Record<string, string> = {
    confirmed: '✅ Rezervacija potvrđena',
    cancelled: '❌ Rezervacija otkazana',
    checkin:   '🏨 Check-in potvrđen',
    checkout:  '👋 Check-out — Hvala!',
  }

  const bodyText: Record<string, string> = {
    confirmed: `Dragi/a ${guestName},<br><br>Vaša rezervacija je uspješno potvrđena. Radujemo se Vašem dolasku!`,
    cancelled: `Dragi/a ${guestName},<br><br>Vaša rezervacija je otkazana. Ako imate pitanja, kontaktirajte nas.`,
    checkin:   `Dragi/a ${guestName},<br><br>Dobrodošli! Check-in je uspješno obavljen. Osoblje je dostupno na recepciji.`,
    checkout:  `Dragi/a ${guestName},<br><br>Hvala što ste boravili kod nas. Radujemo se Vašem ponovnom dolasku!`,
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const color = bannerColor[type]

  return `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:${color};padding:28px 32px;text-align:center;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${hotelName}" style="max-height:48px;margin-bottom:12px;display:block;margin:0 auto 12px;">` : ''}
    <div style="color:#fff;font-size:22px;font-weight:700;">${hotelName}</div>
    <div style="color:rgba(255,255,255,0.85);font-size:15px;margin-top:8px;">${bannerText[type]}</div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">${bodyText[type]}</p>

    <!-- Details box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Broj rezervacije</div>
        <div style="font-family:monospace;font-size:14px;font-weight:600;color:#111827;">${reservationId.slice(0,8).toUpperCase()}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Tip smještaja</div>
        <div style="font-size:14px;color:#111827;">${roomType}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:50%;padding-right:8px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Check-in</div>
              <div style="font-size:13px;color:#111827;">${fmt(checkIn)}</div>
            </td>
            <td style="width:50%;padding-left:8px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Check-out</div>
              <div style="font-size:13px;color:#111827;">${fmt(checkOut)}</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Broj noći</div>
              <div style="font-size:14px;color:#111827;">${nights}</div>
            </td>
            <td style="text-align:right;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Ukupan iznos</div>
              <div style="font-size:20px;font-weight:700;color:${color};">€${Number(totalAmount).toFixed(2)}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    ${type === 'confirmed' ? `
    <div style="background:#ecfdf5;border-left:3px solid #0d7a52;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:16px;">
      <p style="margin:0;font-size:13px;color:#065f46;">📋 Pri dolasku ponesите ovaj email i važeći identifikacioni dokument.</p>
    </div>` : ''}

    ${(type === 'confirmed' || type === 'checkin') && guestAppUrl ? `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:18px 20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#0369a1;">📱 Guest App — Online usluge</p>
      <p style="margin:0 0 14px;font-size:13px;color:#0c4a6e;line-height:1.5;">
        Pristupite online uslugama hotela: pregled folija, zahtjevi sobi i informacije o hotelu.
      </p>
      <p style="margin:0 0 10px;font-size:12px;color:#64748b;">
        Vaš kod: <strong style="font-family:monospace;font-size:15px;letter-spacing:0.1em;color:#0369a1;">${guestCode}</strong>
      </p>
      <a href="${guestAppUrl}" style="display:inline-block;background:#0d7a52;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:600;">
        Otvori Guest App →
      </a>
    </div>` : ''}

    <p style="margin:0;color:#9ca3af;font-size:13px;">Za sva pitanja kontaktirajte recepciju hotela.</p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Automatski generisan email • <strong>${hotelName}</strong></p>
    <p style="margin:5px 0 0;font-size:11px;color:#d1d5db;">Powered by <strong>RestByMe</strong></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY nije postavljen')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { reservation_id, type = 'confirmed' } = await req.json()

    if (!reservation_id) {
      return new Response(JSON.stringify({ error: 'reservation_id obavezan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: res, error: resErr } = await supabase
      .from('hotel_reservations')
      .select(`
        id, check_in_date, check_out_date, total_amount,
        guest_name, guest_email,
        room_types ( name ),
        restaurants ( name, logo_url, slug )
      `)
      .eq('id', reservation_id)
      .single()

    if (resErr || !res) {
      return new Response(JSON.stringify({ error: 'Rezervacija nije pronađena' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!res.guest_email) {
      return new Response(JSON.stringify({ error: 'Gost nema email adresu' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nights = Math.round(
      (new Date(res.check_out_date).getTime() - new Date(res.check_in_date).getTime()) / 86_400_000
    )

    const hotelName  = (res.restaurants as any)?.name ?? 'Hotel'
    const logoUrl    = (res.restaurants as any)?.logo_url ?? ''
    const hotelSlug  = (res.restaurants as any)?.slug ?? ''
    const roomType   = (res.room_types as any)?.name ?? 'Smještaj'
    const guestName  = res.guest_name ?? 'Gost'
    const guestCode  = res.id.slice(0, 8).toUpperCase()
    const guestAppUrl = hotelSlug
      ? `${Deno.env.get('SITE_URL') ?? 'https://rest.by.me'}/${hotelSlug}/guest`
      : null

    const subjects: Record<string, string> = {
      confirmed: `✅ Potvrda rezervacije — ${hotelName}`,
      cancelled: `❌ Otkazana rezervacija — ${hotelName}`,
      checkin:   `🏨 Check-in potvrđen — ${hotelName}`,
      checkout:  `👋 Hvala na posjeti — ${hotelName}`,
    }

    const html = buildHtml({
      hotelName, guestName, type,
      checkIn: res.check_in_date,
      checkOut: res.check_out_date,
      nights, roomType,
      totalAmount: res.total_amount ?? 0,
      reservationId: res.id,
      logoUrl,
      guestAppUrl,
      guestCode,
    })

    const resendRes = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to:   [res.guest_email],
        subject: subjects[type] ?? subjects.confirmed,
        html,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('Resend error:', resendData)
      return new Response(JSON.stringify({ error: 'Greška pri slanju', detail: resendData }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, email_id: resendData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-booking-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
