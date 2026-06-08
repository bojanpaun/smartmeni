import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'rest.by.me Spa <spa@send.restby.me>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmt(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sr-Latn', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function buildHtml(data: {
  spaName:       string
  guestName:     string
  serviceName:   string
  date:          string
  startTime:     string
  endTime:       string
  therapistName: string
  roomName:      string
  price:         number
  paymentMethod: string
  appointmentId: string
  logoUrl?:      string
  type:          'confirmed' | 'reminder' | 'cancelled'
}) {
  const { spaName, guestName, serviceName, date, startTime, endTime,
          therapistName, roomName, price, paymentMethod, appointmentId, logoUrl, type } = data

  const bannerColor = type === 'cancelled' ? '#c0392b' : type === 'reminder' ? '#2563eb' : '#0d7a52'
  const bannerText  = type === 'cancelled' ? '❌ Termin otkazan'
    : type === 'reminder' ? '🔔 Podsjetnik na vaš spa termin'
    : '✅ Spa termin potvrđen'

  const bodyText = type === 'cancelled'
    ? `Dragi/a ${guestName},<br><br>Vaš spa termin je otkazan. Ako imate pitanja, kontaktirajte nas.`
    : type === 'reminder'
    ? `Dragi/a ${guestName},<br><br>Podsjećamo vas na vaš spa termin koji počinje uskoro. Radujemo se vašem dolasku!`
    : `Dragi/a ${guestName},<br><br>Vaš spa termin je uspješno rezervisan. Radujemo se vašem dolasku!`

  const paymentLabel: Record<string, string> = {
    cash:  'Na recepciji',
    folio: 'Na račun sobe',
    card:  'Karticom',
  }

  return `<!DOCTYPE html>
<html lang="bs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

  <!-- Header -->
  <tr><td style="background:${bannerColor};padding:28px 32px;text-align:center;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${spaName}" style="max-height:48px;margin:0 auto 12px;display:block;">` : ''}
    <div style="color:#fff;font-size:22px;font-weight:700;">${spaName} — Spa & Wellness</div>
    <div style="color:rgba(255,255,255,.85);font-size:15px;margin-top:8px;">${bannerText}</div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">${bodyText}</p>

    <!-- Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Broj termina</div>
        <div style="font-family:monospace;font-size:14px;font-weight:600;color:#111827;">${appointmentId.slice(0,8).toUpperCase()}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Tretman</div>
        <div style="font-size:14px;font-weight:600;color:#111827;">💆 ${serviceName}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Datum i vrijeme</div>
        <div style="font-size:14px;color:#111827;">${fmt(date)}</div>
        <div style="font-size:15px;font-weight:700;color:#0d7a52;margin-top:3px;">🕐 ${startTime.slice(0,5)} – ${endTime.slice(0,5)}</div>
      </td></tr>
      ${therapistName ? `<tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Terapeut</div>
        <div style="font-size:14px;color:#111827;">👤 ${therapistName}</div>
      </td></tr>` : ''}
      ${roomName ? `<tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Kabina</div>
        <div style="font-size:14px;color:#111827;">🚪 ${roomName}</div>
      </td></tr>` : ''}
      <tr><td style="padding:14px 20px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Ukupno / Plaćanje</div>
        <div style="font-size:16px;font-weight:700;color:#111827;">€${Number(price).toFixed(2)} · ${paymentLabel[paymentMethod] || paymentMethod}</div>
      </td></tr>
    </table>

    ${type !== 'cancelled' ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#166534;line-height:1.5;">
        💡 <strong>Napomena:</strong> Molimo vas da stignete 5-10 minuta ranije kako biste se pripremili za tretman.
        ${paymentMethod === 'folio' ? 'Tretman će biti dodat na vaš hotelski račun.' : 'Plaćanje se vrši na recepciji spa centra.'}
      </div>
    </div>` : ''}

    <p style="color:#6b7280;font-size:12px;text-align:center;margin-top:24px;">
      Powered by <strong>RestByMe</strong>
    </p>
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
    const body = await req.json()
    const {
      to, spaName, guestName, serviceName, date, startTime, endTime,
      therapistName, roomName, price, paymentMethod, appointmentId,
      logoUrl, type = 'confirmed',
    } = body

    if (!to || !appointmentId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const subjectMap: Record<string, string> = {
      confirmed: `Spa termin potvrđen — ${serviceName}`,
      reminder:  `⏰ Podsjetnik: ${serviceName} u ${startTime?.slice(0,5)}`,
      cancelled: `Spa termin otkazan — ${serviceName}`,
    }

    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: FROM,
        to:   [to],
        subject: subjectMap[type] || `Spa termin — ${spaName}`,
        html: buildHtml({ spaName, guestName, serviceName, date, startTime, endTime,
          therapistName, roomName, price, paymentMethod, appointmentId, logoUrl, type }),
      }),
    })

    const result = await res.json()
    if (!res.ok) throw new Error(JSON.stringify(result))

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
