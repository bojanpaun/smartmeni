// ════════════════════════════════════════════════════════════════════════════
// FISK-1 — PDV motor (čista funkcija, MINOR jedinice / centi tenantove valute).
//
// Princip 2 (roadmap): novac u centima na granici. Sav ulaz/izlaz je cijeli broj
// minor-jedinica (centi), pa je `fiskalni total == naplaćeni iznos` garantovan i
// nema float-drift-a. Cijene su BRUTO (price-inclusive): osnovicu i PDV IZVLAČIMO.
//
//   base = round(gross / (1 + rate))   ·   vat = gross - base
//
// Agregacija u poreske grupe po `vat_rate_key`, zaokruživanje na NIVOU GRUPE
// (ne po stavci) → manje akumulirane greške i base+vat==gross po grupi i ukupno.
// `rate` je decimalna stopa iz tax_config.rates (0.21 = 21%).
// ════════════════════════════════════════════════════════════════════════════

// Pronađi decimalnu stopu po ključu iz tax_config.rates ([{key,value,label}]).
// Nepoznat ključ → 0 (app NE klasifikuje umjesto tenanta; 0 je bezbjedan fallback).
export function resolveRate(rates, key) {
  const r = (rates || []).find((x) => x && x.key === key)
  return r ? Number(r.value) || 0 : 0
}

// Izvuci osnovicu i PDV iz BRUTO iznosa (price-inclusive) u minor-jedinicama.
export function vatBreakdownFromGross(grossMinor, rate) {
  const gross = Math.round(Number(grossMinor) || 0)
  const r = Number(rate) || 0
  const base = Math.round(gross / (1 + r))
  const vat = gross - base // garantuje base + vat == gross (bez zasebnog zaokruživanja PDV-a)
  return { grossMinor: gross, baseMinor: base, vatMinor: vat }
}

// Sklopi poreske grupe iz stavki računa.
//   items: [{ amountMinor, vatRateKey }]  (amountMinor = BRUTO po stavci, centi)
//   rates: tax_config.rates ([{key,value,label}])
// Vraća grupe po stopi + ukupne sume. Invarijanta: totalBase+totalVat==totalGross.
export function computeInvoiceTax(items, rates) {
  const grossByKey = new Map()
  for (const it of items || []) {
    if (!it || it.vatRateKey == null) continue
    const prev = grossByKey.get(it.vatRateKey) || 0
    grossByKey.set(it.vatRateKey, prev + Math.round(Number(it.amountMinor) || 0))
  }

  const groups = [...grossByKey.entries()]
    .map(([vatRateKey, grossMinor]) => {
      const rate = resolveRate(rates, vatRateKey)
      const { baseMinor, vatMinor } = vatBreakdownFromGross(grossMinor, rate)
      return { vatRateKey, rate, grossMinor, baseMinor, vatMinor }
    })
    .sort((a, b) => (a.vatRateKey < b.vatRateKey ? -1 : a.vatRateKey > b.vatRateKey ? 1 : 0))

  const totalGrossMinor = groups.reduce((s, g) => s + g.grossMinor, 0)
  const totalBaseMinor = groups.reduce((s, g) => s + g.baseMinor, 0)
  const totalVatMinor = groups.reduce((s, g) => s + g.vatMinor, 0)

  return { groups, totalGrossMinor, totalBaseMinor, totalVatMinor }
}
