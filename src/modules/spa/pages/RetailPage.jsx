import { useState, useEffect } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const BLANK = { name: '', brand: '', price: '', stock_quantity: 0, image_url: '', is_active: true }

export default function RetailPage() {
  const { restaurant } = usePlatform()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!restaurant?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('spa_retail_items')
      .select('id, name, brand, price, stock_quantity, image_url, is_active')
      .eq('restaurant_id', restaurant.id)
      .order('name')
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [restaurant?.id])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (it) => { setEditing(it.id); setForm({ ...BLANK, ...it, price: it.price ?? '' }); setShowForm(true) }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      restaurant_id:  restaurant.id,
      name:           form.name.trim(),
      brand:          form.brand?.trim() || null,
      price:          form.price === '' ? null : Number(form.price),
      stock_quantity: parseInt(form.stock_quantity) || 0,
      image_url:      form.image_url?.trim() || null,
      is_active:      form.is_active,
    }
    if (editing) await supabase.from('spa_retail_items').update(payload).eq('id', editing)
    else await supabase.from('spa_retail_items').insert(payload)
    setSaving(false)
    close()
    load()
  }

  const remove = async (id) => {
    if (!window.confirm('Obrisati proizvod?')) return
    await supabase.from('spa_retail_items').delete().eq('id', id)
    load()
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Retail proizvodi</h1>
          <p className={styles.subtitle}>Proizvodi za prodaju gostima (na folio ili keš)</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ Dodaj proizvod</button>
      </div>

      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? 'Uredi proizvod' : 'Novi proizvod'}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Naziv *</label>
              <input className={spa.formInput} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="npr. Ulje za masažu" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Brend</label>
              <input className={spa.formInput} value={form.brand} onChange={e => upd('brand', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Cijena (€)</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price} onChange={e => upd('price', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Zaliha</label>
              <input className={spa.formInput} type="number" min="0" step="1" value={form.stock_quantity} onChange={e => upd('stock_quantity', e.target.value)} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>URL slike (opciono)</label>
              <input className={spa.formInput} value={form.image_url} onChange={e => upd('image_url', e.target.value)} placeholder="https://..." />
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <label className={spa.toggle}>
                <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
                <span className={spa.toggleSlider} />
              </label>
              <span className={spa.formLabel} style={{ margin: 0 }}>Aktivan (nudi se za prodaju)</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Čuvanje...' : editing ? 'Sačuvaj izmjene' : 'Dodaj proizvod'}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>🛍️</div>
          <p>Nema proizvoda. Dodajte prvi za prodaju gostima.</p>
        </div>
      ) : (
        <table className={spa.table} style={{ background: 'var(--c-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
          <thead>
            <tr><th>Naziv</th><th>Brend</th><th>Cijena</th><th>Zaliha</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ fontWeight: 600 }}>{it.name}</td>
                <td style={{ color: 'var(--c-text-muted)' }}>{it.brand || '—'}</td>
                <td>{it.price != null ? `€${Number(it.price).toFixed(2)}` : '—'}</td>
                <td style={{ color: it.stock_quantity > 0 ? 'inherit' : '#c0392b', fontWeight: it.stock_quantity > 0 ? 400 : 600 }}>{it.stock_quantity}</td>
                <td>{it.is_active ? '✓' : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(it)}>Uredi</button>
                    <button
                      style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer' }}
                      onClick={() => remove(it.id)}
                    >Obriši</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
