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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

    // Provjeri da je korisnik vlasnik ili superadmin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Nevalidan token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles').select('is_superadmin').eq('id', user.id).single()
    const { data: restaurant } = await supabaseAdmin
      .from('restaurants').select('id, slug').eq('user_id', user.id).single()

    if (!profile?.is_superadmin && !restaurant) {
      return new Response(JSON.stringify({ error: 'Nemate pravo kreiranja korisnika' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { email, password, restaurant_id, role_id, action } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email je obavezan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const emailLower = email.trim().toLowerCase()
    let userId: string

    if (action === 'invite') {
      // ── Pošalji pozivnicu ─────────────────────────────────────────
      // Pronađi slug restorana za redirect URL
      const { data: rest } = await supabaseAdmin
        .from('restaurants').select('slug').eq('id', restaurant_id).single()
      const siteUrl = Deno.env.get('SITE_URL') ?? 'https://restbyme.vercel.app'
      const redirectTo = rest?.slug ? `${siteUrl}/${rest.slug}/staff` : siteUrl

      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        emailLower, { redirectTo }
      )

      if (inviteError) {
        // Korisnik već postoji — pronađi ga i veži
        if (inviteError.message.includes('already been registered') || inviteError.status === 422) {
          const existing = await findUserByEmail(supabaseAdmin, emailLower)
          if (!existing) {
            return new Response(JSON.stringify({ error: 'Korisnik postoji ali ga nije moguće pronaći.' }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          userId = existing.id
        } else {
          throw inviteError
        }
      } else {
        userId = inviteData.user.id
      }

    } else {
      // ── Kreiraj nalog sa lozinkom ─────────────────────────────────
      if (!password || password.length < 6) {
        return new Response(JSON.stringify({ error: 'Lozinka mora imati najmanje 6 karaktera' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower, password, email_confirm: true,
      })

      if (createError) {
        if (createError.message.includes('already been registered') || createError.status === 422) {
          // Korisnik već postoji — pronađi ga i veži umjesto da vrati grešku
          const existing = await findUserByEmail(supabaseAdmin, emailLower)
          if (!existing) {
            return new Response(JSON.stringify({ error: 'Korisnik postoji ali ga nije moguće pronaći.' }), {
              status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
          }
          userId = existing.id
        } else {
          throw createError
        }
      } else {
        userId = newUser.user.id
      }
    }

    // Vrati user_id frontendu — staff insert radi frontend
    const message = action === 'invite'
      ? `Pozivnica poslana na ${emailLower}. Zaposlenik će dobiti email za postavljanje lozinke.`
      : `Nalog kreiran za ${emailLower}. Zaposlenik se može odmah ulogovati.`

    return new Response(JSON.stringify({ success: true, user_id: userId, message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// Helper: pronađi Auth korisnika po emailu
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
