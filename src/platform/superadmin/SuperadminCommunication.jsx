import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '../../context/PlatformContext'
import styles from '../../modules/hotel/pages/Hotel.module.css'
import SupportManager from './SupportManager'
import AnnouncementsManager from './AnnouncementsManager'
import RoadmapManager from './RoadmapManager'

// Superadmin komunikacija. Sekcija stiže kao prop iz rute (/superadmin/podrska |
// /superadmin/obavestenja); sidebar linkovi dolaze iz AdminLayout modula.
export default function SuperadminCommunication({ section }) {
  const { isSuperAdmin } = usePlatform()
  const { t } = useTranslation('admin')
  const tab = section === 'obavestenja' ? 'obavestenja' : 'podrska'
  const [annTab, setAnnTab] = useState('najave') // najave | roadmap (samo na obavestenja)

  if (!isSuperAdmin()) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, color: 'var(--c-text-muted)' }}>
      <div style={{ fontSize: 40 }}>🔒</div><div>{t('saNoAccess')}</div>
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{tab === 'obavestenja' ? `📣 ${t('saComAnnouncements')}` : `💬 ${t('saComSupport')}`}</h1>
          <p className={styles.subtitle}>
            {tab === 'obavestenja' ? t('saComAnnSub') : t('saComSupSub')}
          </p>
        </div>
      </div>

      {tab === 'obavestenja' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              className={annTab === 'najave' ? styles.btnPrimary : styles.btnSecondary}
              style={{ fontSize: 13 }}
              onClick={() => setAnnTab('najave')}
            >📣 {t('saComAnnouncements')}</button>
            <button
              className={annTab === 'roadmap' ? styles.btnPrimary : styles.btnSecondary}
              style={{ fontSize: 13 }}
              onClick={() => setAnnTab('roadmap')}
            >🚀 {t('rmModalTitle')}</button>
          </div>
          {annTab === 'najave' ? <AnnouncementsManager /> : <RoadmapManager />}
        </>
      ) : <SupportManager />}
    </div>
  )
}
