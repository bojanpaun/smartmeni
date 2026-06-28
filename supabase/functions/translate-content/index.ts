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
  buildPrompt, parseTranslations, resolveLangs, sourceHash, landingFields,
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

    // ── BIBLIOTEKE (globalno, samo superadmin): prevedi `name` 3 kurirane biblioteke
    //    + `label` dashboard_tasks → library_translations (bez restaurant_id).
    //    Pickeri/TaskBar ih čitaju za admin jezik (useLibraryTranslations). ──
    if (body?.library === true) {
      if (!profile?.is_superadmin) return json({ error: 'Samo superadmin' }, 403)
      const [{ data: recs }, { data: spaT }, { data: mini }, { data: dtasks }] = await Promise.all([
        supabaseAdmin.from('recipe_library').select('id, name'),
        supabaseAdmin.from('spa_treatment_library').select('id, name'),
        supabaseAdmin.from('minibar_library').select('id, name'),
        supabaseAdmin.from('dashboard_tasks').select('id, label'),
      ])
      const libItems: SourceItem[] = []
      for (const r of recs ?? []) if (r.name?.trim()) libItems.push({ entity_type: 'recipe_library', entity_id: r.id, field: 'name', text: r.name.trim() })
      for (const s of spaT ?? []) if (s.name?.trim()) libItems.push({ entity_type: 'spa_treatment_library', entity_id: s.id, field: 'name', text: s.name.trim() })
      for (const m of mini ?? []) if (m.name?.trim()) libItems.push({ entity_type: 'minibar_library', entity_id: m.id, field: 'name', text: m.name.trim() })
      for (const d of dtasks ?? []) if (d.label?.trim()) libItems.push({ entity_type: 'dashboard_task', entity_id: d.id, field: 'label', text: d.label.trim() })
      if (libItems.length === 0) return json({ translated: 0, skipped: 0 })

      const libHashes = new Map<string, string>()
      for (const it of libItems) libHashes.set(it.entity_id, await sourceHash(it.text))
      const libIds = [...new Set(libItems.map((it) => it.entity_id))]
      const { data: libExisting } = await supabaseAdmin
        .from('library_translations')
        .select('entity_id, lang, source_hash')
        .in('entity_id', libIds)
      const libFresh = new Set<string>()
      for (const r of libExisting ?? []) {
        const h = libHashes.get(r.entity_id)
        if (h && r.source_hash === h) libFresh.add(`${r.entity_id}|${r.lang}`)
      }
      const libToDo = libItems.filter((it) => langs.some((l) => !libFresh.has(`${it.entity_id}|${l}`)))
      if (libToDo.length === 0) return json({ translated: 0, skipped: libItems.length })

      const libRows = await translateAll(provider, libToDo, langs)
      const libUpsert = libRows
        .filter((row) => !libFresh.has(`${row.entity_id}|${row.lang}`))
        .map((row) => ({
          entity_type: row.entity_type, entity_id: row.entity_id, field: row.field,
          lang: row.lang, value: row.value, source_hash: libHashes.get(row.entity_id),
        }))
      if (libUpsert.length === 0) return json({ translated: 0, skipped: libItems.length })
      await supabaseAdmin.from('library_translations')
        .upsert(libUpsert, { onConflict: 'entity_type,entity_id,field,lang' })
      return json({ translated: libUpsert.length, skipped: libItems.length - libToDo.length })
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

    // Backfill: učitaj SVE zatečeno guest-facing tenant-sadržaja iz baze (service_role).
    // Pokriva: menu_items, kategorije, room_types, spa_services, opis objekta, poruke
    // konobaru (self-heal id + seed default-a), landing blokove i razloge odbijanja
    // nedavnih narudžbi (entity 'order').
    let sourceItems: SourceItem[] = rawItems
    if (backfill) {
      const [
        { data: mi }, { data: cats }, { data: rts }, { data: spa }, { data: rps }, { data: restRow }, { data: lps },
      ] = await Promise.all([
        supabaseAdmin.from('menu_items').select('id, name, description').eq('restaurant_id', restaurantId),
        supabaseAdmin.from('categories').select('id, name').eq('restaurant_id', restaurantId),
        supabaseAdmin.from('room_types').select('id, name, description').eq('restaurant_id', restaurantId),
        supabaseAdmin.from('spa_services').select('id, name, description').eq('restaurant_id', restaurantId),
        supabaseAdmin.from('rate_plans').select('id, name, description').eq('restaurant_id', restaurantId).eq('plan_type', 'package'),
        supabaseAdmin.from('restaurants').select('description, waiter_messages').eq('id', restaurantId).maybeSingle(),
        supabaseAdmin.from('landing_pages').select('page_type, blocks').eq('restaurant_id', restaurantId),
      ])
      sourceItems = []
      for (const m of mi ?? []) {
        if (m.name?.trim()) sourceItems.push({ entity_type: 'menu_item', entity_id: m.id, field: 'name', text: m.name })
        if (m.description?.trim()) sourceItems.push({ entity_type: 'menu_item', entity_id: m.id, field: 'description', text: m.description })
      }
      for (const c of cats ?? []) {
        if (c.name?.trim()) sourceItems.push({ entity_type: 'category', entity_id: c.id, field: 'name', text: c.name })
      }
      for (const r of rts ?? []) {
        if (r.name?.trim()) sourceItems.push({ entity_type: 'room_type', entity_id: r.id, field: 'name', text: r.name })
        if (r.description?.trim()) sourceItems.push({ entity_type: 'room_type', entity_id: r.id, field: 'description', text: r.description })
      }
      for (const s of spa ?? []) {
        if (s.name?.trim()) sourceItems.push({ entity_type: 'spa_service', entity_id: s.id, field: 'name', text: s.name })
        if (s.description?.trim()) sourceItems.push({ entity_type: 'spa_service', entity_id: s.id, field: 'description', text: s.description })
      }
      for (const p of rps ?? []) {
        if (p.name?.trim()) sourceItems.push({ entity_type: 'rate_plan', entity_id: p.id, field: 'name', text: p.name })
        if (p.description?.trim()) sourceItems.push({ entity_type: 'rate_plan', entity_id: p.id, field: 'description', text: p.description })
      }
      if (restRow?.description?.trim()) {
        sourceItems.push({ entity_type: 'restaurant', entity_id: restaurantId, field: 'description', text: restRow.description })
      }
      // Poruke konobaru: gost ih čita PO ID-u (tr('waiter_message', opt.id, ...)). Ranije
      // backfill je preskakao poruke bez id-a (default-i i stare {sr,en}) → ostajale
      // neprevedene za ne-en jezike. Sada: self-heal id-jeva + seed default-a + upis nazad.
      const DEFAULT_WAITER_MESSAGES = [
        { sr: 'Pozovi konobara', icon: '🔔' },
        { sr: 'Donesi račun – plaćam u kešu', icon: '🧾' },
        { sr: 'Donesi vodu', icon: '🥤' },
        { sr: 'Skloni prazne tanjire', icon: '🍽️' },
      ]
      let wmsgs: Array<Record<string, unknown>> = Array.isArray(restRow?.waiter_messages) ? restRow!.waiter_messages : []
      let wmMutated = false
      if (wmsgs.length === 0) {
        wmsgs = DEFAULT_WAITER_MESSAGES.map((m) => ({ ...m, id: crypto.randomUUID() }))
        wmMutated = true
      } else {
        wmsgs = wmsgs.map((m) => {
          const src = (m?.sr ?? m?.text) as string | undefined
          if (src && typeof src === 'string' && src.trim() && !m.id) { wmMutated = true; return { ...m, id: crypto.randomUUID() } }
          return m
        })
      }
      if (wmMutated) {
        await supabaseAdmin.from('restaurants').update({ waiter_messages: wmsgs }).eq('id', restaurantId)
      }
      for (const m of wmsgs) {
        const src = (m?.sr ?? m?.text) as string | undefined
        if (m?.id && typeof src === 'string' && src.trim()) {
          sourceItems.push({ entity_type: 'waiter_message', entity_id: String(m.id), field: 'text', text: src })
        }
      }
      for (const lp of lps ?? []) {
        for (const { field, text } of landingFields(lp.page_type, lp.blocks)) {
          sourceItems.push({ entity_type: 'landing_block', entity_id: restaurantId, field, text })
        }
      }
      // Razlozi odbijanja: per-narudžba (gost ih čita kao entity 'order'). Prevedi nedavne
      // odbijene narudžbe da button uhvati i one kojima je per-order prevod promašio.
      const { data: rejOrders } = await supabaseAdmin
        .from('orders').select('id, rejection_message')
        .eq('restaurant_id', restaurantId).not('rejection_message', 'is', null)
        .order('created_at', { ascending: false }).limit(300)
      for (const o of rejOrders ?? []) {
        if (typeof o.rejection_message === 'string' && o.rejection_message.trim()) {
          sourceItems.push({ entity_type: 'order', entity_id: o.id, field: 'rejection_message', text: o.rejection_message })
        }
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
