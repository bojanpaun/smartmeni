import { useState, useEffect } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { supabase } from '../../../lib/supabase'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from './Hotel.module.css'

const BLANK = { name: '', price: '', is_active: true }

export default function MinibarPage() {
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
      .from('minibar_items')
      .select('id, name, price, is_active, sort_order')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order').order('name')
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [restaurant?.id])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (it) => { setEditing(it.id); setForm({ name: it.name, price: it.price ?? '', is_active: it.is_active }); setShowForm(true) }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      restaurant_id: restaurant.id,
      name:          form.name.trim(),
      price:         form.price === '' ? null : Number(form.price),
      is_active:     form.is_active,
    }
    if (editing) await supabase.from('minibar_items').update(payload).eq('id', editing)
    else await supabase.from('minibar_items').insert(payload)
    setSaving(false)
    close()
    load()
  }

  const remove = async (id) => {
    if (!window.confirm('Obrisati artikal?')) return
    await supabase.from('minibar_items').delete().eq('id', id)
    load()
  }

  if (!restaurant) return <LoadingSpinner fullPage />

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Minibar</h1>
          <p className={styles.subtitle}>Cjenovnik minibara — zaduženje ide na folio gosta</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ Dodaj artikal</button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>Naziv *</label>
              <input className={styles.input} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="npr. Coca-Cola 0.33" />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 12, color: 'var(--c-text-medium)' }}>Cijena (€)</label>
              <input className={styles.input} type="number" min="0" step="0.01" value={form.price} onChange={e => upd('price', e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
              <span style={{ fontSize: 13 }}>Aktivan</span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className={styles.btnSecondary} onClick={close}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--c-text-muted)' }}>
          Nema artikala. Dodaj prvi (npr. Voda, Sok, Pivo).
        </div>
      ) : (
        <div className={styles.table}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-surface)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Artikal</th>
                <th style={{ padding: '10px 12px' }}>Cijena</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{it.name}</td>
                  <td style={{ padding: '10px 12px' }}>{it.price != null ? `€${Number(it.price).toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{it.is_active ? '✓' : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
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
        </div>
      )}
    </div>
  )
}
