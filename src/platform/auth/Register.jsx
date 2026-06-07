import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from './Auth.module.css'

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    slug: '',
    location: '',
    phone: '',
    hours: '',
  })
  // 2b/Faza 4: izbor biznisa (vertikala). Restoran je besplatna baza, hotel plaćen.
  const [verticals, setVerticals] = useState({ restaurant: true, hotel: false })
  const toggleVertical = (k) => setVerticals(v => ({ ...v, [k]: !v[k] }))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[čć]/g, 'c')
      .replace(/[šđ]/g, 's')
      .replace(/ž/g, 'z')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 30)
  }

  const handleStep1 = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError('Lozinka mora imati najmanje 6 karaktera.')
      return
    }
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const activeVerticals = []
    if (verticals.restaurant) activeVerticals.push('restaurant')
    if (verticals.hotel) activeVerticals.push('hotel')
    if (activeVerticals.length === 0) {
      setError('Izaberite bar jedan biznis (restoran i/ili hotel).')
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (authError) throw authError

      const slug = form.slug || generateSlug(form.name)

      const { error: restError } = await supabase
        .from('restaurants')
        .insert({
          user_id: authData.user.id,
          name: form.name,
          slug,
          location: form.location,
          phone: form.phone,
          hours: form.hours,
        })

      if (restError) throw restError

      // Restoran insert je auto-kreirao tenant (default vertikale '{restaurant}').
      // Postavi izabrane vertikale (hotel-only → restoran sakriven gejtovanjem).
      await supabase
        .from('tenants')
        .update({ active_verticals: activeVerticals })
        .eq('user_id', authData.user.id)

      navigate('/admin')
    } catch (err) {
      setError(err.message || 'Greška pri registraciji. Pokušajte ponovo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>
          rest.by.me
        </Link>

        <div className={styles.steps}>
          <div className={`${styles.stepDot} ${step >= 1 ? styles.stepActive : ''}`}>1</div>
          <div className={styles.stepLine}></div>
          <div className={`${styles.stepDot} ${step >= 2 ? styles.stepActive : ''}`}>2</div>
        </div>

        {step === 1 && (
          <>
            <h1 className={styles.title}>Kreirajte nalog</h1>
            <p className={styles.sub}>Besplatno zauvijek. Bez kreditne kartice.</p>
            <form onSubmit={handleStep1} className={styles.form}>
              <div className={styles.field}>
                <label>Email adresa</label>
                <input
                  type="email"
                  placeholder="vas@email.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Lozinka</label>
                <input
                  type="password"
                  placeholder="Minimum 6 karaktera"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn}>
                Nastavi →
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className={styles.title}>Vaš biznis</h1>
            <p className={styles.sub}>Izaberite šta vodite — kasnije možete dodati još.</p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>Šta vodite?</label>
                <div className={styles.bizChoices}>
                  <label className={`${styles.bizChoice} ${verticals.restaurant ? styles.bizChoiceOn : ''}`}>
                    <input type="checkbox" checked={verticals.restaurant} onChange={() => toggleVertical('restaurant')} />
                    <span className={styles.bizIcon}>🍽️</span>
                    <span className={styles.bizText}>
                      <span className={styles.bizName}>Restoran</span>
                      <span className={styles.bizDesc}>Digitalni meni i stolovi · besplatno</span>
                    </span>
                  </label>
                  <label className={`${styles.bizChoice} ${verticals.hotel ? styles.bizChoiceOn : ''}`}>
                    <input type="checkbox" checked={verticals.hotel} onChange={() => toggleVertical('hotel')} />
                    <span className={styles.bizIcon}>🏨</span>
                    <span className={styles.bizText}>
                      <span className={styles.bizName}>Hotel</span>
                      <span className={styles.bizDesc}>Sobe, rezervacije, folio · plaćeno</span>
                    </span>
                  </label>
                </div>
              </div>
              <div className={styles.field}>
                <label>{verticals.restaurant ? 'Naziv restorana *' : 'Naziv objekta *'}</label>
                <input
                  type="text"
                  placeholder={verticals.restaurant ? 'npr. Restoran Mornar' : 'npr. Hotel Mornar'}
                  value={form.name}
                  onChange={e => {
                    set('name', e.target.value)
                    set('slug', generateSlug(e.target.value))
                  }}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Vaš URL na RestByMeju</label>
                <div className={styles.slugWrap}>
                  <span className={styles.slugPrefix}>rest.by.me/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => set('slug', e.target.value)}
                    placeholder="restoran-mornar"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label>Lokacija</label>
                <input
                  type="text"
                  placeholder="npr. Budva, Crna Gora"
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>Telefon</label>
                  <input
                    type="text"
                    placeholder="+382 xx xxx xxx"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>Radno vrijeme</label>
                  <input
                    type="text"
                    placeholder="08:00 – 23:00"
                    value={form.hours}
                    onChange={e => set('hours', e.target.value)}
                  />
                </div>
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? 'Kreiranje naloga...' : 'Kreiraj restoran besplatno →'}
              </button>
              <button type="button" className={styles.btnBack} onClick={() => setStep(1)}>
                ← Nazad
              </button>
            </form>
          </>
        )}

        <p className={styles.loginLink}>
          Već imate nalog? <Link to="/login">Prijavite se</Link>
        </p>
      </div>
    </div>
  )
}

