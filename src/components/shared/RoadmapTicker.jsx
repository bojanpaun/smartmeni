import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRoadmap } from '../../lib/useRoadmap'
import styles from './RoadmapTicker.module.css'

// Diskretni ticker najava budućeg razvoja na dashboardu. Bez dismiss-a (trajno
// vidljivo svim korisnicima); „vidi sve" otvara modal sa opisima. Superadmin kurira.
export default function RoadmapTicker() {
  const { t } = useTranslation('admin')
  const items = useRoadmap()
  const [open, setOpen] = useState(false)

  if (!items.length) return null

  return (
    <>
      <div className={styles.ticker}>
        <span className={styles.rocket} aria-hidden="true">🚀</span>
        <span className={styles.label}>{t('rmComing')}:</span>
        <span className={styles.list}>{items.map(i => i.title).join('  ·  ')}</span>
        <button className={styles.seeAll} onClick={() => setOpen(true)}>{t('rmSeeAll')}</button>
      </div>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>🚀 {t('rmModalTitle')}</span>
              <button className={styles.close} onClick={() => setOpen(false)} aria-label="✕">✕</button>
            </div>
            <div className={styles.modalBody}>
              {items.map(i => (
                <div key={i.id} className={styles.item}>
                  <div className={styles.itemTitle}>{i.title}</div>
                  {i.description && <div className={styles.itemDesc}>{i.description}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
