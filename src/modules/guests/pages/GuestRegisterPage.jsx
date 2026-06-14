// ▶ Novi fajl: src/modules/guests/pages/GuestRegisterPage.jsx

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../../lib/supabase'
import { getTemplate } from '../../../lib/templates'
import styles from './GuestRegisterPage.module.css'

export default function GuestRegisterPage() {
  const { t } = useTranslation('guestaccount')
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
    if (!form.agreed) { setError(t('grAgreeRequired')); return }
    if (!form.phone && !form.email) { setError(t('grContactRequired')); return }
    setSaving(true); setError('')

    // Detekcija duplikata (anon ne može čitati tuđe/pending goste → RPC).
    const { data: existsCode } = await supabase.rpc('guest_exists', {
      p_restaurant_id: restaurant.id,
      p_phone: form.phone || null,
      p_email: form.email || null,
    })
    if (existsCode === 'pending') {
      setError(t('grPending'))
      setSaving(false)
      return
    }
    if (existsCode === 'exists') {
      setError(t('grExists'))
      setSaving(false)
      return
    }

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
      setError(t('grError'))
      setSaving(false)
      return
    }
    setSaving(false)
    setSubmitted(true)
  }

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.loading}>{t('gaLoading')}</div>
    </div>
  )

  if (!restaurant) return (
    <div className={styles.page}>
      <div className={styles.notFound}>{t('gaRestNotFound')}</div>
    </div>
  )

  const tpl = getTemplate(restaurant?.template, restaurant?.color)
  const brand = tpl?.brand || restaurant?.color || '#0d7a52'
  const pageBg = tpl?.pageBg || '#f0f5f2'

  return (
    <div className={styles.page} style={{ background: pageBg }}>
      <div className={styles.card}>
        {/* Header — isti stil kao guest meni */}
        <div className={styles.header} style={{ background: brand }}>
          <div className={styles.headerTop}>
            <a href={`/${slug}`} className={styles.backBtn}>← {t('gaMenu')}</a>
          </div>
          <div className={styles.logoWrap}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} className={styles.logoImg} alt={restaurant.name} />
              : <div className={styles.logoPlaceholder}>{restaurant.name[0]}</div>
            }
          </div>
          <div className={styles.restName}>{restaurant.name}</div>
          <div className={styles.restSub}>{t('grSubtitle')}</div>
        </div>

        {submitted ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <div className={styles.successTitle}>{t('grSuccessTitle')}</div>
            <div className={styles.successText}>
              {t('grSuccessText')}
            </div>
            <div className={styles.successBadge}>{t('grPendingBadge')}</div>
            <a href={`/${slug}`} className={styles.backToMenu}>← {t('gaBackToMenu')}</a>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formTitle}>{t('grTitle')}</div>
            <div className={styles.formSub}>
              {t('grSub')}
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label>{t('grFirstName')} *</label>
                <input
                  value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder={t('grFirstNamePh')}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>{t('grLastName')} *</label>
                <input
                  value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder={t('grLastNamePh')}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label>{t('grPhone')}</label>
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
                placeholder={t('grEmailPh')}
              />
            </div>

            <div className={styles.field}>
              <label>{t('grDob')}</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label>{t('grNotes')}</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t('grNotesPh')}
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
                {t('grConsent')}
              </label>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.btnSubmit} style={{ background: brand }} disabled={saving}>
              {saving ? t('grSending') : t('glRegister')}
            </button>

            <div className={styles.divider}>{t('grOr')}</div>

            <a href={`/${slug}`} className={styles.btnBack} style={{ color: brand, borderColor: brand }}>
              ← {t('gaBackToMenu')}
            </a>
          </form>
        )}
      </div>
    </div>
  )
}
