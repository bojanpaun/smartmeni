import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { useContentTranslations } from '../../../lib/useContentTranslations'
import { translateContent, menuBundleFields } from '../../../lib/contentTranslate'
import { bundleItemsTotal, bundlePriceFromPercent, discountPercent } from '../hooks/menuHelpers'
import styles from './BundleManager.module.css'

const EMOJIS = ['🎁','🍱','🍔','🍕','🍝','🥗','🍣','🍰','🍻','🥂','☕','🍦','🌮','🥪','🍗','🧆']

// Upravljanje paketima (combo) za "Ponudu dana". Paket = grupa artikala sa nižom
// cijenom kad se uzme u kompletu. bundle_price je naplaćena cijena; ušteda se računa
// iz aktuelnih cijena artikala (menuHelpers). Naziv/opis se prevode AI-jem (Sloj B).
export default function BundleManager({ restaurant, items, money }) {
  const { t } = useTranslation('admin')
  const tr = useContentTranslations(restaurant?.id)
  const itemName = (it) => tr('menu_item', it.id, 'name', it.name)
  const priceById = Object.fromEntries((items || []).map(i => [i.id, i.price]))

  const [bundles, setBundles] = useState([])
  const [bundleItems, setBundleItems] = useState({}) // { [bundleId]: [{menu_item_id, quantity}] }
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const emptyForm = {
    name: '', description: '', emoji: '🎁', rows: [],
    priceMode: 'price', bundle_price: '', percent: '',
    is_active: true, valid_from: '', valid_until: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (restaurant?.id) load(restaurant.id)
  }, [restaurant?.id])

  const load = async (rid) => {
    const [{ data: bs }, { data: bis }] = await Promise.all([
      supabase.from('menu_bundles').select('*').eq('restaurant_id', rid).order('sort_order'),
      supabase.from('menu_bundle_items').select('bundle_id, menu_item_id, quantity').eq('restaurant_id', rid),
    ])
    setBundles(bs || [])
    const grouped = {}
    for (const r of bis || []) {
      if (!grouped[r.bundle_id]) grouped[r.bundle_id] = []
      grouped[r.bundle_id].push({ menu_item_id: r.menu_item_id, quantity: r.quantity })
    }
    setBundleItems(grouped)
  }

  const openNew = () => {
    setForm(emptyForm); setEditId(null); setErr(''); setShowForm(true)
  }
  const openEdit = (b) => {
    const rows = bundleItems[b.id] || []
    const pct = discountPercent(b.bundle_price, bundleItemsTotal(rows, priceById))
    setForm({
      name: b.name || '', description: b.description || '', emoji: b.emoji || '🎁',
      rows: rows.map(r => ({ ...r })),
      priceMode: 'price', bundle_price: b.bundle_price != null ? b.bundle_price.toString() : '',
      percent: pct != null ? pct.toString() : '',
      is_active: !!b.is_active, valid_from: b.valid_from || '', valid_until: b.valid_until || '',
    })
    setEditId(b.id); setErr(''); setShowForm(true)
  }

  // Zbir aktuelnih cijena artikala u formi (osnov za uštedu i % izvođenje).
  const formSum = bundleItemsTotal(form.rows, priceById)
  // Naplaćena cijena paketa: u 'price' modu direktno iz polja; u 'percent' izvedeno iz zbira.
  const resolvedPrice = form.priceMode === 'percent'
    ? bundlePriceFromPercent(formSum, form.percent)
    : (parseFloat(form.bundle_price) || null)
  const previewPct = discountPercent(resolvedPrice, formSum)

  const addRow = (menuItemId) => {
    if (!menuItemId || form.rows.some(r => r.menu_item_id === menuItemId)) return
    setForm(f => ({ ...f, rows: [...f.rows, { menu_item_id: menuItemId, quantity: 1 }] }))
  }
  const setQty = (id, delta) => {
    setForm(f => ({ ...f, rows: f.rows.map(r => r.menu_item_id === id ? { ...r, quantity: Math.max(1, r.quantity + delta) } : r) }))
  }
  const removeRow = (id) => setForm(f => ({ ...f, rows: f.rows.filter(r => r.menu_item_id !== id) }))

  const save = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) { setErr(t('bmErrName')); return }
    if (form.rows.length < 1) { setErr(t('bmErrItems')); return }
    if (!resolvedPrice || resolvedPrice <= 0) { setErr(t('bmErrPrice')); return }
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      emoji: form.emoji || '🎁',
      bundle_price: resolvedPrice,
      is_active: form.is_active,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    }
    let bundleId = editId
    if (editId) {
      await supabase.from('menu_bundles').update(payload).eq('id', editId).eq('restaurant_id', restaurant.id)
      await supabase.from('menu_bundle_items').delete().eq('bundle_id', editId).eq('restaurant_id', restaurant.id)
    } else {
      const { data, error } = await supabase.from('menu_bundles').insert(payload).select().single()
      if (error) { setErr(error.message); setSaving(false); return }
      bundleId = data.id
    }
    if (bundleId) {
      const rowsPayload = form.rows.map(r => ({
        bundle_id: bundleId, menu_item_id: r.menu_item_id,
        restaurant_id: restaurant.id, quantity: r.quantity,
      }))
      await supabase.from('menu_bundle_items').insert(rowsPayload)
      // AI prevod naziva/opisa paketa (fire-and-forget; gost vidi prevod čim stigne).
      translateContent(restaurant.id, menuBundleFields({ id: bundleId, name: payload.name, description: payload.description })).catch(() => {})
    }
    setSaving(false); setShowForm(false)
    load(restaurant.id)
  }

  const remove = async (b) => {
    if (!confirm(t('bmConfirmDelete', { name: b.name }))) return
    await supabase.from('menu_bundles').delete().eq('id', b.id).eq('restaurant_id', restaurant.id)
    load(restaurant.id)
  }

  const itemsNotAdded = (items || []).filter(i => !form.rows.some(r => r.menu_item_id === i.id))

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>🎁 {t('bmTitle')}</div>
          <div className={styles.subtitle}>{t('bmSubtitle')}</div>
        </div>
        <button className={styles.addBtn} onClick={openNew}>+ {t('bmAdd')}</button>
      </div>

      {bundles.length === 0 ? (
        <div className={styles.empty}>{t('bmEmpty')}</div>
      ) : (
        <div className={styles.list}>
          {bundles.map(b => {
            const rows = bundleItems[b.id] || []
            const sum = bundleItemsTotal(rows, priceById)
            const pct = discountPercent(b.bundle_price, sum)
            const count = rows.reduce((s, r) => s + r.quantity, 0)
            return (
              <div key={b.id} className={styles.row}>
                <span className={styles.rowEmoji}>{b.emoji || '🎁'}</span>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>{tr('menu_bundle', b.id, 'name', b.name)}</div>
                  <div className={styles.rowMeta}>{t('bmItemsCount', { count })}{!b.is_active && <> · <span className={styles.rowInactive}>{t('bmInactive')}</span></>}</div>
                  <div className={styles.rowPrice}>
                    {pct != null && <span className={styles.rowOld}>{money(sum)}</span>}
                    <span className={styles.rowNew}>{money(b.bundle_price)}</span>
                    {pct != null && <span className={styles.rowSave}>−{pct}%</span>}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button className={styles.actionBtn} onClick={() => openEdit(b)}>{t('amEdit')}</button>
                  <button className={styles.actionBtn} onClick={() => remove(b)}>{t('amDelete')}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>{editId ? t('bmEditTitle') : t('bmNewTitle')}</div>
              <button className={styles.close} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form className={styles.form} onSubmit={save}>
              <div className={styles.row2}>
                <div className={styles.field} style={{ flex: '0 0 80px' }}>
                  <label>{t('bmEmoji')}</label>
                  <select value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}>
                    {EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>{t('bmName')} *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
              </div>
              <div className={styles.field}>
                <label>{t('bmDesc')} <span className={styles.hint}>{t('bmTransNote')}</span></label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className={styles.field}>
                <label>{t('bmItems')} *</label>
                <div className={styles.pickerRow}>
                  <select value="" onChange={e => addRow(e.target.value)}>
                    <option value="">{t('bmAddItem')}</option>
                    {itemsNotAdded.map(i => <option key={i.id} value={i.id}>{itemName(i)} — {money(i.price)}</option>)}
                  </select>
                </div>
                {form.rows.length > 0 && (
                  <div className={styles.itemList}>
                    {form.rows.map(r => {
                      const it = items.find(i => i.id === r.menu_item_id)
                      return (
                        <div key={r.menu_item_id} className={styles.itemRow}>
                          <span className={styles.itemName}>{it ? itemName(it) : '—'}</span>
                          <span className={styles.itemPriceSmall}>{it ? money(it.price) : ''}</span>
                          <div className={styles.qtyCtrl}>
                            <button type="button" className={styles.qtyBtn} onClick={() => setQty(r.menu_item_id, -1)}>−</button>
                            <span className={styles.qtyNum}>{r.quantity}</span>
                            <button type="button" className={styles.qtyBtn} onClick={() => setQty(r.menu_item_id, 1)}>+</button>
                          </div>
                          <button type="button" className={styles.removeBtn} onClick={() => removeRow(r.menu_item_id)}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <label>{t('bmPricing')} <span className={styles.hint}>{t('bmPricingHint')}</span></label>
                <div className={styles.modeRow}>
                  <button type="button" className={`${styles.modeBtn} ${form.priceMode === 'price' ? styles.modeBtnActive : ''}`} onClick={() => setForm(f => ({ ...f, priceMode: 'price' }))}>{t('bmModePrice')}</button>
                  <button type="button" className={`${styles.modeBtn} ${form.priceMode === 'percent' ? styles.modeBtnActive : ''}`} onClick={() => setForm(f => ({ ...f, priceMode: 'percent' }))}>{t('bmModePercent')}</button>
                </div>
                {form.priceMode === 'price' ? (
                  <input type="number" step="0.01" min="0" placeholder={t('bmPricePh')}
                    value={form.bundle_price} onChange={e => setForm(f => ({ ...f, bundle_price: e.target.value }))} />
                ) : (
                  <input type="number" step="1" min="1" max="99" placeholder={t('bmPercentPh')}
                    value={form.percent} onChange={e => setForm(f => ({ ...f, percent: e.target.value }))} />
                )}
              </div>

              <div className={styles.summary}>
                <span>{t('bmSumItems')}: {money(formSum)}</span>
                {resolvedPrice != null && <span className={styles.summaryStrong}>{t('bmSumPrice')}: {money(resolvedPrice)}</span>}
                {previewPct != null && <span className={styles.summarySave}>{t('bmSumSave')}: {money(formSum - resolvedPrice)} (−{previewPct}%)</span>}
              </div>

              <div className={styles.row2}>
                <div className={styles.field}>
                  <label>{t('bmValidFrom')}</label>
                  <input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>{t('bmValidUntil')}</label>
                  <input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
                </div>
              </div>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                {t('bmActive')}
              </label>

              {err && <div className={styles.err}>{err}</div>}
              <div className={styles.actions}>
                <button type="button" className={styles.cancel} onClick={() => setShowForm(false)}>{t('cancel')}</button>
                <button type="submit" className={styles.save} disabled={saving}>{saving ? t('saving') : t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
