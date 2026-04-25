// ▶ Novi fajl: src/modules/guests/pages/GuestRegisterPage.jsx

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './GuestRegisterPage.module.css'

export default function GuestRegisterPage() {
  const { slug } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '',
    email: '', date_of_birth: '', notes: '', agreed: false,
  })

  useEffect(() => { loadRestaurant() }, [slug])

  const loadRestaurant = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, description, logo_url, template, color')
      .eq('slug', slug)
      .single()
    setRestaurant(data)
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.agreed) { setError('Potrebna je saglasnost sa uslovima korišćenja.'); return }
    if (!form.phone && !form.email) { setError('Unesite telefon ili email.'); return }
    setSaving(true); setError('')

    const { error: err } = await supabase.from('guests').insert({
      restaurant_id: restaurant.id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      date_of_birth: form.date_of_birth || null,
      notes: form.notes || null,
      status: 'pending',
    })

    if (err) {
      setError('Greška pri registraciji. Pokušajte ponovo.')
      setSaving(false)
      return
    }
    setSaving(false)
    setSubmitted(true)
  }

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.loading}>Učitavanje...</div>
    </div>
  )

  if (!restaurant) return (
    <div className={styles.page}>
      <div className={styles.notFound}>Restoran nije pronađen.</div>
    </div>
  )

  const tpl = getTemplate(restaurant?.template)
  const brand = tpl?.brand || restaurant?.color || '#0d7a52'
  const pageBg = tpl?.pageBg || '#f0f5f2'

  return (
    <div className={styles.page} style={{ background: pageBg }}>
      <div className={styles.card}>
        {/* Header — isti stil kao guest meni */}
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.headerTop}>
            <a href={`/${slug}`} className={styles.backBtn}>← Meni</a>
          </div>
          <div className={styles.logoWrap}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} className={styles.logoImg} alt={restaurant.name} />
              : <div className={styles.logoPlaceholder}>{restaurant.name[0]}</div>
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
          <div className={styles.restSub}>Registracija gosta</div>
        </div>

        {submitted ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successTitle}>Zahtjev poslan!</div>
            <div className={styles.successText}>
              Tvoja registracija je na čekanju odobrenja od strane restorana.
              Bićeš obaviješten čim te dodaju u evidenciju gostiju.
            </div>
            <div className={styles.successBadge}>Na čekanju odobrenja</div>
            <a href={`/${slug}`} className={styles.backToMenu}>← Nazad na meni</a>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formTitle}>Postani naš gost</div>
            <div className={styles.formSub}>
              Registruj se i uživaj u bržim rezervacijama i specijalnim ponudama.
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>Ime *</label>
                <input
                  value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="Nikola"
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Prezime *</label>
                <input
                  value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Petrović"
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label>Telefon</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+382 67 123 456"
              />
            </div>

            <div className={styles.field}>
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="nikola@email.com"
              />
            </div>

            <div className={styles.field}>
              <label>Datum rođenja</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label>Napomena (alergije, preference...)</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Npr. alergija na orašaste plodove, preferiram sto kraj prozora..."
              />
            </div>

            <div className={styles.checkboxRow}>
              <input
                type="checkbox"
                id="agreed"
                checked={form.agreed}
                onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))}
              />
              <label htmlFor="agreed">
                Saglasan sam sa uslovima korišćenja i politikom privatnosti restorana.
                Moji podaci se čuvaju isključivo za potrebe evidencije gostiju.
              </label>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.btnSubmit} style={{ background: brand }} disabled={saving}>
              {saving ? 'Slanje...' : 'Registruj se'}
            </button>

            <div className={styles.divider}>ili</div>

            <a href={`/${slug}`} className={styles.btnBack} style={{ color: brand, borderColor: brand }}>
              ← Nazad na meni
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
