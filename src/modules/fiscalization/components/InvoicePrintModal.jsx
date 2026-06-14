import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { formatMoney, fromMinorUnits } from '../../../lib/currencies'
import styles from './InvoicePrintModal.module.css'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Pregled + štampa fiskalnog računa. IKOF/JIKR/QR dolaze tek sa FISK-3 (provajder);
// do tada je ovo validan račun sa PDV razradom i numeracijom, status „Čeka fiskalizaciju".
export default function InvoicePrintModal({ invoice, restaurant, onClose }) {
  const { t, i18n } = useTranslation('admin')
  const dl = i18n.language === 'en' ? 'en-US' : 'sr-Latn'
  const [items, setItems] = useState([])
  const m = (cents) => formatMoney(fromMinorUnits(cents, invoice.currency), invoice.currency, i18n.language)

  useEffect(() => {
    let cancelled = false
    supabase.from('invoice_items')
      .select('id, name, quantity, unit_price_cents, vat_rate_key, base_cents, vat_cents, total_cents, sort_order')
      .eq('invoice_id', invoice.id).order('sort_order')
      .then(({ data }) => { if (!cancelled) setItems(data || []) })
    return () => { cancelled = true }
  }, [invoice.id])

  // Štampa kroz ČIST novi prozor — pouzdano (bez modal/overflow/fixed smetnji koje
  // su pravile prazne stranice). Sami nosimo stilove i okidamo print na onload.
  const printReceipt = () => {
    const sellerLines = [restaurant?.location, restaurant?.tax_id && `${t('gsTaxId')}: ${restaurant.tax_id}`,
      restaurant?.vat_number && `${t('gsVatNumber')}: ${restaurant.vat_number}`, restaurant?.iban && `${t('gsIban')}: ${restaurant.iban}`]
      .filter(Boolean).map(l => `<div class="sl">${esc(l)}</div>`).join('')
    const rows = items.map(it => `<tr><td>${esc(it.name)}</td><td class="r">${Number(it.quantity)}</td>`
      + `<td class="r">${esc(it.vat_rate_key || '—')}</td><td class="r">${esc(m(it.total_cents))}</td></tr>`).join('')
    const html = `<!doctype html><html lang="${esc(i18n.language)}"><head><meta charset="utf-8">`
      + `<title>${esc(invoice.invoice_number)}</title><style>`
      + `@page{size:80mm auto;margin:4mm}`  // format računa (ne A4); visina prati sadržaj
      + `*{box-sizing:border-box}body{font-family:ui-monospace,monospace;color:#111;background:#fff;margin:0 auto;padding:0;width:72mm;max-width:72mm}`
      + `.c{text-align:center}.nm{font-size:1rem;font-weight:700}.sl{font-size:.78rem;color:#444;margin-top:2px}`
      + `.d{border-top:1px dashed #bbb;margin:12px 0}.row{display:flex;justify-content:space-between;font-size:.82rem;margin:3px 0}`
      + `.row span:first-child{color:#666}.tot{font-size:.95rem;margin-top:6px;font-weight:700}`
      + `table{width:100%;border-collapse:collapse;font-size:.8rem}th{text-align:left;color:#666;border-bottom:1px solid #ddd;padding:4px}`
      + `td{padding:4px;border-bottom:1px solid #f0f0f0}.r{text-align:right}.fn{margin-top:14px;font-size:.72rem;color:#888;text-align:center;line-height:1.4}`
      + `</style></head><body onload="window.focus();window.print()">`
      + `<div class="c"><div class="nm">${esc(restaurant?.name)}</div>${sellerLines}</div><div class="d"></div>`
      + `<div class="row"><span>${esc(t('fiskColNumber'))}</span><strong>${esc(invoice.invoice_number)}</strong></div>`
      + `<div class="row"><span>${esc(t('fiskColDate'))}</span><span>${esc(new Date(invoice.issued_at).toLocaleString(dl))}</span></div>`
      + `<div class="row"><span>${esc(t('fiskColStatus'))}</span><span>${esc(t('fiskStatPending'))}</span></div><div class="d"></div>`
      + `<table><thead><tr><th>${esc(t('thName'))}</th><th class="r">${esc(t('fiskQty'))}</th><th class="r">${esc(t('fiskColVat'))}</th><th class="r">${esc(t('fiskColTotal'))}</th></tr></thead><tbody>${rows}</tbody></table><div class="d"></div>`
      + `<div class="row"><span>${esc(t('fiskBase'))}</span><span>${esc(m(invoice.total_base_cents))}</span></div>`
      + `<div class="row"><span>${esc(t('fiskColVat'))}</span><span>${esc(m(invoice.total_vat_cents))}</span></div>`
      + `<div class="row tot"><span>${esc(t('fiskColTotal'))}</span><span>${esc(m(invoice.total_cents))}</span></div>`
      + `<div class="fn">${esc(t('fiskNotFiscalizedNote'))}</div></body></html>`
    const w = window.open('', '_blank', 'width=460,height=680')
    if (!w) return  // popup blokiran — modal ostaje kao pregled
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.toolbar}>
          <button className={styles.printBtn} onClick={printReceipt}>🖨️ {t('fiskPrint')}</button>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.receipt} id="invoice-print">
          {/* Prodavac */}
          <div className={styles.seller}>
            <div className={styles.sellerName}>{restaurant?.name}</div>
            {restaurant?.location && <div className={styles.sellerLine}>{restaurant.location}</div>}
            {restaurant?.tax_id && <div className={styles.sellerLine}>{t('gsTaxId')}: {restaurant.tax_id}</div>}
            {restaurant?.vat_number && <div className={styles.sellerLine}>{t('gsVatNumber')}: {restaurant.vat_number}</div>}
            {restaurant?.iban && <div className={styles.sellerLine}>{t('gsIban')}: {restaurant.iban}</div>}
          </div>

          <div className={styles.divider} />

          {/* Zaglavlje računa */}
          <div className={styles.metaRow}><span>{t('fiskColNumber')}</span><strong>{invoice.invoice_number}</strong></div>
          <div className={styles.metaRow}><span>{t('fiskColDate')}</span><span>{new Date(invoice.issued_at).toLocaleString(dl)}</span></div>
          <div className={styles.metaRow}><span>{t('fiskColStatus')}</span><span>{t('fiskStatPending')}</span></div>

          <div className={styles.divider} />

          {/* Stavke */}
          <table className={styles.items}>
            <thead>
              <tr>
                <th>{t('thName')}</th>
                <th className={styles.right}>{t('fiskQty')}</th>
                <th className={styles.right}>{t('fiskColVat')}</th>
                <th className={styles.right}>{t('fiskColTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td>{it.name}</td>
                  <td className={styles.right}>{Number(it.quantity)}</td>
                  <td className={styles.right}>{it.vat_rate_key || '—'}</td>
                  <td className={styles.right}>{m(it.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.divider} />

          {/* Sumarno */}
          <div className={styles.metaRow}><span>{t('fiskBase')}</span><span>{m(invoice.total_base_cents)}</span></div>
          <div className={styles.metaRow}><span>{t('fiskColVat')}</span><span>{m(invoice.total_vat_cents)}</span></div>
          <div className={`${styles.metaRow} ${styles.totalRow}`}><span>{t('fiskColTotal')}</span><strong>{m(invoice.total_cents)}</strong></div>

          <div className={styles.footnote}>{t('fiskNotFiscalizedNote')}</div>
        </div>
      </div>
    </div>
  )
}
