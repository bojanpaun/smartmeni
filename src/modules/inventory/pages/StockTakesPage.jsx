import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import { logAudit } from '../../../lib/auditLog'
import { useMoney } from '../../../lib/useMoney'
import styles from './StockTakes.module.css'
import gsStyles from '../../menu/pages/GeneralSettings.module.css'

// Kategorije zalihe (vrijednost u bazi ostaje crnogorska) → prevodni ključ.
const CATEGORIES = ['namirnice', 'piće', 'alkohol', 'začini', 'ambalaža', 'ostalo']
const CAT_KEYS = {
  namirnice: 'invCatNamirnice', 'piće': 'invCatPice', alkohol: 'invCatAlkohol',
  'začini': 'invCatZacini', 'ambalaža': 'invCatAmbalaza', ostalo: 'invCatOstalo',
}
const STATUS_BADGE = {
  open:   { key: 'stStOpen',   bg: 'var(--c-info-bg)',    fg: 'var(--c-info)',    bd: 'var(--c-info-border)' },
  closed: { key: 'stStClosed', bg: 'var(--c-success-bg)', fg: 'var(--c-success)', bd: 'var(--c-success-border)' },
}

export default function StockTakesPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const money = useMoney()

  const [takes, setTakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', category: 'sve' })

  const [active, setActive] = useState(null)      // otvorena inventura (sa stavkama)
  const [counts, setCounts] = useState({})         // { sti_id: counted_input }

  const catLabel = (c) => t(CAT_KEYS[c] || 'invCatOstalo')

  const loadList = async () => {
    if (!restaurant?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('stock_takes')
      .select('id, name, category, status, take_date, total_diff_value, stock_take_items(id)')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
    setTakes(data || [])
    setLoading(false)
  }
  useEffect(() => { loadList() }, [restaurant?.id])

  const openTake = async (st) => {
    const { data } = await supabase
      .from('stock_take_items')
      .select('id, item_name, unit, expected_qty, counted_qty, cost_per_unit')
      .eq('stock_take_id', st.id)
      .order('item_name')
    const items = data || []
    setActive({ ...st, items })
    setCounts(Object.fromEntries(items.map(i => [i.id, i.counted_qty == null ? '' : String(i.counted_qty)])))
  }

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('create_stock_take', {
      p_restaurant_id: restaurant.id,
      p_name: createForm.name.trim() || null,
      p_category: createForm.category === 'sve' ? null : createForm.category,
    })
    setBusy(false)
    if (error || !data) { toast.error(t('stCreateErr')); return }
    logAudit({
      restaurantId: restaurant.id, action: 'stock_take.created',
      entityType: 'stock_take', entityId: data,
      summary: `${t('stAudCreated')}${createForm.name.trim() ? ': ' + createForm.name.trim() : ''}`,
    })
    setShowCreate(false)
    setCreateForm({ name: '', category: 'sve' })
    toast.success(t('stCreated'))
    await loadList()
    // otvori novokreiranu
    const { data: st } = await supabase.from('stock_takes')
      .select('id, name, category, status, take_date, total_diff_value').eq('id', data).single()
    if (st) openTake(st)
  }

  const diffOf = (it) => {
    const c = counts[it.id]
    if (c === '' || c == null) return null
    return parseFloat(c) - parseFloat(it.expected_qty)
  }
  const valueOf = (it) => {
    const d = diffOf(it)
    if (d == null) return 0
    return d * (parseFloat(it.cost_per_unit) || 0)
  }
  const totalValue = () => (active?.items || []).reduce((s, it) => s + valueOf(it), 0)

  const saveCounts = async () => {
    if (!active) return
    setBusy(true)
    // Ažuriraj samo izmijenjene counted_qty (po stavci)
    const updates = active.items
      .map(it => {
        const raw = counts[it.id]
        const val = raw === '' || raw == null ? null : parseFloat(raw)
        return { id: it.id, counted_qty: val }
      })
      .filter(u => {
        const orig = active.items.find(i => i.id === u.id).counted_qty
        return (orig == null ? null : parseFloat(orig)) !== u.counted_qty
      })
    for (const u of updates) {
      await supabase.from('stock_take_items').update({ counted_qty: u.counted_qty }).eq('id', u.id)
    }
    setActive(a => ({ ...a, items: a.items.map(it => ({ ...it, counted_qty: counts[it.id] === '' || counts[it.id] == null ? null : parseFloat(counts[it.id]) })) }))
    setBusy(false)
    toast.success(t('stCountsSaved'))
  }

  const closeTake = async () => {
    if (!active) return
    if (!confirm(t('stCloseConfirm'))) return
    setBusy(true)
    await saveCounts()
    const { data, error } = await supabase.rpc('close_stock_take', { p_stock_take_id: active.id })
    setBusy(false)
    if (error) { toast.error(t('stCloseErr')); return }
    logAudit({
      restaurantId: restaurant.id, action: 'stock_take.closed',
      entityType: 'stock_take', entityId: active.id,
      summary: `${t('stAudClosed')}${active.name ? ': ' + active.name : ''} (${money(data || 0)})`,
      metadata: { total_diff_value: data },
    })
    toast.success(t('stClosed'))
    setActive(null)
    loadList()
  }

  const stBadge = (st) => {
    const b = STATUS_BADGE[st] || STATUS_BADGE.open
    return <span className={styles.badge} style={{ background: b.bg, color: b.fg, borderColor: b.bd }}>{t(b.key)}</span>
  }
  const valClass = (v) => v > 0 ? styles.ciDiffPos : v < 0 ? styles.ciDiffNeg : styles.ciDiffZero

  if (loading) return <div className={styles.loading}>{t('invLoading')}</div>

  // ── Detalj: brojanje (open) ili izvještaj (closed) ──
  if (active) {
    const isOpen = active.status === 'open'
    return (
      <div className={gsStyles.page} style={{ maxWidth: 900 }}>
        <div className={styles.header}>
          <div>
            <h1 className={gsStyles.title}>{active.name || t('stUntitled')}</h1>
            <div className={styles.subTitle}>
              {stBadge(active.status)}
              <span className={styles.stMuted}>{active.take_date}</span>
              {active.category && <span className={styles.stMuted}>· {catLabel(active.category)}</span>}
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.btnBack} onClick={() => setActive(null)}>← {t('stBack')}</button>
          </div>
        </div>

        <div className={styles.summaryBar}>
          <span className={styles.summaryTotal}>
            {t('stTotalDiff')}: {money(active.status === 'closed' ? (active.total_diff_value || 0) : totalValue())}
          </span>
          {isOpen && (
            <div className={styles.summaryActions}>
              <button className={styles.btnSave} onClick={saveCounts} disabled={busy}>{busy ? t('saving') : t('stSaveCounts')}</button>
              <button className={styles.btnClose} onClick={closeTake} disabled={busy}>🔒 {t('stClose')}</button>
            </div>
          )}
        </div>

        <div className={styles.countWrap}>
          <div className={styles.countHeader}>
            <span>{t('stColItem')}</span>
            <span>{t('stColExpected')}</span>
            <span>{t('stColCounted')}</span>
            <span>{t('stColDiff')}</span>
            <span style={{ textAlign: 'right' }}>{t('stColValue')}</span>
          </div>
          {(active.items || []).map(it => {
            const d = diffOf(it)
            const v = valueOf(it)
            return (
              <div key={it.id} className={styles.countRow}>
                <span className={styles.ciName}>{it.item_name} {it.unit && <span className={styles.stMuted}>({it.unit})</span>}</span>
                <span className={styles.ciExpected}>{parseFloat(it.expected_qty).toLocaleString('sr')}</span>
                {isOpen ? (
                  <input className={styles.ciInput} type="number" min="0" step="0.001"
                    value={counts[it.id] ?? ''} placeholder="—"
                    onChange={e => setCounts(c => ({ ...c, [it.id]: e.target.value }))} />
                ) : (
                  <span className={styles.ciCounted}>{it.counted_qty == null ? '—' : parseFloat(it.counted_qty).toLocaleString('sr')}</span>
                )}
                <span className={d == null ? styles.ciDiffZero : valClass(d)}>
                  {d == null ? '—' : (d > 0 ? '+' : '') + d.toLocaleString('sr')}
                </span>
                <span className={`${styles.ciValue} ${d == null ? '' : valClass(v)}`}>
                  {d == null ? '—' : money(v)}
                </span>
              </div>
            )
          })}
          {(active.items || []).length === 0 && (
            <div className={styles.empty} style={{ padding: '2rem 1rem' }}>{t('stNoItems')}</div>
          )}
        </div>
      </div>
    )
  }

  // ── Lista inventura ──
  return (
    <div className={gsStyles.page} style={{ maxWidth: 900 }}>
      <div className={styles.header}>
        <div>
          <h1 className={gsStyles.title}>{t('stTitle')}</h1>
          <p className={gsStyles.subtitle}>{t('stSubtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnAdd} onClick={() => setShowCreate(true)}>+ {t('stNew')}</button>
        </div>
      </div>

      {takes.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🧮</div>
          <div>{t('stEmpty')}</div>
          <button className={styles.btnAdd} onClick={() => setShowCreate(true)}>+ {t('stNew')}</button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.table}>
            <div className={styles.listHeader}>
              <span>{t('stColName')}</span>
              <span>{t('stColCategory')}</span>
              <span>{t('stColStatus')}</span>
              <span>{t('stColItems')}</span>
              <span style={{ textAlign: 'right' }}>{t('stColValue')}</span>
            </div>
            {takes.map(st => (
              <div key={st.id} className={styles.listRow} onClick={() => openTake(st)}>
                <div>
                  <div className={styles.stName}>{st.name || t('stUntitled')}</div>
                  <div className={styles.stMuted}>{st.take_date}</div>
                </div>
                <span className={styles.stMuted}>{st.category ? catLabel(st.category) : t('stAllCats')}</span>
                <span>{stBadge(st.status)}</span>
                <span className={styles.stMuted}>{(st.stock_take_items || []).length}</span>
                <span style={{ textAlign: 'right' }}>
                  {st.status === 'closed' && st.total_diff_value != null
                    ? <span className={(st.total_diff_value || 0) < 0 ? styles.stValNeg : styles.stValPos}>{money(st.total_diff_value)}</span>
                    : <span className={styles.stMuted}>—</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className={styles.overlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{t('stNew')}</div>
              <button className={styles.modalClose} onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form className={styles.form} onSubmit={create}>
              <div className={styles.field}>
                <label>{t('stNameLabel')}</label>
                <input value={createForm.name} placeholder={t('stNamePh')}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>{t('stCategoryLabel')}</label>
                <select value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="sve">{t('stAllCats')}</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                </select>
              </div>
              <div className={styles.hint}>{t('stCreateHint')}</div>
              <div className={styles.formActions}>
                <button type="button" className={styles.btnCancelForm} onClick={() => setShowCreate(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.btnSave} disabled={busy}>{busy ? t('saving') : t('stCreateStart')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
