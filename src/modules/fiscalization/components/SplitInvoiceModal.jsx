import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { formatMoney } from '../../../lib/currencies'
import styles from './SplitInvoiceModal.module.css'

// Razbijanje izvora (narudžba/folio/spa) na 2+ računa. Dva moda:
//  • po stavkama — svaka stavka se dodijeli računu (Račun 1/2/…)
//  • jednaka podjela — svaki od N računa dobije 1/N svake stavke
// Poziva create_split_invoices (atomarno, blokira ako je izvor već fakturisan).
export default function SplitInvoiceModal({ restaurant, source, onClose, onDone }) {
  const { t, i18n } = useTranslation('admin')
  const cur = restaurant?.currency
  const m = (cents) => formatMoney((cents || 0) / 100, cur, i18n.language)

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('items')      // 'items' | 'equal'
  const [groupCount, setGroupCount] = useState(2)
  const [assign, setAssign] = useState([])        // assign[i] = indeks grupe za stavku i
  const [equalN, setEqualN] = useState(2)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_invoice_source_items', {
      p_restaurant_id: restaurant.id, p_source_type: source.source_type, p_source_id: source.source_id,
    }).then(({ data }) => {
      if (cancelled) return
      const arr = Array.isArray(data) ? data : []
      setItems(arr)
      setAssign(arr.map(() => 0))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [restaurant.id, source.source_type, source.source_id])

  const lineCents = (it) => Math.round((Number(it.quantity) || 0) * (Number(it.unit_price_cents) || 0))

  // Pregled iznosa po grupi (po stavkama).
  const groupTotals = Array.from({ length: groupCount }, (_, g) =>
    items.reduce((sum, it, i) => sum + (assign[i] === g ? lineCents(it) : 0), 0))

  const buildGroups = () => {
    if (mode === 'equal') {
      const n = Math.max(2, Math.min(20, parseInt(equalN) || 2))
      return Array.from({ length: n }, () =>
        items.map(it => ({ name: it.name, quantity: (Number(it.quantity) || 0) / n, unit_price_cents: it.unit_price_cents, vat_rate_key: it.vat_rate_key })))
    }
    // po stavkama — grupiraj po assign, izbaci prazne
    const groups = []
    for (let g = 0; g < groupCount; g++) {
      const gi = items.filter((_, i) => assign[i] === g)
        .map(it => ({ name: it.name, quantity: it.quantity, unit_price_cents: it.unit_price_cents, vat_rate_key: it.vat_rate_key }))
      if (gi.length) groups.push(gi)
    }
    return groups
  }

  const submit = async () => {
    const groups = buildGroups()
    if (groups.length < 2) { toast.error(t('fiskSplitMinGroups')); return }
    setSaving(true)
    const { error } = await supabase.rpc('create_split_invoices', {
      p_restaurant_id: restaurant.id, p_source_type: source.source_type, p_source_id: source.source_id, p_groups: groups,
    })
    setSaving(false)
    if (error) { toast.error(t('fiskSplitErr')); return }
    toast.success(t('fiskSplitDone', { n: groups.length }))
    onDone?.()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.title}>✂️ {t('fiskSplitTitle')}</div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>
        <div className={styles.sub}>{source.ref_label} · {m(source.total_amount * 100)}</div>

        <div className={styles.modeRow}>
          <button className={`${styles.modeBtn} ${mode === 'items' ? styles.modeOn : ''}`} onClick={() => setMode('items')}>{t('fiskSplitByItems')}</button>
          <button className={`${styles.modeBtn} ${mode === 'equal' ? styles.modeOn : ''}`} onClick={() => setMode('equal')}>{t('fiskSplitEqual')}</button>
        </div>

        {loading ? (
          <div className={styles.muted}>{t('loading')}</div>
        ) : mode === 'equal' ? (
          <div className={styles.equalBox}>
            <label>{t('fiskSplitNShares')}</label>
            <input type="number" min="2" max="20" value={equalN} onChange={e => setEqualN(e.target.value)} />
            <div className={styles.equalHint}>{t('fiskSplitEqualHint', { each: m(Math.round((source.total_amount * 100) / Math.max(2, parseInt(equalN) || 2))) })}</div>
          </div>
        ) : (
          <>
            <div className={styles.groupCtl}>
              <span>{t('fiskSplitGroupCount', { n: groupCount })}</span>
              <div className={styles.groupBtns}>
                <button disabled={groupCount <= 2} onClick={() => { setGroupCount(c => c - 1); setAssign(a => a.map(x => Math.min(x, groupCount - 2))) }}>−</button>
                <button disabled={groupCount >= 6} onClick={() => setGroupCount(c => c + 1)}>+</button>
              </div>
            </div>
            <div className={styles.itemList}>
              {items.map((it, i) => (
                <div key={i} className={styles.itemRow}>
                  <div className={styles.itemName}>{Number(it.quantity)}× {it.name}</div>
                  <div className={styles.itemRight}>
                    <span className={styles.itemPrice}>{m(lineCents(it))}</span>
                    <div className={styles.assignBtns}>
                      {Array.from({ length: groupCount }, (_, g) => (
                        <button key={g} className={`${styles.gBtn} ${assign[i] === g ? styles.gBtnOn : ''}`}
                          onClick={() => setAssign(a => a.map((x, idx) => idx === i ? g : x))}>{g + 1}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.totals}>
              {groupTotals.map((tot, g) => (
                <span key={g} className={styles.totChip}>{t('fiskSplitGroupShort', { n: g + 1 })}: <strong>{m(tot)}</strong></span>
              ))}
            </div>
          </>
        )}

        <div className={styles.actions}>
          <button className={styles.btnGhost} onClick={onClose}>{t('cancel')}</button>
          <button className={styles.btnPrimary} disabled={saving || loading} onClick={submit}>
            {saving ? t('saving') : t('fiskSplitConfirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
