import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from './Auth.module.css'

export default function ResetPassword() {
  const navigate = useNavigate()
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
      setError('Lozinka mora imati najmanje 6 karaktera.')
      return
    }
    if (password !== confirm) {
      setError('Lozinke se ne poklapaju.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) setError(error.message || 'Greška pri promjeni lozinke.')
    else setDone(true)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <Link to="/" className={styles.logo}>
          rest.by.me
        </Link>

        <h1 className={styles.title}>Nova lozinka</h1>

        {done ? (
          <>
            <p className={styles.sub}>✓ Lozinka je promijenjena. Sada ste prijavljeni.</p>
            <button type="button" className={styles.btn} onClick={() => navigate('/admin')}>
              Idi na panel →
            </button>
          </>
        ) : !ready ? (
          <>
            <p className={styles.sub}>
              Otvorite link za resetovanje iz emaila da biste postavili novu lozinku.
              Ako ste već kliknuli, sačekajte trenutak…
            </p>
            <p className={styles.loginLink}>
              <Link to="/login">← Nazad na prijavu</Link>
            </p>
          </>
        ) : (
          <>
            <p className={styles.sub}>Unesite novu lozinku za vaš nalog.</p>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label>Nova lozinka</label>
                <input
                  type="password"
                  placeholder="Minimum 6 karaktera"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Potvrdi lozinku</label>
                <input
                  type="password"
                  placeholder="Ponovi lozinku"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? 'Čuvanje...' : 'Sačuvaj novu lozinku →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
