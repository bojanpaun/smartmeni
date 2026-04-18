// ▶ Novi fajl: supabase/functions/send-trial-reminder/index.ts
// Šalje email notifikacije:
//   - 7 dana prije isteka triala
//   - Na dan suspenzije (plan istekao)
// Poziva se iz pg_cron joba svaki dan

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://smartmeni.me'

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
      from: 'SmartMeni <noreply@smartmeni.me>',
      to,
      subject,
      html,
    }),
  })
  return res.ok
}

function reminderEmail(restaurantName: string, daysLeft: number): string {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a2e26;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 22px; font-weight: 700; color: #0d7a52;">smart<span style="color:#1a2e26">meni</span></span>
      </div>
      <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">
        Vaš trial ističe za ${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}
      </h1>
      <p style="font-size: 14px; color: #5a7a6a; line-height: 1.6; margin-bottom: 20px;">
        Zdravo, <strong>${restaurantName}</strong>!<br><br>
        Vaš besplatni trial period za SmartMeni Pro ističe za <strong>${daysLeft} ${daysLeft === 1 ? 'dan' : 'dana'}</strong>.
        Nakon isteka, vaš nalog će biti prebačen na Starter plan (do 30 stavki menija).
      </p>
      <div style="background: #f0faf6; border: 1px solid #9fd4bc; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 600; color: #0a4f35; margin-bottom: 8px;">Šta gubite prelaskom na Starter:</div>
        <ul style="font-size: 13px; color: #3d7a60; margin: 0; padding-left: 18px; line-height: 1.8;">
          <li>Neograničene stavke menija</li>
          <li>Napredna analitika i izvještaji</li>
          <li>Predlošci i brending</li>
          <li>Prioritetna podrška</li>
        </ul>
      </div>
      <a href="${APP_URL}/admin/billing"
         style="display: inline-block; background: #0d7a52; color: #fff; text-decoration: none;
                padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;">
        Pređi na Pro — €19/god →
      </a>
      <p style="font-size: 12px; color: #8a9e96; margin-top: 32px; line-height: 1.5;">
        Ako imate pitanja, pišite nam na
        <a href="mailto:support@smartmeni.me" style="color: #0d7a52;">support@smartmeni.me</a>
      </p>
    </div>
  `
}

function suspensionEmail(restaurantName: string): string {
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a2e26;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 22px; font-weight: 700; color: #0d7a52;">smart<span style="color:#1a2e26">meni</span></span>
      </div>
      <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 12px;">
        Vaš nalog je suspendovan
      </h1>
      <p style="font-size: 14px; color: #5a7a6a; line-height: 1.6; margin-bottom: 20px;">
        Zdravo, <strong>${restaurantName}</strong>!<br><br>
        Vaš SmartMeni trial period je istekao i nalog je privremeno suspendovan.
        Svi vaši podaci su sačuvani — možete se reaktivirati u bilo kom trenutku.
      </p>
      <a href="${APP_URL}/admin/billing"
         style="display: inline-block; background: #0d7a52; color: #fff; text-decoration: none;
                padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600;">
        Reaktiviraj nalog →
      </a>
      <p style="font-size: 12px; color: #8a9e96; margin-top: 32px; line-height: 1.5;">
        Pitanja? Pišite nam na
        <a href="mailto:support@smartmeni.me" style="color: #0d7a52;">support@smartmeni.me</a>
      </p>
    </div>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const in7Days = new Date(now)
    in7Days.setDate(in7Days.getDate() + 7)

    // Format datuma za SQL usporedbu (YYYY-MM-DD)
    const todayStr = now.toISOString().slice(0, 10)
    const in7DaysStr = in7Days.toISOString().slice(0, 10)

    // 1. Restorani kojima trial ističe za tačno 7 dana
    const { data: trialSoon } = await supabase
      .from('restaurants')
      .select('id, name, trial_ends_at, plan')
      .eq('plan', 'starter')
      .is('suspended_at', null)
      .eq('is_complimentary', false)
      .gte('trial_ends_at', in7DaysStr + 'T00:00:00Z')
      .lt('trial_ends_at', in7DaysStr + 'T23:59:59Z')

    // 2. Restorani kojima je plan upravo istekao (suspendirani danas)
    const { data: justSuspended } = await supabase
      .from('restaurants')
      .select('id, name, suspended_at')
      .gte('suspended_at', todayStr + 'T00:00:00Z')
      .lt('suspended_at', todayStr + 'T23:59:59Z')

    let remindersSent = 0
    let suspensionsSent = 0

    // Šalji reminder emailove
    if (trialSoon?.length) {
      for (const rest of trialSoon) {
        // Dohvati email vlasnika
        const { data: userData } = await supabase
          .from('restaurants')
          .select('user_id')
          .eq('id', rest.id)
          .single()

        if (!userData) continue

        const { data: authUser } = await supabase.auth.admin.getUserById(userData.user_id)
        const email = authUser?.user?.email
        if (!email) continue

        const sent = await sendEmail(
          email,
          `SmartMeni: Vaš trial ističe za 7 dana`,
          reminderEmail(rest.name, 7)
        )
        if (sent) remindersSent++
      }
    }

    // Šalji suspension emailove
    if (justSuspended?.length) {
      for (const rest of justSuspended) {
        const { data: userData } = await supabase
          .from('restaurants')
          .select('user_id')
          .eq('id', rest.id)
          .single()

        if (!userData) continue

        const { data: authUser } = await supabase.auth.admin.getUserById(userData.user_id)
        const email = authUser?.user?.email
        if (!email) continue

        const sent = await sendEmail(
          email,
          `SmartMeni: Vaš nalog je suspendovan`,
          suspensionEmail(rest.name)
        )
        if (sent) suspensionsSent++
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent,
        suspensionsSent,
      }),
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
