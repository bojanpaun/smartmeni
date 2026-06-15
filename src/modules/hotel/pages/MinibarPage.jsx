import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import { useLibraryTranslations } from '../../../lib/useLibraryTranslations'
import { useTaxRates } from '../../../lib/useTaxRates'
import { useMoney } from '../../../lib/useMoney'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

const BLANK = { name: '', price: '', vat_rate_key: '', is_active: true }

export default function MinibarPage() {
  const { restaurant } = usePlatform()
  const { t } = useTranslation('admin')
  const lt = useLibraryTranslations()
  const { rates: taxRates } = useTaxRates(restaurant?.id)
  const money = useMoney()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  // Biblioteka minibara (multi-uvoz)
  const [showLib, setShowLib] = useState(false)
  const [libItems, setLibItems] = useState([])
  const [libLoading, setLibLoading] = useState(false)
  const [libSel, setLibSel] = useState(() => new Set())
  const [libBusy, setLibBusy] = useState(false)
  const [libMsg, setLibMsg] = useState('')

  const load = async () => {
    if (!restaurant?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('minibar_items')
      .select('id, name, price, vat_rate_key, is_active, sort_order')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order').order('name')
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [restaurant?.id])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (it) => { setEditing(it.id); setForm({ name: it.name, price: it.price ?? '', vat_rate_key: it.vat_rate_key ?? '', is_active: it.is_active }); setShowForm(true) }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      name:          form.name.trim(),
      price:         form.price === '' ? null : Number(form.price),
      vat_rate_key:  form.vat_rate_key || null,
      is_active:     form.is_active,
    }
    if (editing) await supabase.from('minibar_items').update(payload).eq('id', editing)
    else await supabase.from('minibar_items').insert(payload)
    setSaving(false)
    close()
    load()
  }

  const remove = async (id) => {
    if (!window.confirm(t('htDeleteItemConfirm'))) return
    await supabase.from('minibar_items').delete().eq('id', id)
    load()
  }

  const openLib = async () => {
    setShowLib(true); setLibMsg(''); setLibSel(new Set()); setLibLoading(true)
    const { data } = await supabase
      .from('minibar_library')
      .select('id, name, category, suggested_price')
      .eq('is_active', true)
      .order('sort_order').order('name')
    setLibItems(data ?? [])
    setLibLoading(false)
  }
  const toggleSel = (id) => setLibSel(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const importSelected = async () => {
    if (libSel.size === 0) return
    setLibBusy(true)
    const { data, error } = await supabase.rpc('import_minibar_items', {
      p_restaurant_id: restaurant.id, p_ids: [...libSel],
    })
    setLibBusy(false)
    if (error) { setLibMsg(t('htErr') + ': ' + error.message); return }
    setShowLib(false)
    load()
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('htTypeMinibar')}</h1>
          <p className={styles.subtitle}>{t('htMinibarSub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={openLib} title={t('libBtnHint')}>📚 {t('htFromLibrary')}</button>
          <button className={styles.btnPrimary} onClick={openNew}>+ {t('htAddItem')}</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 14, lineHeight: 1.4 }}>📚 {t('libBtnHint')}</div>

      {showLib && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>📚 {t('htMinibarLibTitle')}</div>
            <button onClick={() => setShowLib(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--c-text-muted)' }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12, lineHeight: 1.4 }}>{t('libBtnHint')}</div>
          {libMsg && <div style={{ color: 'var(--c-danger)', fontSize: 13, marginBottom: 8 }}>{libMsg}</div>}
          {libLoading ? <LoadingSpinner /> : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                {libItems.map(it => (
                  <label key={it.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                    border: `1px solid ${libSel.has(it.id) ? 'var(--c-primary)' : 'var(--c-border)'}`,
                    borderRadius: 8, background: libSel.has(it.id) ? 'var(--c-primary-light)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={libSel.has(it.id)} onChange={() => toggleSel(it.id)} />
                    <span style={{ fontSize: 13 }}>{lt('minibar_library', it.id, 'name', it.name)}{it.suggested_price != null ? ` · ${money(it.suggested_price)}` : ''}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button className={styles.btnSecondary} onClick={() => setShowLib(false)}>{t('cancel')}</button>
                <button className={styles.btnPrimary} onClick={importSelected} disabled={libBusy || libSel.size === 0}>
                  {libBusy ? t('htImporting') : t('htImportSelected', { n: libSel.size })}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showForm && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 180px', minWidth: 160, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('htFieldName')} *</label>
              <input className={styles.input} style={{ width: '100%', boxSizing: 'border-box' }} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="npr. Coca-Cola 0.33" />
            </div>
            <div style={{ flex: '0 1 110px', minWidth: 90, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('htPriceEur')}</label>
              <input className={styles.input} style={{ width: '100%', boxSizing: 'border-box' }} type="number" min="0" step="0.01" value={form.price} onChange={e => upd('price', e.target.value)} />
            </div>
            {taxRates.length > 0 && (
              <div style={{ flex: '1 1 150px', minWidth: 130, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>{t('amVatRate')}</label>
                <select className={styles.input} style={{ width: '100%', boxSizing: 'border-box' }} value={form.vat_rate_key || ''} onChange={e => upd('vat_rate_key', e.target.value || null)}>
                  <option value="">{t('amVatRateNone')}</option>
                  {taxRates.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
              <span style={{ fontSize: 13 }}>{t('htActive')}</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className={styles.btnSecondary} onClick={close}>{t('cancel')}</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>
          {t('htNoMinibarItems')}
        </div>
      ) : (
        <div className={`${styles.table} ${styles.tableScroll}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>{t('htItemHead')}</th>
                <th style={{ padding: '10px 12px' }}>{t('htPriceHead')}</th>
                <th style={{ padding: '10px 12px' }}>{t('htFieldStatus')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.name}</td>
                  <td style={{ padding: '10px 12px' }}>{it.price != null ? money(it.price) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{it.is_active ? '✓' : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(it)}>{t('htEdit')}</button>
                      <button
                        style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }}
                        onClick={() => remove(it.id)}
                      >{t('htDelete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
