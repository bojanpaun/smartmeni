import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { formatMoney, fromMinorUnits } from '../../../lib/currencies'
import styles from './InvoicePrintModal.module.css'

// Pregled + štampa fiskalnog računa. IKOF/JIKR/QR dolaze tek sa FISK-3 (provajder);
// do tada je ovo validan račun sa PDV razradom i numeracijom, status „Na čekanju".
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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.toolbar}>
          <button className={styles.printBtn} onClick={() => window.print()}>🖨️ {t('fiskPrint')}</button>
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
