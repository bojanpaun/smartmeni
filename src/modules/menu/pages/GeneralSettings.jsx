import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'

export default function GeneralSettings() {
  const { restaurant, setRestaurant } = usePlatform()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name || '',
        location: restaurant.location || '',
        phone: restaurant.phone || '',
        hours: restaurant.hours || '',
        digital_ordering: restaurant.digital_ordering ?? true,
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
    setTimeout(() => setSaved(false), 2500)
  }

  const toggleOrdering = async (val) => {
    const updated = { ...form, digital_ordering: val }
    setForm(updated)
    // Čuva odmah, bez potrebe za klik na Save
    await supabase
      .from('restaurants')
      .update({ digital_ordering: val })
      .eq('id', restaurant.id)
    setRestaurant({ ...restaurant, digital_ordering: val })
  }

  if (!form) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Opšte postavke</h1>
        <p className={styles.subtitle}>Podaci o restoranu vidljivi gostima u guest meniju.</p>
      </div>

      {/* Toggle digitalno naručivanje — istaknuto na vrhu */}
      <div className={styles.orderingCard}>
        <div className={styles.orderingInfo}>
          <div className={styles.orderingTitle}>Digitalno naručivanje</div>
          <div className={styles.orderingDesc}>
            {form.digital_ordering
              ? 'Uključeno — gosti mogu naručivati putem menija'
              : 'Isključeno — gosti vide meni ali ne mogu naručivati'
            }
          </div>
        </div>
        <button
          className={`${styles.toggle} ${form.digital_ordering ? styles.toggleOn : styles.toggleOff}`}
          onClick={() => toggleOrdering(!form.digital_ordering)}
          title={form.digital_ordering ? 'Isključi naručivanje' : 'Uključi naručivanje'}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>

      {/* Forma sa podacima restorana */}
      <form onSubmit={save} className={styles.form}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label>Naziv restorana</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="npr. Pizzeria Napoli"
            />
          </div>
          <div className={styles.field}>
            <label>Lokacija</label>
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="npr. Budva, Crna Gora"
            />
          </div>
          <div className={styles.field}>
            <label>Telefon</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="npr. +382 67 123 456"
            />
          </div>
          <div className={styles.field}>
            <label>Radno vrijeme</label>
            <input
              value={form.hours}
              onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
              placeholder="npr. 09:00 – 23:00"
            />
          </div>
        </div>

        <div className={styles.formActions}>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? 'Čuvanje...' : saved ? '✓ Sačuvano!' : 'Sačuvaj promjene'}
          </button>
        </div>
      </form>
    </div>
  )
}
