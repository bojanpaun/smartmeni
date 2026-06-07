import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from './Auth.module.css'

export default function Login() {
  const navigate = useNavigate()
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
      setError('Pogrešan email ili lozinka.')
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
    if (error) setError('Nije moguće poslati link. Pokušajte ponovo.')
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
            <h1 className={styles.title}>Dobrodošli nazad</h1>
            <p className={styles.sub}>Prijavite se na vaš nalog.</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>Email adresa</label>
                <input
                  type="email"
                  placeholder="vas@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Lozinka</label>
                <input
                  type="password"
                  placeholder="Vaša lozinka"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? 'Prijava...' : 'Prijavi se →'}
              </button>
            </form>

            <button type="button" className={styles.btnBack} onClick={() => switchMode('forgot')}>
              Zaboravili ste lozinku?
            </button>

            <p className={styles.loginLink}>
              Nemate nalog? <Link to="/registracija">Registrujte se besplatno</Link>
            </p>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h1 className={styles.title}>Resetovanje lozinke</h1>
            {forgotSent ? (
              <>
                <p className={styles.sub}>
                  ✓ Poslali smo link za resetovanje na <strong>{email}</strong>.
                  Provjerite inbox (i spam) i kliknite na link.
                </p>
                <button type="button" className={styles.btn} onClick={() => switchMode('login')}>
                  ← Nazad na prijavu
                </button>
              </>
            ) : (
              <>
                <p className={styles.sub}>Unesite email — poslaćemo vam link za novu lozinku.</p>
                <form onSubmit={handleForgot} className={styles.form}>
                  <div className={styles.field}>
                    <label>Email adresa</label>
                    <input
                      type="email"
                      placeholder="vas@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <div className={styles.error}>{error}</div>}
                  <button type="submit" className={styles.btn} disabled={loading}>
                    {loading ? 'Slanje...' : 'Pošalji link →'}
                  </button>
                  <button type="button" className={styles.btnBack} onClick={() => switchMode('login')}>
                    ← Nazad na prijavu
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
