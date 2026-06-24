import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { logAudit } from '../../../lib/auditLog'
import { useMoney } from '../../../lib/useMoney'
import styles from './PurchaseOrders.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

// Status → boja (CSS varijable, nikad hardcoded hex) + prevodni ključ.
const STATUS_BADGE = {
  draft:     { key: 'poStDraft',     bg: 'var(--c-bg-subtle)',   fg: 'var(--c-text-medium)', bd: 'var(--c-border)' },
  approved:  { key: 'poStApproved',  bg: 'var(--c-info-bg)',     fg: 'var(--c-info)',        bd: 'var(--c-info-border)' },
  sent:      { key: 'poStSent',      bg: 'var(--c-accent-bg)',   fg: 'var(--c-accent)',      bd: 'var(--c-accent)' },
  partial:   { key: 'poStPartial',   bg: 'var(--c-warning-bg)',  fg: 'var(--c-warning)',     bd: 'var(--c-warning-border)' },
  received:  { key: 'poStReceived',  bg: 'var(--c-success-bg)',  fg: 'var(--c-success)',     bd: 'var(--c-success-border)' },
  cancelled: { key: 'poStCancelled', bg: 'var(--c-danger-bg)',   fg: 'var(--c-danger)',      bd: 'var(--c-danger-border)' },
}
const FILTERS = ['sve', 'draft', 'approved', 'sent', 'partial', 'received', 'cancelled']
const OPEN_STATUSES = ['draft', 'approved', 'sent', 'partial'] // mogu se otkazati

const blankLine = () => ({ key: Math.random().toString(36).slice(2), item_id: '', item_name: '', unit: '', qty_ordered: '', unit_price: '' })

