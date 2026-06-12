// Čista (bez mreže) logika za AI prevod tenant-sadržaja — testabilna Deno testom.
// Izvor je uvijek crnogorski ('me'); prevodi se na 6 ciljnih jezika. index.ts
// dodaje mrežu (Anthropic fetch) + Supabase upsert oko ovih funkcija.

export const TARGET_LANGS = ['en', 'sr', 'hr', 'sq', 'tr', 'ru'] as const
export type TargetLang = typeof TARGET_LANGS[number]

export const LANG_NAMES: Record<string, string> = {
  en: 'English',
  sr: 'Serbian (ekavica)',
  hr: 'Croatian',
  sq: 'Albanian',
  tr: 'Turkish',
  ru: 'Russian',
}

export interface SourceItem {
  entity_type: string
  entity_id: string
  field: string
  text: string
}

export interface TranslationRow {
  entity_type: string
  entity_id: string
  field: string
  lang: string
  value: string
}

// Validira/filtrira ciljne jezike (uvijek bez 'me'); prazno → svi default.
export function resolveLangs(langs?: string[]): string[] {
  if (!Array.isArray(langs) || langs.length === 0) return [...TARGET_LANGS]
  return langs.filter((l) => (TARGET_LANGS as readonly string[]).includes(l))
}

// Gradi prompt za Anthropic Messages API. Stavke se referišu indeksom (0..n) da
// se izbjegne dvosmislenost; tražimo STROGI JSON nazad radi pouzdanog parsiranja.
export function buildPrompt(items: SourceItem[], langs: string[]): { system: string; user: string } {
  const langList = langs.map((l) => `"${l}" (${LANG_NAMES[l] ?? l})`).join(', ')
  const system =
    'You are a professional translator for a hospitality (restaurant & hotel) SaaS. ' +
    'The source language is Montenegrin. Translate short menu/venue content (dish names, ' +
    'descriptions, category names) naturally and concisely, preserving meaning and tone. ' +
    'Keep proper names, brand names and units (€, kg, cl) as-is. Do NOT add explanations. ' +
    'Return ONLY valid minified JSON, no markdown, no code fences.'

  const lines = items.map((it, i) => `${i}: ${JSON.stringify(it.text)}`).join('\n')
  const user =
    `Translate each numbered source text into these languages: ${langList}.\n` +
    `Return a JSON object where each key is the item index (as a string) and each value is ` +
    `an object mapping the language code to the translation. ` +
    `Example shape: {"0":{"en":"...","sr":"..."},"1":{"en":"...","sr":"..."}}.\n\n` +
    `Source texts:\n${lines}`

  return { system, user }
}

// Izvuče JSON iz Claude odgovora (skida eventualne code fence-ove / okolni tekst).
export function extractJson(raw: string): string {
  let s = (raw ?? '').trim()
  // Skini ```json ... ``` ili ``` ... ```
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) s = fence[1].trim()
  // Ako ima okolnog teksta, uzmi od prve { do posljednje }
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first > 0 || (last >= 0 && last < s.length - 1)) {
    if (first >= 0 && last > first) s = s.slice(first, last + 1)
  }
  return s
}

// Mapira Claude JSON ({ "0": { en, sr, ... } }) nazad u redove za upsert.
// Tiho preskače fale/prazne prevode (fallback na izvor radi GuestMenu).
export function parseTranslations(raw: string, items: SourceItem[], langs: string[]): TranslationRow[] {
  let parsed: Record<string, Record<string, string>>
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    throw new Error('Neispravan JSON iz modela')
  }
  const rows: TranslationRow[] = []
  items.forEach((it, i) => {
    const byLang = parsed[String(i)]
    if (!byLang || typeof byLang !== 'object') return
    for (const lang of langs) {
      const val = byLang[lang]
      if (typeof val === 'string' && val.trim()) {
        rows.push({ entity_type: it.entity_type, entity_id: it.entity_id, field: it.field, lang, value: val.trim() })
      }
    }
  })
  return rows
}

// SHA-256 heks izvornog teksta (invalidacija stale prevoda). Web Crypto — radi u Deno.
export async function sourceHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
