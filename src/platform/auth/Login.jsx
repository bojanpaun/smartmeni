import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import styles from './Auth.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useTranslation('auth')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [forgotSent, setForgotSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(t('wrongCredentials'))
      setLoading(false)
    } else {
      navigate('/admin')
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const redirectTo = `${window.location.origin}/reset-lozinke`
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    )

    setLoading(false)
    if (error) setError(t('forgotSendErr'))
    else setForgotSent(true)
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setForgotSent(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>
          rest.by.me
        </Link>

        {mode === 'login' && (
          <>
            <h1 className={styles.title}>{t('welcomeBack')}</h1>
            <p className={styles.sub}>{t('loginSub')}</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="login-email">{t('emailLabel')}</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPh')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="login-password">{t('passwordLabel')}</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('passwordPh')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? t('loggingIn') : `${t('loginBtn')} →`}
              </button>
            </form>

            <p className={styles.loginLink}>
              <button type="button" className={styles.linkBtn} onClick={() => switchMode('forgot')}>
                {t('forgotPw')}
              </button>
            </p>

            <p className={styles.loginLink}>
              {t('noAccount')} <Link to="/registracija">{t('registerFree')}</Link>
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h1 className={styles.title}>{t('resetTitle')}</h1>
            {forgotSent ? (
              <>
                <p className={styles.sub}>
                  {t('resetSentPre')}<strong>{email}</strong>{t('resetSentPost')}
                </p>
                <button type="button" className={styles.btn} onClick={() => switchMode('login')}>
                  ← {t('backToLogin')}
                </button>
              </>
            ) : (
              <>
                <p className={styles.sub}>{t('resetEnterEmail')}</p>
                <form onSubmit={handleForgot} className={styles.form}>
                  <div className={styles.field}>
                    <label htmlFor="forgot-email">{t('emailLabel')}</label>
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('emailPh')}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <div className={styles.error}>{error}</div>}
                  <button type="submit" className={styles.btn} disabled={loading}>
                    {loading ? t('sending') : `${t('sendLink')} →`}
                  </button>
                  <button type="button" className={styles.btnBack} onClick={() => switchMode('login')}>
                    ← {t('backToLogin')}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
