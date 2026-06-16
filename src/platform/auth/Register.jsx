import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import styles from './Auth.module.css'

// Javna registracija je otvorena, ali novi tenant ide na ODOBRENJE superadmina
// (approval_status='pending'; DB trigger to i forsira). Vlasnik vidi „čeka odobrenje"
// ekran dok ga superadmin ne odobri na /superadmin.
const REGISTRATION_OPEN = true

export default function Register() {
  const navigate = useNavigate()
  const { loadProfile } = usePlatform()
  const { t } = useTranslation('auth')
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
      setError(t('pwMin6'))
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
      setError(t('chooseBiz'))
      return
    }

    setLoading(true)

    try {
      // 1) Pokušaj kreirati novi auth nalog.
      let userId
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (authError) {
        // Email već ima nalog (npr. korisnik je već zaposleni negdje). Auth je
        // globalan po emailu — ne pravi se drugi nalog; umjesto toga prijavimo
        // postojeći istim kredencijalima i zakačimo mu novi tenant.
        const alreadyExists =
          authError.code === 'user_already_exists' ||
          /already (registered|exists|been registered)/i.test(authError.message || '')
        if (!alreadyExists) throw authError

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
        if (signInError) {
          setError(t('emailHasAccount'))
          setLoading(false)
          return
        }
        userId = signInData.user.id
      } else {
        userId = authData.user.id
        // Ako je u Supabase Auth uključena potvrda emaila ("Confirm email"),
        // signUp NE vraća sesiju → insert restorana ide kao anon i RLS ga obori
        // uz kriptičnu grešku. Za otvorenu registraciju potvrda emaila MORA biti
        // isključena; ako nije, javi jasno umjesto da pukne na insertu.
        if (!authData.session) {
          setError(t('emailConfirmRequired'))
          setLoading(false)
          return
        }
      }

      // 2) Jedan vlasnički tenant po nalogu — ako restoran već postoji, ne pravi
      //    drugi (PlatformContext očekuje 0/1), samo uđi u panel.
      const { data: existingRest } = await supabase
        .from('restaurants')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      if (existingRest) {
        await loadProfile({ id: userId })
        navigate('/admin')
        return
      }

      // 3) Kreiraj tenant (restaurants); auto-create tenant trigger radi ostatak.
      const slug = form.slug || generateSlug(form.name)
      const { error: restError } = await supabase
        .from('restaurants')
        .insert({
          user_id: userId,
          name: form.name,
          slug,
          location: form.location,
          phone: form.phone,
          hours: form.hours,
          active_verticals: activeVerticals,
          approval_status: 'pending',   // čeka odobrenje superadmina (trigger to i forsira)
        })

      if (restError) throw restError

      // Osvježi kontekst da /admin ima novi restoran prije navigacije (inače
      // prazna stranica dok onAuthStateChange/loadProfile ne odradi svoje).
      await loadProfile({ id: userId })
      navigate('/admin')
    } catch (err) {
      setError(err.message || t('regError'))
    } finally {
      setLoading(false)
    }
  }

  if (!REGISTRATION_OPEN) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Link to="/" className={styles.logo}>
            rest.by.me
          </Link>
          <h1 className={styles.title}>{t('regInviteTitle')}</h1>
          <p className={styles.sub}>
            {t('regInviteDescPre')}<a href="mailto:info@restby.me">info@restby.me</a>{t('regInviteDescPost')}
          </p>
          <p className={styles.loginLink}>
            {t('haveAccount')} <Link to="/login">{t('loginLink')}</Link>
          </p>
        </div>
      </div>
    )
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
            <h1 className={styles.title}>{t('createAccount')}</h1>
            <p className={styles.sub}>{t('createAccountSub')}</p>
            <form onSubmit={handleStep1} className={styles.form}>
              <div className={styles.field}>
                <label>{t('emailLabel')}</label>
                <input
                  type="email"
                  placeholder={t('emailPh')}
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>{t('passwordLabel')}</label>
                <input
                  type="password"
                  placeholder={t('passwordPh6')}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn}>
                {t('continueBtn')} →
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className={styles.title}>{t('yourBiz')}</h1>
            <p className={styles.sub}>{t('yourBizSub')}</p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>{t('whatRun')}</label>
                <div className={styles.bizChoices}>
                  <label className={`${styles.bizChoice} ${verticals.restaurant ? styles.bizChoiceOn : ''}`}>
                    <input type="checkbox" checked={verticals.restaurant} onChange={() => toggleVertical('restaurant')} />
                    <span className={styles.bizIcon}>🍽️</span>
                    <span className={styles.bizText}>
                      <span className={styles.bizName}>{t('bizRestaurant')}</span>
                      <span className={styles.bizDesc}>{t('bizRestaurantDesc')}</span>
                    </span>
                  </label>
                  <label className={`${styles.bizChoice} ${verticals.hotel ? styles.bizChoiceOn : ''}`}>
                    <input type="checkbox" checked={verticals.hotel} onChange={() => toggleVertical('hotel')} />
                    <span className={styles.bizIcon}>🏨</span>
                    <span className={styles.bizText}>
                      <span className={styles.bizName}>{t('bizHotel')}</span>
                      <span className={styles.bizDesc}>{t('bizHotelDesc')}</span>
                    </span>
                  </label>
                </div>
              </div>
              <div className={styles.field}>
                <label>{verticals.restaurant ? t('restNameReq') : t('objNameReq')}</label>
                <input
                  type="text"
                  placeholder={verticals.restaurant ? t('restNamePh') : t('objNamePh')}
                  value={form.name}
                  onChange={e => {
                    set('name', e.target.value)
                    set('slug', generateSlug(e.target.value))
                  }}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>{t('yourUrl')}</label>
                <div className={styles.slugWrap}>
                  <span className={styles.slugPrefix}>restby.me/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={e => set('slug', e.target.value)}
                    placeholder={t('slugPh')}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label>{t('location')}</label>
                <input
                  type="text"
                  placeholder={t('locationPh')}
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label>{t('phone')}</label>
                  <input
                    type="text"
                    placeholder={t('phonePh')}
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label>{t('hours')}</label>
                  <input
                    type="text"
                    placeholder={t('hoursPh')}
                    value={form.hours}
                    onChange={e => set('hours', e.target.value)}
                  />
                </div>
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? t('creatingAccount') : `${t('createRestFree')} →`}
              </button>
              <button type="button" className={styles.btnBack} onClick={() => setStep(1)}>
                ← {t('back')}
              </button>
            </form>
          </>
        )}

        <p className={styles.loginLink}>
          {t('haveAccount')} <Link to="/login">{t('loginLink')}</Link>
        </p>
      </div>
    </div>
  )
}

