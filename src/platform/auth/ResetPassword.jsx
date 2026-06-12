import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import styles from './Auth.module.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const [ready, setReady] = useState(false)   // imamo li recovery sesiju iz linka
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Recovery link uspostavlja sesiju i fira PASSWORD_RECOVERY (supabase-js sam
    // obradi token iz URL-a). Provjeravamo i postojeću sesiju za svaki slučaj.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) setReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError(t('pwMin6'))
      return
    }
    if (password !== confirm) {
      setError(t('pwMismatch'))
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message || t('pwChangeErr'))
    else setDone(true)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>
          rest.by.me
        </Link>

        <h1 className={styles.title}>{t('newPwTitle')}</h1>

        {done ? (
          <>
            <p className={styles.sub}>{t('pwChangedNow')}</p>
            <button type="button" className={styles.btn} onClick={() => navigate('/admin')}>
              {t('goToPanel')} →
            </button>
          </>
        ) : !ready ? (
          <>
            <p className={styles.sub}>
              {t('openResetLink')}
            </p>
            <p className={styles.loginLink}>
              <Link to="/login">← {t('backToLogin')}</Link>
            </p>
          </>
        ) : (
          <>
            <p className={styles.sub}>{t('enterNewPw')}</p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>{t('newPwLabel')}</label>
                <input
                  type="password"
                  placeholder={t('passwordPh6')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>{t('confirmPwLabel')}</label>
                <input
                  type="password"
                  placeholder={t('confirmPwPh')}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? t('savingPw') : `${t('saveNewPw')} →`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
