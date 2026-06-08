// Šalje email vlasniku kad superadmin odobri/odbije tenant (approval flow).
// Poziva se iz SuperAdminPanel.setApproval nakon update-a approval_status.
// Body: { restaurant_id: string, status: 'approved' | 'rejected' }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API = 'https://api.resend.com/emails'
const FROM       = 'rest.by.me <noreply@send.restby.me>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildHtml(status: string, name: string, slug: string, siteUrl: string) {
  const approved = status === 'approved'
  const color = approved ? '#0d7a52' : '#c0392b'
  const banner = approved ? '✅ Nalog odobren' : 'Obavijest o nalogu'
  const body = approved
    ? `Dobre vijesti! Vaš nalog za <strong>${name}</strong> je odobren. Možete se prijaviti i početi sa
       postavkom. Vaša javna stranica <strong>${siteUrl.replace(/^https?:\/\//, '')}/${slug}</strong>
       postaje aktivna.`
    : `Hvala na interesovanju za rest.by.me. Nažalost, nalog za <strong>${name}</strong> trenutno nije
       odobren. Ako mislite da je riječ o grešci ili imate pitanja, slobodno nas kontaktirajte.`

  return `<!DOCTYPE html><html lang="sr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:${color};padding:26px 32px;text-align:center;">
    <div style="color:#fff;font-size:22px;font-weight:700;">rest.by.me</div>
    <div style="color:rgba(255,255,255,0.9);font-size:15px;margin-top:6px;">${banner}</div>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">${body}</p>
    ${approved ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${siteUrl}/login" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Prijavi se →</a>
    </div>` : `
    <div style="text-align:center;margin:24px 0;">
      <a href="mailto:info@restby.me" style="display:inline-block;background:#fff;color:${color};border:1px solid ${color};text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Kontaktiraj nas</a>
    </div>`}
    <p style="margin:0;color:#9ca3af;font-size:13px;">Za sva pitanja: <a href="mailto:info@restby.me" style="color:${color};">info@restby.me</a></p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">rest.by.me · Podgorica, Crna Gora</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY nije postavljen')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { restaurant_id, status } = await req.json()
    if (!restaurant_id || !['approved', 'rejected'].includes(status)) {
      return new Response(JSON.stringify({ error: 'restaurant_id i validan status su obavezni' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: rest, error: restErr } = await supabase
      .from('restaurants').select('name, slug, user_id').eq('id', restaurant_id).single()
    if (restErr || !rest?.user_id) {
      return new Response(JSON.stringify({ error: 'Restoran nije pronađen' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(rest.user_id)
    const email = authUser?.user?.email
    if (!email) {
      return new Response(JSON.stringify({ error: 'Vlasnik nema email' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://restby.me'
    const subject = status === 'approved'
      ? '✅ Nalog odobren — rest.by.me'
      : 'Obavijest o vašem nalogu — rest.by.me'

    const resendRes = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email], subject, html: buildHtml(status, rest.name, rest.slug, siteUrl) }),
    })
    const resendData = await resendRes.json()
    if (!resendRes.ok) {
      console.error('Resend error:', resendRes.status, resendData)
      return new Response(JSON.stringify({ error: 'Greška pri slanju', detail: resendData }), {
        status: resendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, email_id: resendData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-approval-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
