import { usePlatform } from '../../context/PlatformContext'
import styles from './Auth.module.css'

// Ekran za vlasnika čiji tenant čeka odobrenje superadmina (approval_status != approved).
// Gejtuje se u App.jsx (ApprovalGate) prije AdminLayout-a.
export default function PendingApproval({ status }) {
  const { restaurant, logout } = usePlatform()
  const rejected = status === 'rejected'

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>rest.by.me</div>

        {rejected ? (
          <>
            <h1 className={styles.title}>Prijava nije odobrena</h1>
            <p className={styles.sub}>
              Nažalost, nalog za <strong>{restaurant?.name}</strong> nije odobren. Ako mislite
              da je riječ o grešci, kontaktirajte nas na{' '}
              <a href="mailto:info@restby.me">info@restby.me</a>.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Nalog čeka odobrenje ⏳</h1>
            <p className={styles.sub}>
              Hvala na registraciji! Nalog za <strong>{restaurant?.name}</strong> je kreiran i
              čeka pregled našeg tima. Javićemo vam se na email čim bude odobren — obično u roku
              od jednog radnog dana.
            </p>
            <p className={styles.sub} style={{ marginTop: 12 }}>
              Vaša stranica <strong>restby.me/{restaurant?.slug}</strong> postaje aktivna nakon odobrenja.
            </p>
          </>
        )}

        <button className={styles.btn} style={{ marginTop: 20 }} onClick={logout}>
          Odjavi se
        </button>
        <p className={styles.loginLink} style={{ marginTop: 14 }}>
          Pitanja? <a href="mailto:info@restby.me">info@restby.me</a>
        </p>
      </div>
    </div>
  )
}
