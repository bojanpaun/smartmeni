// translate-content — AI prevod tenant-sadržaja (nazivi/opisi jela, kategorije...)
// na 6 ciljnih jezika preko Claude Haiku; keš u public.content_translations.
// Poziva se iz admina nakon snimanja menija (vidi src/lib/contentTranslate.js).
//
// Body: { restaurant_id: string, items: [{ entity_type, entity_id, field, text }], langs?: string[] }
// Tok: provjeri vlasništvo → preskoči svjež (isti source_hash) i is_override redove →
//      Claude prevede preostalo → upsert (service_role). Izvor 'me' se NE čuva.
// Secret: ANTHROPIC_API_KEY (Supabase). Pure logika: ./translate.ts (Deno test).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildPrompt, parseTranslations, resolveLangs, sourceHash,
  type SourceItem, type TranslationRow,
} from './translate.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'
const CHUNK = 40 // max stavki po Claude pozivu (drži token/latenciju pod kontrolom)

async function callClaude(apiKey: string, items: SourceItem[], langs: string[]): Promise<TranslationRow[]> {
  const { system, user } = buildPrompt(items, langs)
  const maxTokens = Math.min(8192, items.length * langs.length * 48 + 512)
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`Anthropic ${resp.status}: ${detail.slice(0, 300)}`)
  }
  const data = await resp.json()
  const text = data?.content?.[0]?.text ?? ''
  return parseTranslations(text, items, langs)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Nije autorizovano' }, 401)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY nije postavljen' }, 500)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser()
    if (userErr || !user) return json({ error: 'Nevalidan token' }, 401)

    const body = await req.json().catch(() => null)
    const restaurantId: string = body?.restaurant_id
    const rawItems: SourceItem[] = Array.isArray(body?.items) ? body.items : []
    const langs = resolveLangs(body?.langs)
    const backfill = body?.backfill === true // učitaj SVE stavke tenanta iz baze
    if (!restaurantId || (!backfill && rawItems.length === 0)) {
      return json({ error: 'restaurant_id i items (ili backfill) su obavezni' }, 400)
    }

    // Vlasništvo: pozivalac mora biti vlasnik tenanta ili superadmin.
    const { data: profile } = await supabaseAdmin
      .from('user_profiles').select('is_superadmin').eq('id', user.id).maybeSingle()
    const { data: rest } = await supabaseAdmin
      .from('restaurants').select('user_id').eq('id', restaurantId).maybeSingle()
    if (!rest) return json({ error: 'Restoran ne postoji' }, 404)
    if (!profile?.is_superadmin && rest.user_id !== user.id) return json({ error: 'Nemate pravo' }, 403)

    // Backfill: učitaj SVE menu_items (uklj. skrivene) + kategorije iz baze
    // (service_role zaobilazi RLS — superadmin tako prevodi i tuđi tenant).
    let sourceItems: SourceItem[] = rawItems
    if (backfill) {
      const [{ data: mi }, { data: cats }] = await Promise.all([
        supabaseAdmin.from('menu_items').select('id, name, description').eq('restaurant_id', restaurantId),
        supabaseAdmin.from('categories').select('id, name').eq('restaurant_id', restaurantId),
      ])
      sourceItems = []
      for (const m of mi ?? []) {
        if (m.name?.trim()) sourceItems.push({ entity_type: 'menu_item', entity_id: m.id, field: 'name', text: m.name })
        if (m.description?.trim()) sourceItems.push({ entity_type: 'menu_item', entity_id: m.id, field: 'description', text: m.description })
      }
      for (const c of cats ?? []) {
        if (c.name?.trim()) sourceItems.push({ entity_type: 'category', entity_id: c.id, field: 'name', text: c.name })
      }
    }

    // Normalizuj + odbaci prazne izvore.
    const items = sourceItems
      .filter((it) => it && it.entity_type && it.entity_id && it.field && typeof it.text === 'string' && it.text.trim())
      .map((it) => ({ entity_type: String(it.entity_type), entity_id: String(it.entity_id), field: String(it.field), text: it.text.trim() }))
    if (items.length === 0) return json({ translated: 0, skipped: 0 })

    // Hash izvora po stavci.
    const hashes = new Map<string, string>() // entity_id|field -> hash
    for (const it of items) hashes.set(`${it.entity_id}|${it.field}`, await sourceHash(it.text))

    // Postojeći prevodi za ove entitete (skip svjež + zaštiti is_override).
    const entityIds = [...new Set(items.map((it) => it.entity_id))]
    const { data: existing } = await supabaseAdmin
      .from('content_translations')
      .select('entity_id, field, lang, source_hash, is_override')
      .eq('restaurant_id', restaurantId)
      .in('entity_id', entityIds)

    const locked = new Set<string>()  // entity_id|field|lang — is_override → nikad ne piši
    const fresh = new Set<string>()   // entity_id|field|lang — isti hash → preskoči
    for (const r of existing ?? []) {
      const key = `${r.entity_id}|${r.field}|${r.lang}`
      if (r.is_override) locked.add(key)
      const h = hashes.get(`${r.entity_id}|${r.field}`)
      if (h && r.source_hash === h) fresh.add(key)
    }

    // Stavke kojima treba bar jedan jezik (ne locked, ne fresh).
    const needed = new Map<string, Set<string>>() // entity_id|field -> Set(lang)
    for (const it of items) {
      const ef = `${it.entity_id}|${it.field}`
      const set = new Set<string>()
      for (const lang of langs) {
        const k = `${ef}|${lang}`
        if (!locked.has(k) && !fresh.has(k)) set.add(lang)
      }
      if (set.size) needed.set(ef, set)
    }
    const toTranslate = items.filter((it) => needed.has(`${it.entity_id}|${it.field}`))
    if (toTranslate.length === 0) return json({ translated: 0, skipped: items.length })

    // Claude u chunk-ovima → redovi → filtriraj na "needed" → dodaj source_hash → upsert.
    const upsertRows: Array<TranslationRow & { restaurant_id: string; source_hash: string; is_override: boolean }> = []
    for (let i = 0; i < toTranslate.length; i += CHUNK) {
      const chunk = toTranslate.slice(i, i + CHUNK)
      const rows = await callClaude(apiKey, chunk, langs)
      for (const row of rows) {
        const ef = `${row.entity_id}|${row.field}`
        if (!needed.get(ef)?.has(row.lang)) continue // locked/fresh ili nepoznat
        upsertRows.push({ ...row, restaurant_id: restaurantId, source_hash: hashes.get(ef) ?? '', is_override: false })
      }
    }

    if (upsertRows.length === 0) return json({ translated: 0, skipped: items.length })

    const { error: upErr } = await supabaseAdmin
      .from('content_translations')
      .upsert(upsertRows, { onConflict: 'restaurant_id,entity_type,entity_id,field,lang' })
    if (upErr) return json({ error: 'Upsert greška', detail: upErr.message }, 500)

    return json({ translated: upsertRows.length, skipped: items.length - toTranslate.length })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
