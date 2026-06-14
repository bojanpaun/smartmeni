import { formatMoney, fromMinorUnits } from './currencies'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Otvori ČIST print-ready prozor sa fiskalnim računom (self-contained HTML, print na
// onload). Pouzdano (bez modal/overflow/fixed smetnji). @page 80mm auto = format
// računa, visina prati sadržaj (ne A4). Koriste ga admin modal i portal zaposlenih.
// labels (L): { taxId, vatNumber, iban, number, date, status, name, qty, vat, total, base, footnote }
export function openInvoicePrintWindow({ invoice, items = [], restaurant, lang = 'sr-Latn', labels = {} }) {
  const L = labels
  const m = (cents) => formatMoney(fromMinorUnits(cents, invoice.currency), invoice.currency, lang)
  const dl = lang === 'en' ? 'en-US' : 'sr-Latn'

  const sellerLines = [
    restaurant?.location,
    restaurant?.tax_id && `${L.taxId}: ${restaurant.tax_id}`,
    restaurant?.vat_number && `${L.vatNumber}: ${restaurant.vat_number}`,
    restaurant?.iban && `${L.iban}: ${restaurant.iban}`,
  ].filter(Boolean).map(l => `<div class="sl">${esc(l)}</div>`).join('')

  const rows = items.map(it => `<tr><td>${esc(it.name)}</td><td class="r">${Number(it.quantity)}</td>`
    + `<td class="r">${esc(it.vat_rate_key || '—')}</td><td class="r">${esc(m(it.total_cents))}</td></tr>`).join('')

  const html = `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8">`
    + `<title>${esc(invoice.invoice_number)}</title><style>`
    + `@page{size:80mm auto;margin:4mm}`
    + `*{box-sizing:border-box}body{font-family:ui-monospace,monospace;color:#111;background:#fff;margin:0 auto;padding:0;width:72mm;max-width:72mm}`
    + `.c{text-align:center}.nm{font-size:1rem;font-weight:700}.sl{font-size:.78rem;color:#444;margin-top:2px}`
    + `.d{border-top:1px dashed #bbb;margin:12px 0}.row{display:flex;justify-content:space-between;font-size:.82rem;margin:3px 0}`
    + `.row span:first-child{color:#666}.tot{font-size:.95rem;margin-top:6px;font-weight:700}`
    + `table{width:100%;border-collapse:collapse;font-size:.8rem}th{text-align:left;color:#666;border-bottom:1px solid #ddd;padding:4px}`
    + `td{padding:4px;border-bottom:1px solid #f0f0f0}.r{text-align:right}.fn{margin-top:14px;font-size:.72rem;color:#888;text-align:center;line-height:1.4}`
    + `</style></head><body onload="window.focus();window.print()">`
    + `<div class="c"><div class="nm">${esc(restaurant?.name)}</div>${sellerLines}</div><div class="d"></div>`
    + `<div class="row"><span>${esc(L.number)}</span><strong>${esc(invoice.invoice_number)}</strong></div>`
    + `<div class="row"><span>${esc(L.date)}</span><span>${esc(new Date(invoice.issued_at).toLocaleString(dl))}</span></div>`
    + `<div class="row"><span>${esc(L.status)}</span><span>${esc(L.statusValue)}</span></div><div class="d"></div>`
    + `<table><thead><tr><th>${esc(L.name)}</th><th class="r">${esc(L.qty)}</th><th class="r">${esc(L.vat)}</th><th class="r">${esc(L.total)}</th></tr></thead><tbody>${rows}</tbody></table><div class="d"></div>`
    + `<div class="row"><span>${esc(L.base)}</span><span>${esc(m(invoice.total_base_cents))}</span></div>`
    + `<div class="row"><span>${esc(L.vat)}</span><span>${esc(m(invoice.total_vat_cents))}</span></div>`
    + `<div class="row tot"><span>${esc(L.total)}</span><span>${esc(m(invoice.total_cents))}</span></div>`
    + `<div class="fn">${esc(L.footnote)}</div></body></html>`

  const w = window.open('', '_blank', 'width=460,height=680')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}
