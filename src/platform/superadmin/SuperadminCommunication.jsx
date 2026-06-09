import { useParams } from 'react-router-dom'
import { usePlatform } from '../../context/PlatformContext'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import SupportManager from './SupportManager'
import AnnouncementsManager from './AnnouncementsManager'

// Superadmin komunikacija. Sekcija iz rute (/superadmin/komunikacija/:section);
// sidebar linkovi (Podrška | Obavještenja) dolaze iz AdminLayout modula.
export default function SuperadminCommunication() {
  const { isSuperAdmin } = usePlatform()
  const { section } = useParams()
  const tab = section === 'obavestenja' ? 'obavestenja' : 'podrska'

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>Nemate pristup ovoj stranici.</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{tab === 'obavestenja' ? '📣 Obavještenja' : '💬 Podrška'}</h1>
          <p className={styles.subtitle}>
            {tab === 'obavestenja' ? 'Kreiranje i uređivanje platform najava' : 'Podrška svim tenantima'}
          </p>
        </div>
      </div>

      {tab === 'obavestenja' ? <AnnouncementsManager /> : <SupportManager />}
    </div>
  )
}
