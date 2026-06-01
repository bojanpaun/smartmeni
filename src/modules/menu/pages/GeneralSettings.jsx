import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'

export default function GeneralSettings() {
  const { restaurant, setRestaurant } = usePlatform()
  const [form, setForm]     = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (restaurant) {
      setIsDirty(false)
      setForm({
        name:        restaurant.name        || '',
        location:    restaurant.location    || '',
        phone:       restaurant.phone       || '',
        hours:       restaurant.hours       || '',
        description: restaurant.description || '',
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

  const setField = (field, val) => { setForm(f => ({ ...f, [field]: val })); setIsDirty(true) }

  if (!form) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Opšte postavke</h1>
        <p className={styles.subtitle}>Osnovni podaci o objektu vidljivi gostima.</p>
      </div>

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
        <div className={styles.field} style={{ marginBottom: 20 }}>
          <label>Opis restorana</label>
          <textarea
            value={form.description}
            onChange={e => setField('description', e.target.value)}
            placeholder="Kratki opis restorana koji gosti vide u meniju..."
            rows={3}
            className={styles.textarea}
          />
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
