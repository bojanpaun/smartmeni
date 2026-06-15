import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { formatMoney, fromMinorUnits } from '../../../lib/currencies'
import s from '../StaffPortal.module.css'

// Naplata po stolu — aktivni order-računi (get_order_invoices), grupisani po stolu.
// Konobar označava keš/kartica; realtime preko invoices kanala. Spec: chat 2026-06-15.
export default function NaplataView({ restaurant }) {
  const { t, i18n } = useTranslation('staffportal')
  const restaurantId = restaurant?.id
  const money = (cents, cur) => formatMoney(fromMinorUnits(cents, cur || restaurant?.currency), cur || restaurant?.currency, i18n.language)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null) // invoice id u toku
  const [filter, setFilter] = useState('unpaid') // 'unpaid' (default) | 'paid' | 'all'

  const load = useCallback(async () => {
    if (!restaurantId) return
    const { data } = await supabase.rpc('get_order_invoices', { p_restaurant_id: restaurantId })
    setRows(data || [])
    setLoading(false)
  }, [restaurantId])

  useEffect(() => { load() }, [load])

  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load }, [load])
  useEffect(() => {
    if (!restaurantId) return
    const ch = supabase.channel(`naplata-portal-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices',
        filter: `restaurant_id=eq.${restaurantId}` }, () => loadRef.current())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [restaurantId])

  const mark = async (inv, method, paid = true) => {
    setBusy(inv.id)
    const { error } = await supabase.rpc('mark_invoice_paid', { p_invoice_id: inv.id, p_method: method, p_paid: paid })
    setBusy(null)
    if (error) { toast.error(t('markPaidErr')); return }
    load()
  }

  if (loading) return <div className={s.loadingInline}>{t('loading')}</div>
  if (rows.length === 0) return (
    <div className={s.empty}><div className={s.emptyIcon}>💶</div><div className={s.emptyText}>{t('naplataEmpty')}</div></div>
  )

  // Filter (default neplaćeni — da pregled ostane pregledan); pa grupiši po stolu.
  const shown = rows.filter(r => filter === 'all' || r.payment_status === filter)
  const byTable = {}
  for (const r of shown) { (byTable[r.table_number] ||= []).push(r) }
  const tables = Object.entries(byTable).map(([tableNo, invs]) => {
    const unpaid = invs.filter(i => i.payment_status === 'unpaid')
    const unpaidCents = unpaid.reduce((sum, i) => sum + i.total_cents, 0)
    return { tableNo, invs, unpaidCount: unpaid.length, unpaidCents, cur: invs[0]?.currency }
  }).sort((a, b) => (b.unpaidCount - a.unpaidCount) || String(a.tableNo).localeCompare(String(b.tableNo), undefined, { numeric: true }))

  const FILTERS = [['unpaid', t('filtUnpaid')], ['paid', t('paidBadge')], ['all', t('filtAll')]]

  return (
    <div>
      <div className={s.naplataFilters}>
        {FILTERS.map(([key, label]) => (
          <button key={key}
            className={`${s.naplataFilterChip} ${filter === key ? s.naplataFilterActive : ''}`}
            onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {tables.length === 0 ? (
        <div className={s.empty}><div className={s.emptyText}>{t('naplataNoMatch')}</div></div>
      ) : (
      <div className={s.naplataList}>
      {tables.map(tb => (
        <div key={tb.tableNo} className={s.naplataCard}>
          <div className={s.naplataHead}>
            <span className={s.naplataTable}>🪑 {t('table')} {tb.tableNo}</span>
            {tb.unpaidCount > 0
              ? <span className={s.naplataDue}>{tb.unpaidCount} {t('naplataUnpaid')} · {money(tb.unpaidCents, tb.cur)}</span>
              : <span className={s.naplataAllPaid}>✓ {t('paidBadge')}</span>}
          </div>
          {tb.invs.map(inv => (
            <div key={inv.id} className={s.naplataRow}>
              <div className={s.naplataInvInfo}>
                <code className={s.naplataInvNo}>{inv.invoice_number}</code>
                <span className={s.naplataInvTotal}>{money(inv.total_cents, inv.currency)}</span>
              </div>
              {inv.payment_status === 'unpaid' ? (
                <div className={s.naplataActions}>
                  <button className={s.payBtn} disabled={busy === inv.id} onClick={() => mark(inv, 'cash')}>💵 {t('payCash')}</button>
                  <button className={s.payBtn} disabled={busy === inv.id} onClick={() => mark(inv, 'card')}>💳 {t('payCard')}</button>
                </div>
              ) : (
                <div className={s.naplataPaidWrap}>
                  <span className={s.naplataPaid}>✓ {t('paidBadge')}{inv.paid_method ? ` · ${t(inv.paid_method === 'card' ? 'payCard' : 'payCash')}` : ''}</span>
                  <button className={s.undoBtn} disabled={busy === inv.id} onClick={() => mark(inv, null, false)} title={t('undoPay')}>↩</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      </div>
      )}
    </div>
  )
}
