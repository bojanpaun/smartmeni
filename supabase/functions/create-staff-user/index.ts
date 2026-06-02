import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nije autorizovano' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Provjeri ko poziva
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Nevalidan token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles').select('is_superadmin').eq('id', user.id).single()
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants').select('id, slug').eq('user_id', user.id).single()

    if (!profile?.is_superadmin && !restaurant) {
      return new Response(JSON.stringify({ error: 'Nemate pravo kreiranja korisnika' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const {
      email, password, restaurant_id, role_id,
      wage_type, wage_amount, action,
    } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email je obavezan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const emailLower = email.trim().toLowerCase()
    let userId: string

    // ── 1. Kreiraj ili pronađi Auth korisnika ─────────────────────
    if (action === 'invite') {
      const { data: rest } = await supabaseAdmin
        .from('restaurants').select('slug').eq('id', restaurant_id).single()
      const siteUrl = Deno.env.get('SITE_URL') ?? 'https://restbyme.vercel.app'
      const redirectTo = rest?.slug ? `${siteUrl}/${rest.slug}/staff` : siteUrl

      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(emailLower, { redirectTo })

      if (inviteError) {
        // Korisnik već postoji — samo ga pronađi
        const existing = await findUserByEmail(supabaseAdmin, emailLower)
        if (!existing) {
          return new Response(JSON.stringify({ error: 'Greška pri slanju pozivnice: ' + inviteError.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        userId = existing.id
      } else {
        userId = inviteData.user.id
      }
    } else {
      // action === 'create'
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: 'Lozinka mora imati najmanje 6 karaktera' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: emailLower, password, email_confirm: true,
        })

      if (createError) {
        // Korisnik već postoji — pronađi ga i veži
        const existing = await findUserByEmail(supabaseAdmin, emailLower)
        if (!existing) {
          return new Response(JSON.stringify({ error: 'Korisnik postoji ali ga nije moguće pronaći.' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        userId = existing.id
      } else {
        userId = newUser.user.id
      }
    }

    // ── 2. Kreiraj ili ažuriraj staff zapis (service_role) ───────
    const today = new Date().toISOString().split('T')[0]

    const { data: existingStaff } = await supabaseAdmin
      .from('staff').select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('email', emailLower)
      .maybeSingle()

    let staffData

    if (existingStaff) {
      // Veži user_id ako ga nema
      const { data } = await supabaseAdmin
        .from('staff')
        .update({ user_id: userId, role_id: role_id || null, is_active: true })
        .eq('id', existingStaff.id)
        .select('*, role:roles(name)')
        .single()
      staffData = data
    } else {
      const { data } = await supabaseAdmin
        .from('staff')
        .insert({
          restaurant_id,
          user_id: userId,
          email: emailLower,
          role_id: role_id || null,
          wage_type: wage_type || 'monthly',
          wage_amount: parseFloat(wage_amount) || 0,
          is_active: true,
          start_date: today,
        })
        .select('*, role:roles(name)')
        .single()
      staffData = data
    }

    // ── 3. Historija ─────────────────────────────────────────────
    if (staffData) {
      await supabaseAdmin.from('staff_history').insert({
        staff_id: staffData.id,
        restaurant_id,
        event_type: 'hired',
        description: action === 'invite' ? 'Pozivnica poslana' : 'Zaposlenik dodan u sistem',
        event_date: today,
      })
    }

    const message = action === 'invite'
      ? `Pozivnica poslana na ${emailLower}.`
      : `Nalog kreiran za ${emailLower}. Zaposlenik se može odmah ulogovati.`

    return new Response(JSON.stringify({ success: true, staff: staffData, message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function findUserByEmail(supabaseAdmin: any, email: string) {
  let page = 1
  while (true) {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 50 })
    if (error || !users?.length) break
    const found = users.find((u: any) => u.email?.toLowerCase() === email)
    if (found) return found
    if (users.length < 50) break
    page++
  }
  return null
}
