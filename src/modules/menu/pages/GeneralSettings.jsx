// ▶ Zamijeniti: src/modules/menu/pages/GeneralSettings.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'

const VIS_OPTIONS = [
  { value: 'off', label: 'Isključeno' },
  { value: 'registered', label: 'Registrovani' },
  { value: 'all', label: 'Svi' },
]


function VisibilityControl({ value, onChange, label, icon, desc }) {
  return (
    <div className={styles.orderingCard}>
      <div className={styles.orderingInfo}>
        <div className={styles.orderingTitle}>{icon} {label}</div>
        <div className={styles.orderingDesc}>{desc}</div>
      </div>
      <div className={styles.segControl}>
        {VIS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={[
              styles.segBtn,
              value === opt.value ? styles.segBtnActive : '',
              value === opt.value && opt.value === 'off' ? styles.segBtnOff : '',
              value === opt.value && opt.value === 'registered' ? styles.segBtnReg : '',
              value === opt.value && opt.value === 'all' ? styles.segBtnAll : '',
            ].join(' ')}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Drag&drop lista za poruke

export default function GeneralSettings() {
  const { restaurant, setRestaurant } = usePlatform()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)


  useEffect(() => {
    if (restaurant) {
      setIsDirty(false)
      setForm({
        name: restaurant.name || '',
        location: restaurant.location || '',
        phone: restaurant.phone || '',
        hours: restaurant.hours || '',
        description: restaurant.description || '',
        ordering_visibility: restaurant.ordering_visibility || 'all',
        waiter_visibility: restaurant.waiter_visibility || 'all',
        reservation_visibility: restaurant.reservation_visibility || 'all',
        registration_visibility: restaurant.registration_visibility || 'all',
      })

    }
  }, [restaurant])

  const save = async (e) => {
    e.preventDefault()
    if (!restaurant || !form) return
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...form })
    setSaving(false)
    setSaved(true)
    setIsDirty(false)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleField = async (field, val) => {
    setForm(f => ({ ...f, [field]: val }))
    const { error } = await supabase.from('restaurants').update({ [field]: val }).eq('id', restaurant.id)
    if (error) { setForm(f => ({ ...f, [field]: form[field] })); alert('Greška pri čuvanju.'); return }
    setRestaurant(r => ({ ...r, [field]: val }))
  }

  const setField = (field, val) => { setForm(f => ({ ...f, [field]: val })); setIsDirty(true) }



  if (!form) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Opšte postavke</h1>
        <p className={styles.subtitle}>Podaci o restoranu vidljivi gostima u guest meniju.</p>
      </div>

      <div className={styles.sectionLabel}>Vidljivost u digitalnom meniju</div>
      <div className={styles.visDesc}>Za svaku opciju odaberi ko je može vidjeti</div>

      <VisibilityControl icon="🛒" label="Digitalno naručivanje" desc="Ko može naručivati iz menija"
        value={form.ordering_visibility} onChange={val => toggleField('ordering_visibility', val)} />
      <VisibilityControl icon="🔔" label="Poziv konobara" desc="Ko može pozvati konobara"
        value={form.waiter_visibility} onChange={val => toggleField('waiter_visibility', val)} />
      <VisibilityControl icon="📅" label="Online rezervacije" desc="Ko može rezervisati sto"
        value={form.reservation_visibility} onChange={val => toggleField('reservation_visibility', val)} />
      <VisibilityControl icon="🎟️" label="Registracija gostiju" desc="Ko vidi dugme Postani naš gost i Prijava"
        value={form.registration_visibility} onChange={val => toggleField('registration_visibility', val)} />

      {/* PODACI RESTORANA */}
      <div className={styles.sectionLabel} style={{ marginTop: 28 }}>Podaci restorana</div>
      <form onSubmit={save} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>Naziv restorana</label>
            <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="npr. Pizzeria Napoli" />
          </div>
          <div className={styles.field}>
            <label>Lokacija</label>
            <input value={form.location} onChange={e => setField('location', e.target.value)} placeholder="npr. Budva, Crna Gora" />
          </div>
          <div className={styles.field}>
            <label>Telefon</label>
            <input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="npr. +382 67 123 456" />
          </div>
          <div className={styles.field}>
            <label>Radno vrijeme</label>
            <input value={form.hours} onChange={e => setField('hours', e.target.value)} placeholder="npr. 09:00 – 23:00" />
          </div>
        </div>
        <div className={styles.field} style={{ marginTop: '4px' }}>
          <label>Opis restorana</label>
          <textarea value={form.description} onChange={e => setField('description', e.target.value)}
            placeholder="Kratki opis restorana koji gosti vide u meniju..."
            rows={3} className={styles.textarea} />
          <div className={styles.fieldHint}>Prikazuje se ispod naziva restorana u guest meniju. Max 200 karaktera.</div>
        </div>
        <div className={styles.formActions}>
          {saved && !isDirty && <span className={styles.savedMsg}>✓ Sačuvano</span>}
          {(isDirty || saving) && (
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Čuvanje...' : 'Sačuvaj promjene'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
