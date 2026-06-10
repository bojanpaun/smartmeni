import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import spa from '../../modules/spa/pages/Spa.module.css'

const CATEGORIES = ['massage', 'facial', 'body', 'nail', 'wellness', 'group']
const CAT_LABEL = { massage: 'Masaža', facial: 'Facial', body: 'Tijelo', nail: 'Nokti', wellness: 'Wellness', group: 'Grupni' }

const BLANK = {
  id: '', name: '', name_en: '', category: 'massage', description: '', description_en: '',
  duration_minutes: 60, buffer_minutes: 15, suggested_price: '', price_couple: '',
  requires_consultation: false, image_url: '', sort_order: 0, is_active: true,
}

const slugify = (s) => (s || '').toLowerCase().trim()
  .replace(/[čć]/g, 'c').replace(/[šđ]/g, 's').replace(/ž/g, 'z')
  .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40)

export default function SpaTreatmentLibraryAdmin() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('spa_treatment_library')
      .select('*')
      .order('sort_order').order('name')
    setItems(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (it) => {
    setEditing(it.id)
    setForm({ ...BLANK, ...it, suggested_price: it.suggested_price ?? '', price_couple: it.price_couple ?? '' })
    setShowForm(true)
  }
  const close = () => { setShowForm(false); setEditing(null) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const handleSave = async () => {
    if (!form.name.trim()) return flash('Naziv je obavezan')
    const id = editing || slugify(form.id || form.name)
    if (!id) return flash('ID/naziv obavezan')
    setSaving(true)
    const payload = {
      id,
      name: form.name.trim(), name_en: form.name_en?.trim() || null,
      category: form.category, description: form.description || null, description_en: form.description_en || null,
      duration_minutes: parseInt(form.duration_minutes) || 60,
      buffer_minutes: parseInt(form.buffer_minutes) || 0,
      suggested_price: form.suggested_price === '' ? null : Number(form.suggested_price),
      price_couple: form.price_couple === '' ? null : Number(form.price_couple),
      requires_consultation: form.requires_consultation,
      image_url: form.image_url?.trim() || null,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: form.is_active,
    }
    const { error } = await supabase.from('spa_treatment_library').upsert(payload, { onConflict: 'id' })
    setSaving(false)
    if (error) return flash('Greška: ' + error.message)
    close(); flash('Sačuvano'); load()
  }

  const remove = async (id) => {
    if (!window.confirm('Obrisati tretman iz biblioteke?')) return
    await supabase.from('spa_treatment_library').delete().eq('id', id)
    load()
  }

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>Nemate pristup ovoj stranici.</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Biblioteka tretmana</h1>
          <p className={styles.subtitle}>Predefinisani spa tretmani koje tenanti uvoze u svoj katalog</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {msg && <span style={{ alignSelf: 'center', color: 'var(--c-primary)', fontSize: 13 }}>✓ {msg}</span>}
          <button className={styles.btnSecondary} onClick={() => navigate('/superadmin')}>← Super admin</button>
          <button className={styles.btnPrimary} onClick={openNew}>+ Novi tretman</button>
        </div>
      </div>

      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? `Uredi: ${form.name}` : 'Novi tretman'}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            {!editing && (
              <div className={spa.formField}>
                <label className={spa.formLabel}>ID (slug, auto iz naziva)</label>
                <input className={spa.formInput} value={form.id} onChange={e => upd('id', e.target.value)} placeholder="auto" />
              </div>
            )}
            <div className={spa.formField}>
              <label className={spa.formLabel}>Naziv (ME) *</label>
              <input className={spa.formInput} value={form.name} onChange={e => upd('name', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Naziv (EN)</label>
              <input className={spa.formInput} value={form.name_en} onChange={e => upd('name_en', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Kategorija</label>
              <select className={spa.formSelect} value={form.category} onChange={e => upd('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Trajanje (min)</label>
              <input className={spa.formInput} type="number" min="0" value={form.duration_minutes} onChange={e => upd('duration_minutes', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Buffer (min)</label>
              <input className={spa.formInput} type="number" min="0" value={form.buffer_minutes} onChange={e => upd('buffer_minutes', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Predložena cijena (€)</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.suggested_price} onChange={e => upd('suggested_price', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Cijena za par (€)</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price_couple} onChange={e => upd('price_couple', e.target.value)} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Redoslijed</label>
              <input className={spa.formInput} type="number" value={form.sort_order} onChange={e => upd('sort_order', e.target.value)} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Opis (ME)</label>
              <textarea className={spa.formTextarea} rows={2} value={form.description} onChange={e => upd('description', e.target.value)} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Opis (EN)</label>
              <textarea className={spa.formTextarea} rows={2} value={form.description_en} onChange={e => upd('description_en', e.target.value)} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>URL slike</label>
              <input className={spa.formInput} value={form.image_url} onChange={e => upd('image_url', e.target.value)} placeholder="https://... (popunjava i Pexels skripta)" />
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={form.requires_consultation} onChange={e => upd('requires_consultation', e.target.checked)} />
              <span className={spa.formLabel} style={{ margin: 0 }}>Zahtijeva konsultaciju</span>
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
              <span className={spa.formLabel} style={{ margin: 0 }}>Aktivan (vidljiv tenantima)</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>{saving ? 'Čuvanje...' : 'Sačuvaj'}</button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <table className={spa.table} style={{ background: 'var(--c-surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--c-border)' }}>
          <thead>
            <tr><th>Tretman</th><th>Kategorija</th><th>Trajanje</th><th>Cijena</th><th>Aktivan</th><th></th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ fontWeight: 600 }}>{it.name}<span style={{ marginLeft: 8, fontSize: 11, color: 'var(--c-text-muted)' }}>{it.id}</span></td>
                <td>{CAT_LABEL[it.category] || it.category}</td>
                <td>{it.duration_minutes} min</td>
                <td>{it.suggested_price != null ? `€${Number(it.suggested_price).toFixed(2)}` : '—'}</td>
                <td>{it.is_active ? '✓' : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(it)}>Uredi</button>
                    <button style={{ padding: '5px 10px', fontSize: 12, background: 'transparent', color: 'var(--c-danger)', border: '1px solid var(--c-danger-border)', borderRadius: 7, cursor: 'pointer' }} onClick={() => remove(it.id)}>Obriši</button>
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
