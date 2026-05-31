import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'RestByMe Spa <onboarding@resend.dev>'

function fmt(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('sr-Latn', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function buildReminderHtml(a: {
  restaurant_name: string
  logo_url:        string | null
  guest_name:      string
  service_name:    string
  appointment_date:string
  start_time:      string
  end_time:        string
  therapist_name:  string | null
  room_name:       string | null
  price:           number
  payment_method:  string
  appointment_id:  string
}) {
  const paymentLabel: Record<string, string> = {
    cash:  'Na recepciji', folio: 'Na račun sobe', card: 'Karticom',
  }
  return `<!DOCTYPE html>
<html lang="bs">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

  <tr><td style="background:#2563eb;padding:28px 32px;text-align:center;">
    ${a.logo_url ? `<img src="${a.logo_url}" alt="${a.restaurant_name}" style="max-height:48px;margin:0 auto 12px;display:block;">` : ''}
    <div style="color:#fff;font-size:22px;font-weight:700;">${a.restaurant_name} — Spa & Wellness</div>
    <div style="color:rgba(255,255,255,.85);font-size:15px;margin-top:8px;">🔔 Podsjetnik na vaš spa termin</div>
  </td></tr>

  <tr><td style="padding:32px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
      Dragi/a ${a.guest_name},<br><br>
      Podsjećamo vas na vaš spa termin koji počinje uskoro. Radujemo se vašem dolasku!
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Broj termina</div>
        <div style="font-family:monospace;font-size:14px;font-weight:600;color:#111827;">${a.appointment_id.slice(0,8).toUpperCase()}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Tretman</div>
        <div style="font-size:14px;font-weight:600;color:#111827;">💆 ${a.service_name}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Datum i vrijeme</div>
        <div style="font-size:14px;color:#111827;">${fmt(a.appointment_date)}</div>
        <div style="font-size:15px;font-weight:700;color:#2563eb;margin-top:3px;">🕐 ${a.start_time.slice(0,5)} – ${a.end_time.slice(0,5)}</div>
      </td></tr>
      ${a.therapist_name ? `<tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Terapeut</div>
        <div style="font-size:14px;color:#111827;">👤 ${a.therapist_name}</div>
      </td></tr>` : ''}
      ${a.room_name ? `<tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Kabina</div>
        <div style="font-size:14px;color:#111827;">🚪 ${a.room_name}</div>
      </td></tr>` : ''}
      <tr><td style="padding:14px 20px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Ukupno / Plaćanje</div>
        <div style="font-size:16px;font-weight:700;color:#111827;">€${Number(a.price).toFixed(2)} · ${paymentLabel[a.payment_method] || a.payment_method}</div>
      </td></tr>
    </table>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:13px;color:#1e40af;line-height:1.5;">
        💡 <strong>Napomena:</strong> Molimo vas da stignete 5-10 minuta ranije.
        ${a.payment_method === 'folio' ? 'Tretman će biti dodat na vaš hotelski račun.' : 'Plaćanje se vrši na recepciji spa centra.'}
      </div>
    </div>

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

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Pronađi termine kojima treba poslati podsjetnik:
    // - danas, status = confirmed, reminder_sent_at IS NULL
    // - start_time je za reminder_hours sati od sad (±15 min tolerancija)
    const { data: appointments, error } = await supabase
      .from('spa_appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        price,
        payment_method,
        external_guest_name,
        external_guest_email,
        hotel_reservation_id,
        restaurant_id,
        spa_services ( name ),
        spa_rooms    ( name ),
        spa_therapists (
          staff!staff_id ( first_name, last_name )
        ),
        restaurants ( name, logo_url ),
        hotel_reservations ( guest_name, guest_email )
      `)
      .eq('status', 'confirmed')
      .is('reminder_sent_at', null)
      .eq('appointment_date', new Date().toISOString().slice(0, 10))

    if (error) throw error

    let sent = 0
    const now = new Date()

    for (const appt of (appointments ?? [])) {
      // Učitaj reminder_hours za ovaj restoran iz spa_settings
      const { data: settings } = await supabase
        .from('spa_settings')
        .select('reminder_hours')
        .eq('restaurant_id', appt.restaurant_id)
        .maybeSingle()

      const reminderHours = settings?.reminder_hours ?? 2

      // Izračunaj kada bi podsjetnik trebao biti poslan
      const [h, m] = (appt.start_time as string).split(':').map(Number)
      const apptMs = new Date(appt.appointment_date + 'T00:00:00Z').getTime()
        + h * 3600000 + m * 60000
      const reminderMs = apptMs - reminderHours * 3600000
      const diffMin = (reminderMs - now.getTime()) / 60000

      // Šalji samo ako smo u prozoru ±15 min
      if (diffMin < -15 || diffMin > 15) continue

      // Odredi email primaoca
      const guestEmail: string | null =
        appt.external_guest_email ||
        (appt.hotel_reservations as any)?.guest_email || null

      const guestName: string =
        appt.external_guest_name ||
        (appt.hotel_reservations as any)?.guest_name ||
        'Gost'

      if (!guestEmail) continue

      const staffRow = (appt.spa_therapists as any)?.staff
      const therapistName = staffRow
        ? `${staffRow.first_name ?? ''} ${staffRow.last_name ?? ''}`.trim()
        : null

      const restorant = appt.restaurants as any

      const emailRes = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        },
        body: JSON.stringify({
          from: FROM,
          to:   [guestEmail],
          subject: `⏰ Podsjetnik: ${(appt.spa_services as any)?.name} u ${(appt.start_time as string).slice(0, 5)}`,
          html: buildReminderHtml({
            restaurant_name:  restorant?.name ?? '',
            logo_url:         restorant?.logo_url ?? null,
            guest_name:       guestName,
            service_name:     (appt.spa_services as any)?.name ?? '',
            appointment_date: appt.appointment_date as string,
            start_time:       appt.start_time as string,
            end_time:         appt.end_time as string,
            therapist_name:   therapistName,
            room_name:        (appt.spa_rooms as any)?.name ?? null,
            price:            Number(appt.price),
            payment_method:   appt.payment_method as string,
            appointment_id:   appt.id as string,
          }),
        }),
      })

      if (emailRes.ok) {
        await supabase
          .from('spa_appointments')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', appt.id)
        sent++
      }
    }

    return new Response(
      JSON.stringify({ ok: true, checked: appointments?.length ?? 0, sent }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
