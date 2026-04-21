// ▶ Novi fajl: supabase/functions/create-staff-user/index.ts
// Deploy: supabase functions deploy create-staff-user

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
    // Provjeri da je pozivalac autentifikovan
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nije autorizovano' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Klijent sa service_role za admin operacije
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Klijent sa JWT korisnika za provjeru ko poziva
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Provjeri da je korisnik vlasnik restorana ili super admin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Nevalidan token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .single()

    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_superadmin && !restaurant) {
      return new Response(JSON.stringify({ error: 'Nemate pravo kreiranja korisnika' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email, password, restaurant_id, role_id, wage_type, wage_amount } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email i lozinka su obavezni' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Lozinka mora imati najmanje 6 karaktera' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Kreiraj korisnika
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Odmah potvrdi email
    })

    if (createError) {
      // Korisnik već postoji — samo poveži sa staff
      if (createError.message.includes('already been registered')) {
        const { data: existingUser } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('id', (await supabaseAdmin.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id)
          .single()

        return new Response(JSON.stringify({
          error: 'Korisnik sa ovim emailom već postoji. Koristite opciju "Pošalji link za registraciju".'
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      throw createError
    }

    // Poveži sa staff rekordom (update ako postoji, insert ako ne)
    const { data: existingStaff } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('email', email.toLowerCase())
      .single()

    if (existingStaff) {
      await supabaseAdmin.from('staff').update({
        user_id: newUser.user.id,
        role_id: role_id || null,
        wage_type: wage_type || 'monthly',
        wage_amount: parseFloat(wage_amount) || 0,
        is_active: true,
      }).eq('id', existingStaff.id)
    } else {
      await supabaseAdmin.from('staff').insert({
        restaurant_id,
        user_id: newUser.user.id,
        email: email.toLowerCase(),
        role_id: role_id || null,
        wage_type: wage_type || 'monthly',
        wage_amount: parseFloat(wage_amount) || 0,
        is_active: true,
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Nalog kreiran za ${email}. Zaposlenik se može odmah ulogovati.`
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
