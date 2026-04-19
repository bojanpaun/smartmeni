// ▶ Novi fajl: src/modules/tables/pages/OnlineReservationForm.jsx
// Dostupno na: /:slug/rezervacija

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import styles from './OnlineReservationForm.module.css'

export default function OnlineReservationForm() {
  const { slug } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    date: '',
    time: '19:00',
    guests_count: 2,
    note: '',
  })

  useEffect(() => {
    const load = async () => {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, name, slug, logo_url, color, online_reservations')
        .eq('slug', slug)
        .single()
      setRestaurant(rest)
      setLoading(false)
    }
    load()
  }, [slug])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      await supabase.from('reservations').insert({
        restaurant_id: restaurant.id,
        guest_name: form.guest_name,
        guest_phone: form.guest_phone || null,
        guest_email: form.guest_email || null,
        date: form.date,
        time: form.time,
        guests_count: form.guests_count,
        note: form.note || null,
        status: 'pending',
        source: 'online',
      })
      setSubmitted(true)
    } catch {
      setError('Došlo je do greške. Pokušajte ponovo.')
    }
    setSaving(false)
  }

  if (loading) return (
    <div className={styles.loadingWrap}>
      Učitavanje...
    </div>
  )

  if (!restaurant) return (
    <div className={styles.errorWrap}>
      <div>🍽️</div>
      <div>Restoran nije pronađen.</div>
    </div>
  )

  const brand = restaurant.color || '#0d7a52'

  if (!restaurant.online_reservations) return (
    <div className={styles.pageWrap}>
      <div className={styles.card}>
        <div className={styles.logo} style={{ background: brand }}>
          {restaurant.logo_url
            ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logoImg} />
            : restaurant.name[0]
          }
        </div>
        <div className={styles.restName}>{restaurant.name}</div>
        <div className={styles.disabledMsg}>
          Online rezervacije trenutno nijesu dostupne.<br />
          Kontaktirajte restoran direktno.
        </div>
        <a href={`/${slug}`} className={styles.backLink} style={{ color: brand }}>
          ← Pogledajte meni
        </a>
      </div>
    </div>
  )

  if (submitted) return (
    <div className={styles.pageWrap}>
      <div className={styles.card}>
        <div className={styles.successIcon}>✓</div>
        <div className={styles.successTitle}>Zahtjev poslan!</div>
        <div className={styles.successDesc}>
          Vaš zahtjev za rezervaciju je primljen. Restoran će vas kontaktirati radi potvrde.
        </div>
        <a href={`/${slug}`} className={styles.btnBack} style={{ background: brand }}>
          ← Nazad na meni
        </a>
      </div>
    </div>
  )

  // Minimalni datum = danas
  const minDate = new Date().toISOString().slice(0, 10)

  return (
    <div className={styles.pageWrap}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.logo}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logoImg} />
              : restaurant.name[0]
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
          <div className={styles.subtitle}>Zahtjev za rezervaciju</div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>

          <div className={styles.field}>
            <label>Ime i prezime *</label>
            <input
              value={form.guest_name}
              onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
              placeholder="Vaše ime i prezime"
              required
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Datum *</label>
              <input
                type="date"
                min={minDate}
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Vrijeme *</label>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Broj gostiju *</label>
            <div className={styles.guestsControl}>
              <button type="button" onClick={() => setForm(f => ({ ...f, guests_count: Math.max(1, f.guests_count - 1) }))}>−</button>
              <span>{form.guests_count}</span>
              <button type="button" onClick={() => setForm(f => ({ ...f, guests_count: Math.min(20, f.guests_count + 1) }))}>+</button>
            </div>
          </div>

          <div className={styles.field}>
            <label>Telefon</label>
            <input
              type="tel"
              value={form.guest_phone}
              onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))}
              placeholder="+382 XX XXX XXX"
            />
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              value={form.guest_email}
              onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))}
              placeholder="vasa@email.com"
            />
          </div>

          <div className={styles.field}>
            <label>Napomena</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={3}
              placeholder="Posebni zahtjevi, alergije, proslava..."
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.notice}>
            ℹ️ Ovo je zahtjev za rezervaciju. Restoran će vas kontaktirati radi potvrde.
          </div>

          <button
            type="submit"
            className={styles.btnSubmit}
            style={{ background: brand }}
            disabled={saving}
          >
            {saving ? 'Slanje...' : 'Pošalji zahtjev'}
          </button>

          <a href={`/${slug}`} className={styles.menuLink} style={{ color: brand }}>
            ← Pogledajte meni
          </a>
        </form>
      </div>
    </div>
  )
}
