import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePlatform } from '../../context/PlatformContext'
import { generateSlug } from './authHelpers'
import BusinessSetupForm from './BusinessSetupForm'
import styles from './Auth.module.css'

// Postavka biznisa poslije OAuth prijave: korisnik je već autentifikovan (npr.
// Google) ali još nema restoran. Ista forma kao korak 2 registracije — kreira
// tenant (approval_status='pending') i ulazi u standardni approval tok.
// Gejtovano u App.jsx (OnboardingGate) za prijavljenog vlasnika bez tenanta.
export default function Onboarding() {
  const navigate = useNavigate()
  const { user, logout, loadProfile } = usePlatform()
  const { t } = useTranslation('auth')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', slug: '', location: '', phone: '', hours: '' })
  const [verticals, setVerticals] = useState({ restaurant: true, hotel: false })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleVertical = (k) => setVerticals(v => ({ ...v, [k]: !v[k] }))

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
      // Zaštita od duplog submita/refresha — ako restoran već postoji, ne pravi drugi
      // (PlatformContext očekuje 0/1 vlasnički tenant po nalogu).
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!existing) {
        const slug = form.slug || generateSlug(form.name)
        const { error: restError } = await supabase
          .from('restaurants')
          .insert({
            user_id: user.id,
            name: form.name,
            slug,
            location: form.location,
            phone: form.phone,
            hours: form.hours,
            active_verticals: activeVerticals,
            approval_status: 'pending',
          })
        if (restError) throw restError
      }

      // Osvježi kontekst da OnboardingGate/ApprovalGate vide novi tenant.
      await loadProfile(user)
      navigate('/admin')
    } catch (err) {
      setError(err.message || t('regError'))
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>rest.by.me</div>
        <h1 className={styles.title}>{t('yourBiz')}</h1>
        <p className={styles.sub}>{t('yourBizSub')}</p>

        <BusinessSetupForm
          form={form}
          set={set}
          verticals={verticals}
          toggleVertical={toggleVertical}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          submitLabel={`${t('createRestFree')} →`}
        />

        <p className={styles.loginLink}>
          <button type="button" className={styles.linkBtn} onClick={logout}>
            {t('logout')}
          </button>
        </p>
      </div>
    </div>
  )
}
