// translate-content — AI prevod tenant-sadržaja (nazivi/opisi jela, kategorije...)
// na 6 ciljnih jezika; keš u public.content_translations.
//
// Provajderi (zamjenjivi): Anthropic Haiku (ANTHROPIC_API_KEY) ili Google Gemini
// (GEMINI_API_KEY). Izbor: body.provider ili env TRANSLATE_PROVIDER (default anthropic).
//
// Body: { restaurant_id, items?, langs?, backfill?, dryRun?, provider? }
//  - items: [{ entity_type, entity_id, field, text }] (izvor je crnogorski)
//  - backfill:true → edge sam učita SVE menu_items+kategorije tenanta (service_role)
//  - dryRun:true → vrati prevode u odgovoru BEZ upisa (superadmin test/poređenje)
// Pure logika: ./translate.ts (Deno test), mrežni pozivi: ./providers.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callAnthropic, callGemini } from './providers.ts'
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

const CHUNK = 40 // max stavki po pozivu modela

// Prevede jedan chunk zadatim provajderom → redovi (entity/field/lang/value).
async function translateChunk(provider: string, items: SourceItem[], langs: string[]): Promise<TranslationRow[]> {
  const { system, user } = buildPrompt(items, langs)
  const maxTokens = Math.min(8192, items.length * langs.length * 48 + 512)
  let raw: string
  if (provider === 'gemini') {
    const key = Deno.env.get('GEMINI_API_KEY')
    if (!key) throw new Error('GEMINI_API_KEY nije postavljen')
    raw = await callGemini(key, Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash', system, user, maxTokens)
  } else {
    const key = Deno.env.get('ANTHROPIC_API_KEY')
    if (!key) throw new Error('ANTHROPIC_API_KEY nije postavljen')
    raw = await callAnthropic(key, Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001', system, user, maxTokens)
  }
  return parseTranslations(raw, items, langs)
}

async function translateAll(provider: string, items: SourceItem[], langs: string[]): Promise<TranslationRow[]> {
  const out: TranslationRow[] = []
  for (let i = 0; i < items.length; i += CHUNK) {
    out.push(...await translateChunk(provider, items.slice(i, i + CHUNK), langs))
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Nije autorizovano' }, 401)

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
    const provider = (body?.provider ?? Deno.env.get('TRANSLATE_PROVIDER') ?? 'anthropic') === 'gemini' ? 'gemini' : 'anthropic'
    const langs = resolveLangs(body?.langs)
    const dryRun = body?.dryRun === true
    const rawItems: SourceItem[] = Array.isArray(body?.items) ? body.items : []

    const { data: profile } = await supabaseAdmin
      .from('user_profiles').select('is_superadmin').eq('id', user.id).maybeSingle()

    // ── DRY-RUN: superadmin test/poređenje provajdera, BEZ upisa ──
    if (dryRun) {
      if (!profile?.is_superadmin) return json({ error: 'Samo superadmin' }, 403)
      const items = rawItems
        .filter((it) => it && it.entity_type && it.entity_id && it.field && typeof it.text === 'string' && it.text.trim())
        .map((it) => ({ entity_type: String(it.entity_type), entity_id: String(it.entity_id), field: String(it.field), text: it.text.trim() }))
      if (items.length === 0) return json({ rows: [], provider })
      const rows = await translateAll(provider, items, langs)
      return json({ rows, provider })
    }

    // ── REALNI PREVOD (upis u content_translations) ──
    const restaurantId: string = body?.restaurant_id
    const backfill = body?.backfill === true
    if (!restaurantId || (!backfill && rawItems.length === 0)) {
      return json({ error: 'restaurant_id i items (ili backfill) su obavezni' }, 400)
    }

    const { data: rest } = await supabaseAdmin
      .from('restaurants').select('user_id').eq('id', restaurantId).maybeSingle()
    if (!rest) return json({ error: 'Restoran ne postoji' }, 404)
    if (!profile?.is_superadmin && rest.user_id !== user.id) return json({ error: 'Nemate pravo' }, 403)

    // Backfill: učitaj SVE menu_items (uklj. skrivene) + kategorije iz baze.
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

    const items = sourceItems
      .filter((it) => it && it.entity_type && it.entity_id && it.field && typeof it.text === 'string' && it.text.trim())
      .map((it) => ({ entity_type: String(it.entity_type), entity_id: String(it.entity_id), field: String(it.field), text: it.text.trim() }))
    if (items.length === 0) return json({ translated: 0, skipped: 0 })

    // Hash izvora po stavci.
    const hashes = new Map<string, string>()
    for (const it of items) hashes.set(`${it.entity_id}|${it.field}`, await sourceHash(it.text))

    // Postojeći prevodi (skip svjež + zaštiti is_override).
    const entityIds = [...new Set(items.map((it) => it.entity_id))]
    const { data: existing } = await supabaseAdmin
      .from('content_translations')
      .select('entity_id, field, lang, source_hash, is_override')
      .eq('restaurant_id', restaurantId)
      .in('entity_id', entityIds)

    const locked = new Set<string>()
    const fresh = new Set<string>()
    for (const r of existing ?? []) {
      const key = `${r.entity_id}|${r.field}|${r.lang}`
      if (r.is_override) locked.add(key)
      const h = hashes.get(`${r.entity_id}|${r.field}`)
      if (h && r.source_hash === h) fresh.add(key)
    }

    const needed = new Map<string, Set<string>>()
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

    const rows = await translateAll(provider, toTranslate, langs)
    const upsertRows: Array<TranslationRow & { restaurant_id: string; source_hash: string; is_override: boolean }> = []
    for (const row of rows) {
      const ef = `${row.entity_id}|${row.field}`
      if (!needed.get(ef)?.has(row.lang)) continue
      upsertRows.push({ ...row, restaurant_id: restaurantId, source_hash: hashes.get(ef) ?? '', is_override: false })
    }
    if (upsertRows.length === 0) return json({ translated: 0, skipped: items.length })

    const { error: upErr } = await supabaseAdmin
      .from('content_translations')
      .upsert(upsertRows, { onConflict: 'restaurant_id,entity_type,entity_id,field,lang' })
    if (upErr) return json({ error: 'Upsert greška', detail: upErr.message }, 500)

    return json({ translated: upsertRows.length, skipped: items.length - toTranslate.length, provider })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