export default function PurchaseOrdersPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const money = useMoney()

  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [invItems, setInvItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('sve')
  const [busy, setBusy] = useState(false)

  // Editor (draft kreiranje/uređivanje)
  const [editPO, setEditPO] = useState(null) // null = zatvoreno; {} = novi; {...} = uredi
  const [meta, setMeta] = useState({ supplier_id: '', expected_date: '', note: '' })
  const [lines, setLines] = useState([])

  // Detalj/view (ne-draft) + primka
  const [detailPO, setDetailPO] = useState(null)
  const [receiveLines, setReceiveLines] = useState(null) // [{id, item_name, unit, qty_ordered, qty_received, input}]

  const load = async () => {
    if (!restaurant?.id) return
    setLoading(true)
    const [{ data: po }, { data: sup }, { data: items }] = await Promise.all([
      supabase.from('purchase_orders')
        .select('id, po_number, status, order_date, expected_date, received_date, note, supplier_id, suppliers(name), purchase_order_items(id, item_id, item_name, unit, qty_ordered, qty_received, unit_price)')
        .eq('restaurant_id', restaurant.id)
        .order('po_number', { ascending: false }),
      supabase.from('suppliers').select('id, name').eq('restaurant_id', restaurant.id).order('name'),
      supabase.from('inventory_items').select('id, name, unit, cost_per_unit, quantity, min_quantity').eq('restaurant_id', restaurant.id).order('name'),
    ])
    setOrders(po || [])
    setSuppliers(sup || [])
    setInvItems(items || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [restaurant?.id])

  const lineTotal = (l) => (parseFloat(l.qty_ordered) || 0) * (parseFloat(l.unit_price) || 0)
  const poTotal = (po) => (po.purchase_order_items || []).reduce((s, l) => s + (parseFloat(l.qty_ordered) || 0) * (parseFloat(l.unit_price) || 0), 0)

  // ── Editor ──
  const openNew = () => {
    setMeta({ supplier_id: '', expected_date: '', note: '' })
    setLines([blankLine()])
    setEditPO({})
  }
  const openEdit = (po) => {
    setMeta({ supplier_id: po.supplier_id || '', expected_date: po.expected_date || '', note: po.note || '' })
    setLines((po.purchase_order_items || []).map(l => ({
      key: l.id, item_id: l.item_id || '', item_name: l.item_name, unit: l.unit || '',
      qty_ordered: l.qty_ordered ?? '', unit_price: l.unit_price ?? '',
    })))
    setEditPO(po)
  }

  const pickItem = (idx, itemId) => {
    const it = invItems.find(i => i.id === itemId)
    setLines(prev => prev.map((l, i) => i === idx ? {
      ...l, item_id: itemId,
      item_name: it?.name || l.item_name,
      unit: it?.unit || '',
      unit_price: l.unit_price === '' && it?.cost_per_unit != null ? it.cost_per_unit : l.unit_price,
    } : l))
  }

  // approve=true → snimi izmjene pa postavi status 'approved' (odobravanje iz editora).
  const saveDraft = async (e, approve = false) => {
    if (e) e.preventDefault()
    const validLines = lines.filter(l => l.item_id && parseFloat(l.qty_ordered) > 0)
    if (validLines.length === 0) { toast.error(t('poNeedLine')); return }
    setBusy(true)

    let poId = editPO.id
    let poNum = editPO.po_number
    const poPayload = {
      restaurant_id: restaurant.id,
      supplier_id: meta.supplier_id || null,
      expected_date: meta.expected_date || null,
      note: meta.note.trim() || null,
    }

    if (editPO.id) {
      await supabase.from('purchase_orders').update(poPayload).eq('id', editPO.id)
      await supabase.from('purchase_order_items').delete().eq('purchase_order_id', editPO.id)
    } else {
      const { data, error } = await supabase.from('purchase_orders').insert({ ...poPayload, status: 'draft' }).select('id, po_number').single()
      if (error) { setBusy(false); toast.error(t('poSaveErr')); return }
      poId = data.id
      poNum = data.po_number
    }

    const itemsPayload = validLines.map(l => ({
      purchase_order_id: poId,
      restaurant_id: restaurant.id,
      item_id: l.item_id || null,
      item_name: l.item_name || (invItems.find(i => i.id === l.item_id)?.name) || '—',
      unit: l.unit || null,
      qty_ordered: parseFloat(l.qty_ordered) || 0,
      unit_price: l.unit_price === '' ? null : parseFloat(l.unit_price),
    }))
    await supabase.from('purchase_order_items').insert(itemsPayload)

    if (approve) await supabase.from('purchase_orders').update({ status: 'approved' }).eq('id', poId)

    logAudit({
      restaurantId: restaurant.id,
      action: approve ? 'purchase_order.approved' : (editPO.id ? 'purchase_order.updated' : 'purchase_order.created'),
      entityType: 'purchase_order', entityId: poId,
      summary: `${approve ? t('poAudApproved') : (editPO.id ? t('poAudUpdated') : t('poAudCreated'))} #${poNum ?? ''}`,
    })

    setBusy(false)
    setEditPO(null)
    toast.success(approve ? t('poApproved') : t('poSaved'))
    load()
  }

  const deleteDraft = async (po) => {
    if (!confirm(t('poDeleteConfirm', { n: po.po_number }))) return
    await supabase.from('purchase_orders').delete().eq('id', po.id)
    logAudit({ restaurantId: restaurant.id, action: 'purchase_order.deleted', entityType: 'purchase_order', entityId: po.id, summary: `${t('poAudDeleted')} #${po.po_number}` })
    setDetailPO(null)
    setOrders(prev => prev.filter(o => o.id !== po.id))
  }

  // ── Status prelazi ──
  const setStatus = async (po, status, auditAction, auditLabel) => {
    setBusy(true)
    await supabase.from('purchase_orders').update({ status }).eq('id', po.id)
    logAudit({ restaurantId: restaurant.id, action: auditAction, entityType: 'purchase_order', entityId: po.id, summary: `${auditLabel} #${po.po_number}` })
    setBusy(false)
    setDetailPO(null)
    load()
  }

  // ── Primka ──
  const openReceive = (po) => {
    setReceiveLines((po.purchase_order_items || []).map(l => ({
      id: l.id, item_name: l.item_name, unit: l.unit, qty_ordered: l.qty_ordered,
      qty_received: l.qty_received,
      // default na poručenu količinu (ostatak do pune isporuke)
      input: String(l.qty_ordered ?? 0),
    })))
    setDetailPO(po)
  }

  const submitReceive = async () => {
    if (!detailPO || !receiveLines) return
    setBusy(true)
    const payload = receiveLines.map(l => ({ id: l.id, qty_received: parseFloat(l.input) || 0 }))
    const { error } = await supabase.rpc('receive_purchase_order', { p_po_id: detailPO.id, p_lines: payload })
    setBusy(false)
    if (error) { toast.error(t('poReceiveErr')); return }
    logAudit({ restaurantId: restaurant.id, action: 'purchase_order.received', entityType: 'purchase_order', entityId: detailPO.id, summary: `${t('poAudReceived')} #${detailPO.po_number}` })
    setReceiveLines(null)
    setDetailPO(null)
    toast.success(t('poReceiveOk'))
    load()
  }

  // ── Auto-prijedlog ──
  const autoDraft = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('generate_reorder_drafts', { p_restaurant_id: restaurant.id })
    setBusy(false)
    if (error) { toast.error(t('poAutoErr')); return }
    if (!data) { toast(t('poAutoNone')); return }
    logAudit({ restaurantId: restaurant.id, action: 'purchase_order.auto_draft', entityType: 'purchase_order', entityId: null, summary: t('poAudAuto', { n: data }) })
    toast.success(t('poAutoOk', { n: data }))
    load()
  }

  const fmtDate = (d) => d || '—'
  const stBadge = (st) => {
    const b = STATUS_BADGE[st] || STATUS_BADGE.draft
    return <span className={styles.badge} style={{ background: b.bg, color: b.fg, borderColor: b.bd }}>{t(b.key)}</span>
  }

  const filtered = filter === 'sve' ? orders : orders.filter(o => o.status === filter)

  if (loading) return <div className={styles.loading}>{t('invLoading')}</div>

  return (
    <div className={gsStyles.page} style={{ maxWidth: 1040 }}>
      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title}>{t('poTitle')}</h1>
          <p className={gsStyles.subtitle}>{t('poSubtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnSecondary} onClick={autoDraft} disabled={busy} title={t('poAutoHint')}>⚡ {t('poAuto')}</button>
          <button className={styles.btnAdd} onClick={openNew}>+ {t('poNew')}</button>
        </div>
      </div>

      <div className={styles.filters}>
        {FILTERS.map(f => (
          <button key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'sve' ? t('poFilterAll') : t(STATUS_BADGE[f].key)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧾</div>
          <div>{t('poEmpty')}</div>
          <button className={styles.btnAdd} onClick={openNew}>+ {t('poNew')}</button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>{t('poColNum')}</span>
              <span>{t('poColSupplier')}</span>
              <span>{t('poColStatus')}</span>
              <span>{t('poColItems')}</span>
              <span>{t('poColTotal')}</span>
              <span>{t('poColDate')}</span>
              <span></span>
            </div>
            {filtered.map(po => (
              <div key={po.id} className={styles.tableRow} onClick={() => (po.status === 'draft' ? openEdit(po) : setDetailPO(po))}>
                <span className={styles.poNum}>#{po.po_number}</span>
                <span className={styles.poSupplier}>{po.suppliers?.name || t('poNoSupplier')}</span>
                <span>{stBadge(po.status)}</span>
                <span className={styles.poMuted}>{(po.purchase_order_items || []).length}</span>
                <span className={styles.poAmount}>{money(poTotal(po))}</span>
                <span className={styles.poMuted}>{fmtDate(po.order_date)}</span>
                <span className={styles.poMuted} style={{ textAlign: 'right' }}>
                  {po.status === 'draft' ? '✏️' : '👁'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Editor (draft) ── */}
      {editPO && (
        <div className={styles.overlay} onClick={() => setEditPO(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editPO.id ? `${t('poEdit')} #${editPO.po_number}` : t('poNew')}</div>
              <button className={styles.modalClose} onClick={() => setEditPO(null)}>✕</button>
            </div>
            <form className={styles.form} onSubmit={saveDraft}>
              <div className={styles.metaGrid}>
                <div className={styles.field}>
                  <label>{t('poFieldSupplier')}</label>
                  <select value={meta.supplier_id} onChange={e => setMeta(m => ({ ...m, supplier_id: e.target.value }))}>
                    <option value="">{t('poNoSupplier')}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{t('poFieldExpected')}</label>
                  <input type="date" value={meta.expected_date} onChange={e => setMeta(m => ({ ...m, expected_date: e.target.value }))} />
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <label>{t('poFieldNote')}</label>
                  <input value={meta.note} onChange={e => setMeta(m => ({ ...m, note: e.target.value }))} placeholder={t('poNotePh')} />
                </div>
              </div>

              <div className={styles.linesHead}>{t('poLines')}</div>
              {lines.map((l, idx) => (
                <div key={l.key} className={styles.lineRow}>
                  <select value={l.item_id} onChange={e => pickItem(idx, e.target.value)} required>
                    <option value="">{t('poPickItem')}</option>
                    {invItems.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                  </select>
                  <input type="number" min="0" step="0.001" placeholder={t('poQty')}
                    value={l.qty_ordered} onChange={e => setLines(prev => prev.map((x, i) => i === idx ? { ...x, qty_ordered: e.target.value } : x))} />
                  <input type="number" min="0" step="0.01" placeholder={t('poUnitPrice')}
                    value={l.unit_price} onChange={e => setLines(prev => prev.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} />
                  <button type="button" className={styles.lineDel} onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))} title={t('delete')}>🗑️</button>
                </div>
              ))}
              <button type="button" className={styles.addLine} onClick={() => setLines(prev => [...prev, blankLine()])}>+ {t('poAddLine')}</button>

              <div className={styles.totalRow}>
                <span>{t('poColTotal')}:</span>
                <span>{money(lines.reduce((s, l) => s + lineTotal(l), 0))}</span>
              </div>

              <div className={styles.formActions}>
                {editPO.id && <button type="button" className={styles.btnCancelPo} onClick={() => deleteDraft(editPO)}>🗑️ {t('poDelete')}</button>}
                <button type="button" className={styles.btnCancelForm} onClick={() => setEditPO(null)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnSave} disabled={busy}>{busy ? t('saving') : t('poSaveDraft')}</button>
                <button type="button" className={styles.btnApprove} disabled={busy} onClick={(e) => saveDraft(e, true)}>✓ {t('poApprove')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detalj (ne-draft) + akcije + primka ── */}
      {detailPO && (
        <div className={styles.overlay} onClick={() => { setDetailPO(null); setReceiveLines(null) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{t('poTitle')} #{detailPO.po_number} {stBadge(detailPO.status)}</div>
              <button className={styles.modalClose} onClick={() => { setDetailPO(null); setReceiveLines(null) }}>✕</button>
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.poMuted}>{t('poFieldSupplier')}: <strong>{detailPO.suppliers?.name || t('poNoSupplier')}</strong></div>
              <div className={styles.poMuted}>{t('poColDate')}: <strong>{fmtDate(detailPO.order_date)}</strong></div>
              {detailPO.expected_date && <div className={styles.poMuted}>{t('poFieldExpected')}: <strong>{detailPO.expected_date}</strong></div>}
              {detailPO.received_date && <div className={styles.poMuted}>{t('poReceivedDate')}: <strong>{detailPO.received_date}</strong></div>}
            </div>
            {detailPO.note && <div className={styles.poMuted} style={{ marginTop: 8 }}>{detailPO.note}</div>}

            {!receiveLines ? (
              <>
                <div className={styles.linesHead} style={{ marginTop: 12 }}>{t('poLines')}</div>
                {(detailPO.purchase_order_items || []).map(l => {
                  const full = parseFloat(l.qty_received) >= parseFloat(l.qty_ordered)
                  return (
                    <div key={l.id} className={styles.lineRowView}>
                      <span className={styles.lineName}>{l.item_name}</span>
                      <span className={styles.lineMuted}>{l.qty_ordered} {l.unit || ''}</span>
                      <span className={parseFloat(l.qty_received) > 0 ? (full ? styles.lineRecvFull : styles.lineRecvPartial) : styles.lineMuted}>
                        {t('poRecv')}: {l.qty_received}
                      </span>
                      <span className={styles.lineMuted} style={{ textAlign: 'right' }}>{l.unit_price != null ? money(l.unit_price) : '—'}</span>
                    </div>
                  )
                })}
                <div className={styles.totalRow}>
                  <span>{t('poColTotal')}:</span>
                  <span>{money(poTotal(detailPO))}</span>
                </div>

                <div className={styles.formActions}>
                  {detailPO.status === 'approved' && (
                    <button className={styles.btnSend} disabled={busy}
                      onClick={() => setStatus(detailPO, 'sent', 'purchase_order.sent', t('poAudSent'))}>📤 {t('poSend')}</button>
                  )}
                  {detailPO.status === 'sent' || detailPO.status === 'partial' ? (
                    <button className={styles.btnReceive} disabled={busy} onClick={() => openReceive(detailPO)}>📥 {t('poReceive')}</button>
                  ) : null}
                  {OPEN_STATUSES.includes(detailPO.status) && (
                    <button className={styles.btnCancelPo} disabled={busy}
                      onClick={() => { if (confirm(t('poCancelConfirm', { n: detailPO.po_number }))) setStatus(detailPO, 'cancelled', 'purchase_order.cancelled', t('poAudCancelled')) }}>
                      {t('poCancel')}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.linesHead} style={{ marginTop: 12 }}>{t('poReceiveHead')}</div>
                {receiveLines.map((l, idx) => (
                  <div key={l.id} className={styles.lineRow} style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                    <span className={styles.lineName}>{l.item_name} <span className={styles.lineMuted}>({t('poOrdered')}: {l.qty_ordered} {l.unit || ''})</span></span>
                    <span className={styles.lineMuted}>{t('poRecv')}: {l.qty_received}</span>
                    <input type="number" min="0" step="0.001" value={l.input}
                      onChange={e => setReceiveLines(prev => prev.map((x, i) => i === idx ? { ...x, input: e.target.value } : x))} />
                  </div>
                ))}
                <div className={styles.formActions}>
                  <button className={styles.btnCancelForm} onClick={() => setReceiveLines(null)}>{t('cancel')}</button>
                  <button className={styles.btnReceive} disabled={busy} onClick={submitReceive}>{busy ? t('saving') : t('poConfirmReceive')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
