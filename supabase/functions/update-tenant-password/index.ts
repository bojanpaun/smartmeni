import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Superadmin mijenja lozinku vlasniku tenanta (restaurants.user_id) preko
// service_role admin API-ja. SAMO superadmin smije pozvati — ne owner, ne staff.
// Lozinka se NIKAD ne loguje niti vraća nazad u odgovoru.
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

    // SAMO superadmin — promjena lozinke je osjetljiva operacija
    const { data: profile } = await supabaseAdmin
      .from('user_profiles').select('is_superadmin').eq('id', user.id).single()

    if (!profile?.is_superadmin) {
      return new Response(JSON.stringify({ error: 'Samo superadmin može mijenjati lozinku tenanta' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { restaurant_id, new_password } = await req.json()

    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: 'restaurant_id je obavezan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!new_password || new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Lozinka mora imati najmanje 6 karaktera' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Pronađi vlasnika tenanta (auth.users id)
    const { data: rest, error: restError } = await supabaseAdmin
      .from('restaurants').select('user_id').eq('id', restaurant_id).single()

    if (restError || !rest?.user_id) {
      return new Response(JSON.stringify({ error: 'Tenant ili vlasnik nije pronađen' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      rest.user_id, { password: new_password }
    )

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Greška pri promjeni lozinke: ' + updateError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Audit log (service_role; actor = superadmin koji poziva). NIKAD lozinku u metadata.
    await supabaseAdmin.from('audit_log').insert({
      restaurant_id,
      actor_id: user.id,
      actor_email: user.email ?? null,
      actor_role: 'superadmin',
      action: 'tenant.password_changed',
      entity_type: 'tenant',
      entity_id: restaurant_id,
      summary: 'Superadmin promijenio lozinku vlasniku naloga',
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Greška servera: ' + (e?.message ?? String(e)) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
