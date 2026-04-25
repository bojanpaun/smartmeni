// ▶ Novi fajl: src/modules/guests/pages/GuestLoginPage.jsx
// Dostupno na: /:slug/prijava

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './GuestLoginPage.module.css'

const GUEST_SESSION_KEY = (slug) => `sm_guest_${slug}`

export default function GuestLoginPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('return') || `/${slug}`

  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', contact: '' })
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => { loadRestaurant() }, [slug])

  // Očisti eventualno zaostalu sesiju pri otvaranju login stranice
  useEffect(() => {
    try {
      localStorage.removeItem(GUEST_SESSION_KEY(slug))
      localStorage.removeItem(GUEST_SESSION_KEY(slug) + '_activity')
    } catch {}
  }, [slug])

  const loadRestaurant = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, color, template')
      .eq('slug', slug)
      .single()
    setRestaurant(data)
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setSearching(true); setError('')

    const nameParts = form.name.trim().toLowerCase().split(' ')
    const contact = form.contact.trim()

    const { data } = await supabase
      .from('guests')
      .select('id, first_name, last_name, status, phone, email')
      .eq('restaurant_id', restaurant.id)
      .or(`phone.eq.${contact},email.eq.${contact}`)
      .neq('status', 'blacklist')
      .neq('status', 'pending')

    setSearching(false)

    if (!data?.length) {
      setError('Nismo pronašli vaše podatke. Provjerite ime i kontakt.')
      return
    }

    const match = data.find(g => {
      const fn = g.first_name?.toLowerCase() || ''
      const ln = g.last_name?.toLowerCase() || ''
      return nameParts.some(p => fn.includes(p) || ln.includes(p))
    })

    if (!match) {
      setError('Ime se ne poklapa sa kontaktom. Pokušajte ponovo.')
      return
    }

    // Sačuvaj sesiju
    const session = { id: match.id, first_name: match.first_name, last_name: match.last_name, status: match.status }
    try {
      localStorage.setItem(GUEST_SESSION_KEY(slug), JSON.stringify(session))
      localStorage.setItem(GUEST_SESSION_KEY(slug) + '_activity', Date.now().toString())
    } catch {}

    window.location.href = returnTo
  }

  if (loading) return <div className={styles.page}><div className={styles.loading}>Učitavanje...</div></div>
  if (!restaurant) return <div className={styles.page}><div className={styles.loading}>Restoran nije pronađen.</div></div>

  const tpl = getTemplate(restaurant?.template)
  const brand = tpl?.brand || restaurant?.color || '#0d7a52'
  const pageBg = tpl?.pageBg || '#f0f5f2'

  return (
    <div className={styles.page} style={{ background: pageBg }}>
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.headerTop}>
            <a href={`/${slug}`} className={styles.backBtn}>← Meni</a>
          </div>
          <div className={styles.logoWrap}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt={restaurant.name} className={styles.logoImg} />
              : <div className={styles.logoPlaceholder}>{restaurant.name[0]}</div>
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
          <div className={styles.subtitle}>Prijava gosta</div>
        </div>

        {/* Forma */}
        <div className={styles.form}>
          <div className={styles.formTitle}>Dobrodošli</div>
          <div className={styles.formSub}>
            Unesite vaše ime i broj telefona ili email da se prijavite.
          </div>

          <form onSubmit={handleLogin}>
            <div className={styles.field}>
              <label>Ime i prezime *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nikola Petrović"
                required
              />
            </div>
            <div className={styles.field}>
              <label>Telefon ili email *</label>
              <input
                value={form.contact}
                onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                placeholder="+382 67 ... ili vas@email.com"
                required
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.btnSubmit}
              style={{ background: brand }}
              disabled={searching}
            >
              {searching ? 'Provjera...' : 'Prijavi se →'}
            </button>
          </form>

          <div className={styles.registerPrompt}>
            Niste registrovani?{' '}
            <a href={`/${slug}/registracija`} style={{ color: brand, fontWeight: 500 }}>
              Registruj se
            </a>
          </div>
          <a href={`/${slug}`} className={styles.menuLink} style={{ color: brand }}>
            ← Pogledajte meni
          </a>
        </div>
      </div>
    </div>
  )
}
