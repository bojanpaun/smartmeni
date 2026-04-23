// ▶ Zamijeniti: src/modules/menu/pages/GeneralSettings.jsx

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlatform } from '../../../context/PlatformContext'
import styles from './GeneralSettings.module.css'

function Toggle({ value, onChange, label, desc }) {
  return (
    <div className={styles.orderingCard}>
      <div className={styles.orderingInfo}>
        <div className={styles.orderingTitle}>{label}</div>
        <div className={styles.orderingDesc}>{desc(value)}</div>
      </div>
      <button
        type="button"
        className={`${styles.toggle} ${value ? styles.toggleOn : styles.toggleOff}`}
        onClick={() => onChange(!value)}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  )
}

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
        description: restaurant.description || '',
        digital_ordering: restaurant.digital_ordering ?? true,
        online_reservations: restaurant.online_reservations ?? false,
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

  const toggleField = async (field, val) => {
    const updated = { ...form, [field]: val }
    setForm(updated)
    await supabase.from('restaurants').update({ [field]: val }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, [field]: val })
  }

  if (!form) return <div className={styles.loading}>Učitavanje...</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Opšte postavke</h1>
        <p className={styles.subtitle}>Podaci o restoranu vidljivi gostima u guest meniju.</p>
      </div>

      {/* Toggleovi */}
      <Toggle
        value={form.digital_ordering}
        onChange={val => toggleField('digital_ordering', val)}
        label="Digitalno naručivanje"
        desc={v => v
          ? 'Uključeno — gosti mogu naručivati putem menija'
          : 'Isključeno — gosti vide meni ali ne mogu naručivati'}
      />

      <Toggle
        value={form.online_reservations}
        onChange={val => toggleField('online_reservations', val)}
        label="Online rezervacije"
        desc={v => v
          ? 'Uključeno — gosti mogu rezervisati sto putem linka menija'
          : 'Isključeno — forma za rezervacije nije dostupna gostima'}
      />

      {/* Forma */}
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

        <div className={styles.field} style={{ marginTop: '4px' }}>
          <label>Opis restorana</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Kratki opis restorana koji gosti vide u meniju — atmosfera, specijaliteti, priča..."
            rows={3}
            className={styles.textarea}
          />
          <div className={styles.fieldHint}>
            Prikazuje se ispod naziva restorana u guest meniju. Max 200 karaktera.
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
