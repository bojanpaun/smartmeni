import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Email potvrda rental (smještaj) rezervacije. Ogledalo send-booking-email (hotel), ali
// čita rental_bookings + smještaj + instrukcije za samostalan check-in + depozit. Jezik
// crnogorski (kao send-booking-email); i18n emaila = kasnije. FROM/RESEND ključ dijeljeni.

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'rest.by.me <rezervacije@send.restby.me>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildHtml(d: {
  venueName: string; guestName: string; assetName: string;
  checkIn: string; checkOut: string; nights: number;
  total: number; deposit: number; paidStatus: string;
  bookingId: string; logoUrl?: string; checkInInstructions?: string | null;
}) {
  const fmt = (s: string) => new Date(s).toLocaleDateString('sr-Latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const color = '#0d7a52'
  const balance = Math.max(0, Number(d.total) - Number(d.deposit))
  return `<!DOCTYPE html><html lang="sr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:${color};padding:28px 32px;text-align:center;">
    ${d.logoUrl ? `<img src="${d.logoUrl}" alt="${d.venueName}" style="max-height:48px;display:block;margin:0 auto 12px;">` : ''}
    <div style="color:#fff;font-size:22px;font-weight:700;">${d.venueName}</div>
    <div style="color:rgba(255,255,255,0.85);font-size:15px;margin-top:8px;">✅ Rezervacija potvrđena</div>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">Dragi/a ${d.guestName},<br><br>Vaša rezervacija smještaja je potvrđena. Radujemo se Vašem dolasku!</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Broj rezervacije</div>
        <div style="font-family:monospace;font-size:14px;font-weight:600;color:#111827;">${d.bookingId.slice(0,8).toUpperCase()}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Smještaj</div>
        <div style="font-size:14px;color:#111827;">${d.assetName}</div>
      </td></tr>
      <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="width:50%;padding-right:8px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Dolazak</div>
            <div style="font-size:13px;color:#111827;">${fmt(d.checkIn)}</div></td>
          <td style="width:50%;padding-left:8px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Odlazak</div>
            <div style="font-size:13px;color:#111827;">${fmt(d.checkOut)}</div></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Broj noći</div>
            <div style="font-size:14px;color:#111827;">${d.nights}</div></td>
          <td style="text-align:right;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:3px;">Ukupno</div>
            <div style="font-size:20px;font-weight:700;color:${color};">€${Number(d.total).toFixed(2)}</div></td>
        </tr></table>
      </td></tr>
    </table>

    ${Number(d.deposit) > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:10px 16px;background:#ecfdf5;border-radius:8px 0 0 8px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#065f46;">Depozit ${d.paidStatus === 'paid' || d.paidStatus === 'partial' ? '(plaćeno)' : ''}</div>
          <div style="font-size:16px;font-weight:700;color:#065f46;">€${Number(d.deposit).toFixed(2)}</div></td>
        <td style="padding:10px 16px;background:#f9fafb;border-radius:0 8px 8px 0;text-align:right;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;">Ostatak na dolasku</div>
          <div style="font-size:16px;font-weight:700;color:#111827;">€${balance.toFixed(2)}</div></td>
      </tr>
    </table>` : ''}

    ${d.checkInInstructions ? `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#0369a1;">🔑 Instrukcije za dolazak / samostalan check-in</p>
      <p style="margin:0;font-size:13px;color:#0c4a6e;line-height:1.6;white-space:pre-line;">${d.checkInInstructions}</p>
    </div>` : ''}

    <p style="margin:0;color:#9ca3af;font-size:13px;">Za sva pitanja kontaktirajte domaćina.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">Automatski generisan email • <strong>${d.venueName}</strong></p>
    <p style="margin:5px 0 0;font-size:11px;color:#d1d5db;">Powered by <strong>RestByMe</strong></p>
  </td></tr>
</table></td></tr></table></body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY nije postavljen')
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { booking_id } = await req.json()
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id obavezan' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: bk, error: bErr } = await supabase
      .from('rental_bookings')
      .select(`id, start_date, end_date, total_amount, deposit, payment_status, guest_name, guest_email, restaurant_id, asset_id,
               rental_assets ( name, rental_accommodation_details ( check_in_instructions ) ),
               restaurants ( name, logo_url )`)
      .eq('id', booking_id)
      .single()

    if (bErr || !bk) {
      return new Response(JSON.stringify({ error: 'Rezervacija nije pronađena' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (!bk.guest_email) {
      return new Response(JSON.stringify({ error: 'Gost nema email adresu' }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Instrukcije: asset-specifične → fallback na rental_settings default.
    let instructions = (bk.rental_assets as any)?.rental_accommodation_details?.check_in_instructions
      ?? (bk.rental_assets as any)?.rental_accommodation_details?.[0]?.check_in_instructions ?? null
    if (!instructions) {
      const { data: rs } = await supabase.from('rental_settings')
        .select('default_check_in_instructions').eq('restaurant_id', bk.restaurant_id).maybeSingle()
      instructions = rs?.default_check_in_instructions ?? null
    }

    const nights = Math.round((new Date(bk.end_date).getTime() - new Date(bk.start_date).getTime()) / 86_400_000)
    const venueName = (bk.restaurants as any)?.name ?? 'Smještaj'

    const html = buildHtml({
      venueName, guestName: bk.guest_name ?? 'Gost',
      assetName: (bk.rental_assets as any)?.name ?? 'Smještaj',
      checkIn: bk.start_date, checkOut: bk.end_date, nights,
      total: bk.total_amount ?? 0, deposit: bk.deposit ?? 0, paidStatus: bk.payment_status ?? 'pending',
      bookingId: bk.id, logoUrl: (bk.restaurants as any)?.logo_url ?? '', checkInInstructions: instructions,
    })

    const resendRes = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [bk.guest_email], subject: `✅ Potvrda rezervacije — ${venueName}`, html }),
    })
    const resendData = await resendRes.json()
    if (!resendRes.ok) {
      console.error('Resend error:', resendRes.status, resendData)
      return new Response(JSON.stringify({ error: 'Greška pri slanju', detail: resendData }), { status: resendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ ok: true, email_id: resendData.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('send-rental-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
