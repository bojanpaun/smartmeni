// Šalje email notifikacije za trial period:
//   - 7 dana prije isteka triala (subscriptions.trial_ends_at)
//   - Na dan isteka triala bez plaćanja — downgrade na starter + email
// Poziva se iz pg_cron joba svaki dan u 08:00

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL        = Deno.env.get('APP_URL') || 'https://rest.by.me'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'RestByMe <noreply@restby.me>',
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) console.error('Resend error:', await res.text())
  return res.ok
}

function reminderEmail(restaurantName: string, daysLeft: number): string {
  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a2e26;">
      <div style="margin-bottom:24px;">
        <span style="font-size:22px;font-weight:700;color:#0d7a52;">smart<span style="color:#1a2e26">meni</span></span>
      </div>
      <h1 style="font-size:20px;font-weight:600;margin-bottom:12px;">
        Vaš trial ističe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}
      </h1>
      <p style="font-size:14px;color:#5a7a6a;line-height:1.6;margin-bottom:20px;">
        Zdravo, <strong>${restaurantName}</strong>!<br><br>
        Vaš besplatni trial period za RestByMe Pro ističe za
        <strong>${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}</strong>.
        Nakon isteka, nalog će biti prebačen na Starter plan.
      </p>
      <div style="background:#f0faf6;border:1px solid #9fd4bc;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:#0a4f35;margin-bottom:8px;">Šta gubite prelaskom na Starter:</div>
        <ul style="font-size:13px;color:#3d7a60;margin:0;padding-left:18px;line-height:1.8;">
          <li>Neograničene stavke menija</li>
          <li>Napredna analitika i izvještaji</li>
          <li>Predlošci i brending</li>
          <li>Prioritetna podrška</li>
        </ul>
      </div>
      <a href="${APP_URL}/admin/billing"
         style="display:inline-block;background:#0d7a52;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        Pređi na Pro — €19/god →
      </a>
      <p style="font-size:12px;color:#8a9e96;margin-top:32px;line-height:1.5;">
        Pitanja? <a href="mailto:support@restby.me" style="color:#0d7a52;">support@restby.me</a>
      </p>
    </div>
  `
}

function expiredEmail(restaurantName: string): string {
  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a2e26;">
      <div style="margin-bottom:24px;">
        <span style="font-size:22px;font-weight:700;color:#0d7a52;">smart<span style="color:#1a2e26">meni</span></span>
      </div>
      <h1 style="font-size:20px;font-weight:600;margin-bottom:12px;">
        Trial period istekao — prešli ste na Starter
      </h1>
      <p style="font-size:14px;color:#5a7a6a;line-height:1.6;margin-bottom:20px;">
        Zdravo, <strong>${restaurantName}</strong>!<br><br>
        Vaš RestByMe trial period je istekao. Prebačeni ste na besplatni Starter plan.
        Svi vaši podaci su sačuvani — možete se nadograditi u bilo kom trenutku.
      </p>
      <a href="${APP_URL}/admin/billing"
         style="display:inline-block;background:#0d7a52;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        Aktiviraj Pro →
      </a>
      <p style="font-size:12px;color:#8a9e96;margin-top:32px;line-height:1.5;">
        Pitanja? <a href="mailto:support@restby.me" style="color:#0d7a52;">support@restby.me</a>
      </p>
    </div>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const in7Days = new Date(now)
    in7Days.setDate(in7Days.getDate() + 7)

    const todayStart = now.toISOString().slice(0, 10) + 'T00:00:00Z'
    const todayEnd   = now.toISOString().slice(0, 10) + 'T23:59:59Z'
    const in7Start   = in7Days.toISOString().slice(0, 10) + 'T00:00:00Z'
    const in7End     = in7Days.toISOString().slice(0, 10) + 'T23:59:59Z'

    // 1. Trialing subscriptions koje ističu za tačno 7 dana
    const { data: trialSoon } = await supabase
      .from('subscriptions')
      .select('restaurant_id, trial_ends_at, restaurants(name, user_id)')
      .eq('status', 'trialing')
      .gte('trial_ends_at', in7Start)
      .lt('trial_ends_at', in7End)

    // 2. Trialing subscriptions kojima je trial istekao danas → downgrade
    const { data: justExpired } = await supabase
      .from('subscriptions')
      .select('id, restaurant_id, restaurants(name, user_id)')
      .eq('status', 'trialing')
      .lt('trial_ends_at', todayStart)

    let remindersSent = 0
    let expiredCount  = 0

    // Šalji reminder emailove (7 dana)
    for (const sub of (trialSoon ?? [])) {
      const rest = (sub as any).restaurants
      if (!rest?.user_id) continue

      const { data: authUser } = await supabase.auth.admin.getUserById(rest.user_id)
      const email = authUser?.user?.email
      if (!email) continue

      const sent = await sendEmail(email, 'RestByMe: Vaš trial ističe za 7 dana', reminderEmail(rest.name, 7))
      if (sent) remindersSent++
    }

    // Downgrade isteklih triala → starter + email
    for (const sub of (justExpired ?? [])) {
      const rest = (sub as any).restaurants
      if (!rest?.user_id) continue

      // Downgrade na starter
      await supabase.from('subscriptions')
        .update({
          status:        'active',
          plan:          'starter',
          trial_ends_at: null,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', (sub as any).id)

      const { data: authUser } = await supabase.auth.admin.getUserById(rest.user_id)
      const email = authUser?.user?.email
      if (email) {
        await sendEmail(email, 'RestByMe: Trial period istekao', expiredEmail(rest.name))
      }
      expiredCount++
    }

    return new Response(
      JSON.stringify({ success: true, remindersSent, expiredDowngraded: expiredCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('send-trial-reminder error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
