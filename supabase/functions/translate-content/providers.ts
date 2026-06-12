// Provajder-apstrakcija za prevod: svaki uzme (apiKey, model, system, user) i
// vrati SIROVI tekst odgovora (JSON string) — parsiranje je zajedničko (translate.ts).
// Dodavanje provajdera = nova funkcija + grana u callModel (index.ts).

// Anthropic Messages API (Claude Haiku). Naplata: pay-per-token (console.anthropic.com).
export async function callAnthropic(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 300)}`)
  const data = await resp.json()
  return data?.content?.[0]?.text ?? ''
}

// Google Gemini (generativelanguage API). Velika besplatna kvota (aistudio.google.com).
// responseMimeType=application/json tjera čist JSON izlaz (bez code-fence-a).
export async function callGemini(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
    }),
  })
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 300)}`)
  const data = await resp.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}
