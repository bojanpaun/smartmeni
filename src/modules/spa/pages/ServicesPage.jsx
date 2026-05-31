import { useState } from 'react'
import { usePlatform } from '../../../context/PlatformContext'
import { useSpaServices } from '../hooks/useSpaServices'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import styles from '../../hotel/pages/Hotel.module.css'
import spa from './Spa.module.css'

const CATEGORIES = [
  { value: 'massage',  label: 'Masaža',    icon: '💆' },
  { value: 'facial',   label: 'Facial',    icon: '✨' },
  { value: 'body',     label: 'Tijelo',    icon: '🧖' },
  { value: 'nail',     label: 'Nokti',     icon: '💅' },
  { value: 'wellness', label: 'Wellness',  icon: '🌿' },
  { value: 'group',    label: 'Grupni',    icon: '👥' },
]

const BLANK = {
  name: '', category: 'massage', description: '', duration_minutes: 60,
  buffer_minutes: 15, price: '', price_couple: '', max_guests: 1,
  image_url: '', is_active: true, requires_consultation: false, display_order: 0,
}

export default function ServicesPage() {
  const { restaurant } = usePlatform()
  const { services, loading, save, remove, toggle } = useSpaServices(restaurant?.id)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(BLANK)
  const [saving, setSaving]     = useState(false)
  const [catFilter, setCatFilter] = useState('all')

  if (!restaurant) return <LoadingSpinner fullPage />

  const openNew = () => { setEditing(null); setForm(BLANK); setShowForm(true) }
  const openEdit = (s) => { setEditing(s.id); setForm({ ...BLANK, ...s }); setShowForm(true) }
  const close = () => { setShowForm(false); setEditing(null); setForm(BLANK) }
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    await save({ ...form, price: Number(form.price), price_couple: form.price_couple ? Number(form.price_couple) : null }, editing)
    setSaving(false)
    close()
  }

  const filtered = catFilter === 'all' ? services : services.filter(s => s.category === catFilter)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Katalog tretmana</h1>
          <p className={styles.subtitle}>Definirajte tretmane, trajanje i cijene</p>
        </div>
        <button className={styles.btnPrimary} onClick={openNew}>+ Novi tretman</button>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={`${styles.filterBtn} ${catFilter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setCatFilter('all')}
        >
          Svi ({services.length})
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            className={`${styles.filterBtn} ${catFilter === c.value ? styles.filterBtnActive : ''}`}
            onClick={() => setCatFilter(c.value)}
          >
            {c.icon} {c.label} ({services.filter(s => s.category === c.value).length})
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className={spa.formPanel}>
          <div className={spa.formPanelHeader}>
            <span className={spa.formPanelTitle}>{editing ? 'Uredi tretman' : 'Novi tretman'}</span>
            <button className={spa.formPanelClose} onClick={close}>✕</button>
          </div>
          <div className={spa.formGrid}>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Naziv tretmana *</label>
              <input className={spa.formInput} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Npr. Aromaterapijska masaža" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Kategorija</label>
              <select className={spa.formSelect} value={form.category} onChange={e => upd('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Cijena (€) *</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price} onChange={e => upd('price', e.target.value)} placeholder="80.00" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Trajanje (min)</label>
              <select className={spa.formSelect} value={form.duration_minutes} onChange={e => upd('duration_minutes', Number(e.target.value))}>
                {[30,45,60,75,90,105,120,150,180].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Buffer između termina (min)</label>
              <select className={spa.formSelect} value={form.buffer_minutes} onChange={e => upd('buffer_minutes', Number(e.target.value))}>
                {[0,10,15,20,30].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Cijena za par (€, opciono)</label>
              <input className={spa.formInput} type="number" min="0" step="0.01" value={form.price_couple || ''} onChange={e => upd('price_couple', e.target.value)} placeholder="150.00" />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Maks. gostiju</label>
              <input className={spa.formInput} type="number" min="1" max="20" value={form.max_guests} onChange={e => upd('max_guests', Number(e.target.value))} />
            </div>
            <div className={spa.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={spa.formLabel}>Opis</label>
              <textarea className={spa.formTextarea} value={form.description || ''} onChange={e => upd('description', e.target.value)} placeholder="Kratki opis tretmana..." rows={3} />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>URL slike (opciono)</label>
              <input className={spa.formInput} type="url" value={form.image_url || ''} onChange={e => upd('image_url', e.target.value)} placeholder="https://..." />
            </div>
            <div className={spa.formField}>
              <label className={spa.formLabel}>Redosljed prikaza</label>
              <input className={spa.formInput} type="number" min="0" value={form.display_order} onChange={e => upd('display_order', Number(e.target.value))} />
            </div>
            <div className={spa.formField} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, gridColumn: '1 / -1' }}>
              <label className={spa.toggle}>
                <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} />
                <span className={spa.toggleSlider} />
              </label>
              <span className={spa.formLabel} style={{ margin: 0 }}>Tretman je aktivan (vidljiv gostima)</span>
            </div>
          </div>
          <div className={spa.formActions}>
            <button className={styles.btnSecondary} onClick={close}>Odustani</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? 'Čuvanje...' : editing ? 'Sačuvaj izmjene' : 'Kreiraj tretman'}
            </button>
          </div>
        </div>
      )}

      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div className={spa.empty}>
          <div className={spa.emptyIcon}>💆</div>
          <p>{catFilter === 'all' ? 'Nema tretmana. Kreirajte prvi.' : 'Nema tretmana u ovoj kategoriji.'}</p>
        </div>
      ) : (
        <div className={spa.cardGrid}>
          {filtered.map(s => {
            const cat = CATEGORIES.find(c => c.value === s.category) || CATEGORIES[0]
            return (
              <div key={s.id} className={spa.card} style={{ opacity: s.is_active ? 1 : 0.65 }}>
                {s.image_url
                  ? <img src={s.image_url} alt={s.name} className={spa.cardImg} />
                  : <div className={spa.cardImgPlaceholder}>{cat.icon}</div>
                }
                <div className={spa.cardBody}>
                  <div className={spa.cardTitle}>{s.name}</div>
                  <div className={spa.cardMeta}>
                    <span>{cat.icon} {cat.label}</span>
                    <span>⏱ {s.duration_minutes} min</span>
                    {s.price_couple && <span>👫 €{Number(s.price_couple).toFixed(0)}</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={spa.cardPrice}>€{Number(s.price).toFixed(2)}</span>
                    <span className={`${spa.badge} ${s.is_active ? spa.badgeActive : spa.badgeInactive}`}>
                      {s.is_active ? 'Aktivan' : 'Neaktivan'}
                    </span>
                  </div>
                  {s.description && <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 8, lineHeight: 1.4 }}>{s.description}</p>}
                  <div className={spa.cardActions}>
                    <button className={styles.btnSecondary} style={{ fontSize: 12 }} onClick={() => openEdit(s)}>Uredi</button>
                    <button
                      className={styles.btnSecondary}
                      style={{ fontSize: 12 }}
                      onClick={() => toggle(s.id, !s.is_active)}
                    >
                      {s.is_active ? 'Deaktiviraj' : 'Aktiviraj'}
                    </button>
                    <button
                      style={{ padding: '6px 12px', fontSize: 12, background: 'transparent', color: '#c0392b', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => { if (window.confirm('Obrisati tretman?')) remove(s.id) }}
                    >
                      Obriši
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
