import { useNavigate } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import AnnouncementsManager from './AnnouncementsManager'

// Standalone superadmin stranica za najave. Primarni ulaz je sad /admin/notifications
// (role-aware), ova ostaje kao direktan link.
export default function AnnouncementsAdmin() {
  const { isSuperAdmin } = usePlatform()
  const navigate = useNavigate()

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>Nemate pristup ovoj stranici.</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Platform najave</h1>
          <p className={styles.subtitle}>Poruke svim/filtriranim adminima · važne se prikazuju kao banner</p>
        </div>
        <button className={styles.btnSecondary} onClick={() => navigate('/superadmin')}>← Super admin</button>
      </div>
      <AnnouncementsManager />
    </div>
  )
}
